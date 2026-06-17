
// PUT /api/order-items/[id] — Update individual order item (status, void, etc.)
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateOrderItemSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { broadcastWS, recalculateOrderTotals, recalculateCheckTotals, returnStockForVoidedItem } from './_helpers'


export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(updateOrderItemSchema, bodyResult.data)
    if (validationError) return validationError

    // FIX V3: Loči void od status update — kuhar lahko spremeni status (take_orders),
    // void pa zahteva void_item dovoljenje (omejen nabor zaposlenih)
    const isVoidOperation = data.voided === true
    const requiredPermission = isVoidOperation ? 'void_item' : 'take_orders'
    const authResult = await requireAuth(req, { permission: requiredPermission })
    if (authResult.error) return authResult.error

    const updateData: Record<string, unknown> = {}
    if (data.status) updateData.status = data.status
    if (data.notes !== undefined) updateData.notes = data.notes

    // === VOID OPERACIJA ===
    if (data.voided === true) {
      const existingItem = await db.orderItem.findUnique({ where: { id } })
      if (existingItem?.voided) {
        return NextResponse.json({ error: 'Artikel je že bil voidan' }, { status: 409 })
      }
      updateData.voided = true
      if (data.voidReasonId) updateData.voidReasonId = data.voidReasonId
      updateData.status = 'voided'
    }

    const orderItem = await db.orderItem.update({
      where: { id },
      data: updateData,
      include: { menuItem: true, order: { include: { table: true } } },
    })

    // Če je void, preračunaj zneske naročila
    if (data.voided === true) {
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

      // Vrni zalogo za voidan artikel
      const voidReason = data.voidReasonText || data.voidReasonId || 'Razlog ni naveden'
      await returnStockForVoidedItem(
        id, orderItem.menuItemId, orderItem.quantity,
        orderItem.menuItem.name, voidReason, orderItem.orderId,
        authResult.session?.employeeId,
      )
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
