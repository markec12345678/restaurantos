// POST /api/orders/[id]/add-items — Dodaj artikle k obstoječemu naročilu

import { db, createAuditLog } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { addOrderItemsSchema } from '@/lib/validations'
import { broadcastLowStockAlert, checkStockAvailability } from '@/lib/stock-deduction'
import { wsBroadcastEvent } from '@/lib/ws-server-broadcast'
import { parseJsonBody, validateBody } from '@/lib/api-utils'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { structuredErrorResponse } from '@/lib/structured-error'
import { addItemsToOrder } from '../_helpers/order-mutations'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(addOrderItemsSchema, bodyResult.data)
    if (validationError) return validationError

    // FIX P0-C1 (IDOR) + FIX R86-2a (M2 fail-open): centralni resolver
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/orders/[id]/add-items',
    })
    if ('error' in scope) return scope.error

    // FIX R81-F (WRITE IDOR): fast-path scoped lookup — izven scope-a → 404
    // (zgodnja stopnica; R108 OR-1: dejanski pisalni tok je v kanonu
    // addItemsToOrder() s tx-fresh scoped re-readom — ta read je SAMO
    // zgodnja 404 stopnica + vir orderNumber za broadcast/audit).
    const order = await db.order.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      select: { id: true, orderNumber: true, status: true, updatedAt: true, locationId: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    // FIX Test 6.3: Optimistic locking — preveri da order ni bil spremenjen
    // (klient-space preverba; R108 kanon uveljavlja prave invariante pod
    // ključavnico + Serializable)
    if (data.expectedUpdatedAt) {
      const clientUpdatedAt = new Date(data.expectedUpdatedAt).getTime()
      const serverUpdatedAt = new Date(order.updatedAt).getTime()
      if (Math.abs(clientUpdatedAt - serverUpdatedAt) > 1000) {
        return NextResponse.json({
          error: 'Naročilo je bilo spremenjeno s strani drugega uporabnika. Osvežite in poskusite znova.',
          conflict: true,
          serverUpdatedAt: order.updatedAt.toISOString(),
          clientUpdatedAt: data.expectedUpdatedAt,
        }, { status: 409 })
      }
    }

    // R108 OR-1/OR-1b/OR-3 (HIGH, kanon R106/R107): Pisalni tok V ENEM kanonu
    // — $transaction(Serializable) + pg_advisory_xact_lock('order-write:'+id)
    // + tx-fresh scoped re-read + status CAS proti svežim podatkom + totals
    // iz TX-FRESH seznama artiklov (lost update na totals = PODRAČUNAVANJE,
    // prej nemogoč preprečiti) + razknjižba zaloge V ISTI transakciji (prej:
    // ločena tx → crash = artikli brez odbitka zaloge). Strukturirani
    // { error, status } throw-i → structuredErrorResponse.
    // R124 (P0-03, kanon): STREŽNIŠKA BLOKADA izprodanih artiklov — prej
    // add-items NI imel nobene preverbe zaloge (dedukcija je logirala
    // napako in dodala artikli vseeno → oversell). Eksplicitno dovoljenje
    // = data.allowOutOfStock (fail-closed default false). Isti kontrakt
    // kot POST /api/orders: 409 + soldOutItems.
    const stockCheck = await checkStockAvailability(
      data.orderItems.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      }))
    )
    if (stockCheck.warnings.length > 0 && !data.allowOutOfStock) {
      const soldOutMap = new Map<string, typeof stockCheck.warnings[number]>()
      for (const w of stockCheck.warnings) {
        const prev = soldOutMap.get(w.menuItemId)
        if (!prev || w.available < prev.available) soldOutMap.set(w.menuItemId, w)
      }
      const soldOutItems = Array.from(soldOutMap.values())
      const names = soldOutItems.map(i => i.itemName).join(', ')
      return NextResponse.json(
        {
          error: `Artikli brez zadostne zaloge: ${names}. Zaloga se je spremenila — odstranite izprodane artikle ali uporabite odobritev prodaje.`,
          soldOutItems: soldOutItems.map(i => ({
            menuItemId: i.menuItemId,
            itemName: i.itemName,
            ingredientName: i.ingredientName,
            needed: i.needed,
            available: i.available,
            unit: i.unit,
          })),
        },
        { status: 409 }
      )
    }

    const result = await addItemsToOrder({
      orderId: id,
      locationId: scope.locationId,
      orderItems: data.orderItems,
    })

    // Pošlji low-stock opozorila če so (WS — izven tx)
    if (result.stockResult.lowStockAlerts.length > 0) {
      broadcastLowStockAlert(result.stockResult.lowStockAlerts)
    }

    // FIX: Broadcast to KDS/POS — kitchen needs to know about added items!
    // WS AUDIT 2026-09-09: direkten globalThis klic (prej HTTP fetch 401)
    wsBroadcastEvent('ORDER_UPDATED', {
      orderId: id,
      orderNumber: result.orderNumber,
      action: 'add-items',
      addedCount: result.created.length,
      // WS AUDIT: locationId za per-location dostavo
      locationId: result.orderLocationId ?? null,
    })

    // Pridobi posodobljeno naročilo
    // FIX P0-C1 (IDOR): Tudi za vračanje posodobljenega naročila uporabi locationId scope
    const updatedOrder = await db.order.findFirst({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      include: {
        table: true,
        orderItems: { include: { menuItem: true } },
      },
    })

    // Revizijski dnevnik
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'ADD_ITEMS_TO_ORDER',
      entityType: 'Order',
      entityId: id,
      details: {
        orderNumber: result.orderNumber,
        addedCount: result.created.length,
        stockDeducted: result.stockResult.deducted.length,
      },
    })

    return NextResponse.json(deepToNumbers({
      order: updatedOrder,
      addedItems: result.created.length,
      _stockInfo: {
        deducted: result.stockResult.deducted.length,
        lowStockWarnings: result.stockResult.lowStockAlerts,
      },
    }))
  } catch (error: unknown) {
    // R108 (error kontrakt): P2002/P2034 race-pathi → 409 (nikoli 500);
    // strukturirani { error, status } throw-i iz tx teles (404/400) → pravi
    // statusi (prej: string-matching handleRouteError + `throw new Error`
    // iz tx telesa → 500 '[object Object]').
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Naročilo je v obdelavi (sočasen dostop) — osvežite in poskusite znova' },
        { status: 409 }
      )
    }
    return structuredErrorResponse(error, 'POST /api/orders/[id]/add-items', 'Napaka pri dodajanju artiklov')
  }
}
