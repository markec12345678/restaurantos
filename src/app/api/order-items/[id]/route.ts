
// PUT /api/order-items/[id] — Update individual order item (status, void, etc.)
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateOrderItemSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { broadcastWS, recalculateOrderTotals, recalculateCheckTotals, returnStockForVoidedItem } from './_helpers'


export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(updateOrderItemSchema, bodyResult.data)
    if (validationError) return validationError

    // FIX V3: Loči void od status update — kuhar lahko spremeni status (take_orders),
    // void pa zahteva void_items dovoljenje (omejen nabor zaposlenih)
    // P1-13 FIX: 'void_item' (ednina) se NI ujemal z 'void_items' (množina) v
    // Job.permissions → natakar z veljavnim void_items dovoljenjem je dobil 403.
    const isVoidOperation = data.voided === true
    const requiredPermission = isVoidOperation ? 'void_items' : 'take_orders'
    const authResult = await requireAuth(req, { permission: requiredPermission })
    if (authResult.error) return authResult.error

    const updateData: Record<string, unknown> = {}
    if (data.status) updateData.status = data.status
    if (data.notes !== undefined) updateData.notes = data.notes

    // FIX (IDOR doslednost): tenant scope za VSE update-e (prej samo za void)
    // FIX R86-2a (M2 fail-open): centralni resolver namesto raw spread-a
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'PUT /api/order-items/[id]',
    })
    if ('error' in scope) return scope.error
    const existingItem = await db.orderItem.findFirst({
      where: {
        id,
        ...(scope.locationId ? { order: { locationId: scope.locationId } } : {}),
      },
    })
    if (!existingItem) {
      return NextResponse.json({ error: 'Artikel ni najden' }, { status: 404 })
    }

    // === VOID OPERACIJA ===
    if (data.voided === true) {
      // BUG-HUNT FIX 2026-09-19: void na plačanem/delno plačanem čeku bi znižal
      // total čeka POD obstoječimi plačili (nastrojena preplačila, napačna
      // prihodkovna poročila). Po FURS je odstranitev artikla po računu STORNO,
      // ne void — usmerimo na storno/povračilo.
      if (existingItem.checkId) {
        const itemCheck = await db.check.findUnique({
          where: { id: existingItem.checkId },
          select: { paymentStatus: true },
        })
        if (itemCheck && itemCheck.paymentStatus !== 'unpaid') {
          return NextResponse.json(
            { error: 'Artikla na plačanem ali delno plačanem čeku ni mogoče voidati — uporabi storno/povračilo.' },
            { status: 409 }
          )
        }
      }
      updateData.voided = true
      if (data.voidReasonId) updateData.voidReasonId = data.voidReasonId
      updateData.status = 'voided'

      // BUG-HUNT FIX 2026-09-19 (race, P1-19 vzorec): prej je bila preverba
      // `voided` IZVEN transakcije, update pa brezpogojen — dva vzporedna voida
      // sta oba prestala preverbo → DVOJNO vračilo zaloge. Pogojni updateMany
      // (samo prvi void zmaga) je avtoritativen.
      const claim = await db.orderItem.updateMany({
        where: { id, voided: false },
        data: updateData,
      })
      if (claim.count === 0) {
        return NextResponse.json({ error: 'Artikel je že bil voidan' }, { status: 409 })
      }
    } else if (Object.keys(updateData).length > 0) {
      // Preostali update-i (status/notes) — brez race problematike
      await db.orderItem.update({ where: { id }, data: updateData })
    }

    const orderItem = await db.orderItem.findUnique({
      where: { id },
      include: { menuItem: true, order: { include: { table: true } } },
    })
    if (!orderItem) {
      // Teoretično (race z brisanjem) — claim je že stekel, ampak brez itema ne moremo nadaljevati
      return NextResponse.json({ error: 'Artikel ni najden' }, { status: 404 })
    }

    // Če je void, preračunaj zneske naročila
    if (data.voided === true && orderItem) {
      await recalculateOrderTotals(id, orderItem.orderId)

      // Preračunaj totale čeka
      if (orderItem.checkId) {
        await recalculateCheckTotals(orderItem.checkId)
      }

      // Revizijski dnevnik za void
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'VOID_ORDER_ITEM',
        entityType: 'OrderItem',
        entityId: id,
        details: {
          orderItemId: id,
          orderId: orderItem.orderId,
          menuItemId: orderItem.menuItemId,
          quantity: orderItem.quantity,
          price: toNum(orderItem.price),
          voidReason: data.voidReasonText || data.voidReasonId || 'Ni razloga',
          voidedBy: authResult.session?.employeeId,
        },
      })

      // Vrni zalogo za voidan artikel — SAMO, če je bila zalogo sploh odtegljena
      // (BUG-HUNT FIX: odtegljaj ob ustvarjanju je lahko spodletel — prej je bilo
      // vračanje slepo in je napihnilo zalogo, ki ni bila nikoli odtegnjena)
      if (orderItem.order.inventoryDeducted) {
        const voidReason = data.voidReasonText || data.voidReasonId || 'Razlog ni naveden'
        await returnStockForVoidedItem(
          id, orderItem.menuItemId, orderItem.quantity,
          orderItem.menuItem.name, voidReason, orderItem.orderId,
          authResult.session?.employeeId,
        )
      }
    }

    // Check if all items in the order are ready — auto-update order status
    if (data.status === 'ready' || data.status === 'served') {
      const allItems = await db.orderItem.findMany({
        where: { orderId: orderItem.orderId },
        select: { status: true },
      })

      const allReady = allItems.every(item =>
        item.status === 'ready' || item.status === 'served'
      )

      if (allReady && orderItem.order.status !== 'ready') {
        await db.order.update({
          where: { id: orderItem.orderId },
          data: { status: 'ready' },
        })
      }
    }

    // WebSocket: obvesti KDS o spremembi statusa artikla
    if (data.status) {
      broadcastWS('ITEM_STATUS_CHANGED', {
        orderItemId: orderItem.id,
        orderId: orderItem.orderId,
        newStatus: data.status,
        menuItemName: orderItem.menuItem.name,
        // WS AUDIT: locationId za per-location dostavo (KDS druge lokacije ne vidi)
        locationId: orderItem.order.locationId ?? null,
      })
    }

    // Re-fetch za posodobljene podatke
    const updatedItem = await db.orderItem.findUnique({
      where: { id },
      include: { menuItem: true, order: { include: { table: true } } },
    })

    return NextResponse.json(deepToNumbers(updatedItem || orderItem))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/order-items/[id]', 'Napaka pri posodobitvi artikla naročila')
  }
}
