// Pomožne funkcije za posodabljanje naročil
// PUT/PATCH/DELETE /api/orders/[id] — pomožni modul za statusne prehode in akcije

import { db, createAuditLog } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { returnStockForOrder, broadcastLowStockAlert } from '@/lib/stock-deduction'
import { getAppUrl } from '@/lib/utils'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'

// ─── Status transition state machine — prepreči nazadovanje statusa ───
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  'pending': ['in-progress', 'cancelled'],
  'in-progress': ['ready', 'cancelled'],
  'ready': ['completed', 'cancelled'],
  'completed': [], // Completed orders CANNOT change status (one-way)
  'cancelled': [],  // Cancelled orders CANNOT be revived
}

export const VALID_PAYMENT_TRANSITIONS: Record<string, string[]> = {
  'unpaid': ['partial', 'paid'],
  'partial': ['paid'],
  'paid': ['storno'],
  'storno': [],
}

// ─── Helper za WebSocket broadcast ───
export async function broadcastWS(type: string, payload: unknown) {
  try {
    await fetch(`${getAppUrl()}/api/ws-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch {
    // WS strežnik ni na voljo
  }
}

// ─── Sprosti mizo, če ni več aktivnih naročil ───
export async function freeTableIfNoActiveOrders(tableId: string) {
  await db.$transaction(async (tx) => {
    const count = await tx.order.count({
      where: { tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
    })
    if (count === 0) {
      await tx.table.update({ where: { id: tableId }, data: { status: 'available' } })
    }
  })
}

// ─── Obdelaj zaključek naročila (completed) ───
export async function handleOrderCompletion(
  id: string, existingOrder: {
    tableId: string | null; guestId: string | null;
    orderNumber: number;
  }
) {
  // Sprosti mizo ONLY if no other active orders remain
  // ZALOGA JE ŽE ODBITA ob ustvarjanju naročila — tu samo sprostimo mizo
  if (existingOrder.tableId) {
    const remainingActive = await db.order.count({
      where: {
        tableId: existingOrder.tableId,
        status: { in: ['pending', 'in-progress', 'ready'] },
        id: { not: id },
      },
    })
    if (remainingActive === 0) {
      await db.table.update({ where: { id: existingOrder.tableId }, data: { status: 'available' } })
    }
  }

  // Mark all items as served
  await db.orderItem.updateMany({
    where: { orderId: id, status: { in: ['pending', 'preparing', 'ready'] } },
    data: { status: 'served' },
  })

  // FIX MEDIUM: Posodobi statistiko gosta ob zaključku naročila
  if (existingOrder.guestId) {
    try {
      const completedOrders = await db.order.findMany({
        where: { guestId: existingOrder.guestId, status: 'completed', paymentStatus: 'paid' },
        select: { total: true, tip: true, createdAt: true },
      })
      const totalVisits = completedOrders.length
      const totalSpent = completedOrders.reduce((s, o) => s + toNum(o.total), 0)
      const avgCheckAmount = totalVisits > 0 ? totalSpent / totalVisits : 0
      const lastVisitAt = completedOrders.length > 0
        ? completedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
        : null
      const firstVisitAt = completedOrders.length > 0
        ? completedOrders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0].createdAt
        : null

      await db.guest.update({
        where: { id: existingOrder.guestId },
        data: {
          totalVisits, totalSpent: Math.round(totalSpent * 100) / 100,
          avgCheckAmount: Math.round(avgCheckAmount * 100) / 100,
          lastVisitAt, firstVisitAt,
        },
      })
    } catch (guestErr: unknown) {
      logger.error('API', 'Napaka pri posodabljanju statistike gosta:', guestErr)
    }
  }
}

// ─── Obdelaj preklic naročila (cancelled) ───
export async function handleOrderCancellation(
  id: string, existingOrder: {
    tableId: string | null; orderNumber: number; inventoryDeducted: boolean;
  },
  cancelReason: string | undefined, employeeId?: string
) {
  // Webhook: order.cancelled
  emitEvent('order.cancelled', {
    orderId: id, orderNumber: existingOrder.orderNumber,
    reason: cancelReason || 'Ni razloga',
  }).catch(err => logger.error('API', '[Webhook] order.cancelled napaka:', err))

  // FIX: Race condition — sprosti mizo atomarno
  if (existingOrder.tableId) {
    await freeTableIfNoActiveOrders(existingOrder.tableId)
  }

  await db.orderItem.updateMany({
    where: { orderId: id, status: { in: ['pending', 'preparing', 'ready'] } },
    data: { status: 'cancelled' },
  })

  // VRNI ZALOGO če je bila razknjižena
  if (existingOrder.inventoryDeducted) {
    const returnResult = await returnStockForOrder(
      id, existingOrder.orderNumber,
      cancelReason ? `PREKLIČENO: ${cancelReason}` : 'PREKLIČENO'
    )
    if (returnResult.lowStockAlerts.length > 0) {
      broadcastLowStockAlert(returnResult.lowStockAlerts)
    }
  }

  // Revizijski dnevnik: preklic naročila
  await createAuditLog({
    userId: employeeId,
    action: 'CANCEL_ORDER',
    entityType: 'Order',
    entityId: id,
    details: { orderNumber: existingOrder.orderNumber, cancelReason, stockReturned: existingOrder.inventoryDeducted },
  })

  broadcastWS('ORDER_CANCELLED', {
    orderId: id, orderNumber: existingOrder.orderNumber,
    cancelReason: cancelReason || '',
  })
}

// ─── Obdelaj item_status akcijo (PATCH) ───
export async function handleItemStatusUpdate(
  id: string, itemId: string, status: string,
  order: { id: string; status: string; orderNumber: number }
) {
  if (order.status === 'cancelled') {
    return { error: 'Preklicano naročilo ni mogoče spreminjati', status: 400 }
  }

  // FIX HIGH: Preveri, da OrderItem pripada temu naročilu
  const orderItem = await db.orderItem.findUnique({ where: { id: itemId } })
  if (!orderItem || orderItem.orderId !== id) {
    return { error: 'Artikel ne pripada temu naročilu', status: 400 }
  }

  await db.orderItem.update({ where: { id: itemId }, data: { status } })

  const updatedItem = await db.orderItem.findUnique({
    where: { id: itemId }, include: { menuItem: { select: { name: true } } },
  })

  // Preveri ali so vsi itemi ready/served/cancelled
  const allItems = await db.orderItem.findMany({ where: { orderId: id } })
  const allReady = allItems.every(i => ['ready', 'served', 'cancelled'].includes(i.status))
  const allServed = allItems.every(i => ['served', 'cancelled'].includes(i.status))

  // Auto-promote: ko so vsi itemi READY, naročilo postane READY
  if (allReady && order.status !== 'ready' && order.status !== 'completed') {
    await db.order.update({ where: { id }, data: { status: 'ready' } })
  }

  // Auto-promote: ko so vsi itemi SERVED, naročilo je pripravljeno za plačilo
  if (allServed && order.status !== 'completed') {
    await db.order.update({ where: { id }, data: { status: 'ready' } })
  }

  // ─── Broadcast za KDS ───
  broadcastWS('ITEM_STATUS_UPDATE', {
    orderId: id, orderNumber: order.orderNumber, itemId, status,
  })

  // ─── Obvestilo za natakarja ko je artikel PRIPRAVLJEN ───
  if (status === 'ready' && updatedItem) {
    try {
      const fullOrder = await db.order.findUnique({
        where: { id },
        include: {
          table: true,
          orderItems: { where: { status: 'ready' }, include: { menuItem: { select: { name: true } } } },
        },
      })
      const readyItems = (fullOrder?.orderItems || []).map(i => ({ name: i.menuItem?.name || 'Artikel', quantity: i.quantity }))
      const totalItems = allItems.filter(i => i.status !== 'cancelled').length
      const readyCount = allItems.filter(i => ['ready', 'served'].includes(i.status)).length

      await fetch(`${getAppUrl()}/api/ws-broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'order_ready', channel: 'pos',
          data: {
            orderId: id, orderNumber: order.orderNumber,
            tableName: fullOrder?.table?.number?.toString() || null,
            tableNumber: fullOrder?.table?.number || null,
            waiterName: fullOrder?.customerName || null,
            waiterId: fullOrder?.employeeId || null,
            itemName: updatedItem?.menuItem?.name || 'Neznan artikel',
            itemQuantity: updatedItem.quantity,
            allReady, readyCount, totalItems, readyItems,
          },
        }),
      })
    } catch { /* broadcast ni kritičen */ }
  }

  return { success: true, allReady, allServed }
}
