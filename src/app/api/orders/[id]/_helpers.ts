// Pomožne funkcije za posodabljanje naročil
// PUT/PATCH/DELETE /api/orders/[id] — pomožni modul za statusne prehode in akcije

import { db, createAuditLog } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { returnStockForOrder, broadcastLowStockAlert } from '@/lib/stock-deduction'
import { getAppUrl } from '@/lib/utils'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'

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

// Preveri veljavnost prehoda statusa in plačilnega statusa
export function validateOrderTransitions(
  existingOrder: { status: string; paymentStatus: string },
  data: { status?: string; paymentStatus?: string },
): NextResponse | null {
  if (data.status && data.status !== existingOrder.status) {
    const allowedTransitions = VALID_STATUS_TRANSITIONS[existingOrder.status] || []
    if (!allowedTransitions.includes(data.status)) {
      return NextResponse.json(
        { error: `Prehod iz '${existingOrder.status}' v '${data.status}' ni dovoljen. Dovoljeni: [${allowedTransitions.join(', ')}]` },
        { status: 400 }
      )
    }
  }

  if (data.paymentStatus && data.paymentStatus !== existingOrder.paymentStatus) {
    const allowed = VALID_PAYMENT_TRANSITIONS[existingOrder.paymentStatus] || []
    if (!allowed.includes(data.paymentStatus)) {
      return NextResponse.json(
        { error: `Plačilni prehod iz '${existingOrder.paymentStatus}' v '${data.paymentStatus}' ni dovoljen` },
        { status: 400 }
      )
    }
  }

  return null
}
