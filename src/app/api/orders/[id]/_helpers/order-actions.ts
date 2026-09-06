// Pomožne funkcije za posodabljanje naročil — akcije (broadcast, completion, cancellation)
//
// FIX P1 (audit 2026-09-06): handleOrderCancellation sedaj sprejme optional `tx`
// parameter. Če je podan, se vsi stranski učinki (freeTableIfNoActiveOrders,
// orderItem.updateMany, returnStockForOrder, createAuditLog) izvedejo ZNOTRAJ
// te transakcije — atomarno. Če ni podan, vsaka operacija odpre svojo lastno
// transakcijo (backward compat).
//

import { db, createAuditLog } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { returnStockForOrder, broadcastLowStockAlert } from '@/lib/stock-deduction'
import { getAppUrl } from '@/lib/utils'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

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
export async function freeTableIfNoActiveOrders(tableId: string, tx?: TransactionClient) {
  const run = async (client: TransactionClient) => {
    const count = await client.order.count({
      where: { tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
    })
    if (count === 0) {
      await client.table.update({ where: { id: tableId }, data: { status: 'available' } })
    }
  }
  if (tx) {
    await run(tx)
  } else {
    await db.$transaction(run)
  }
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
//
// FIX P1 (audit 2026-09-06): Če je `tx` podan, se vsi stranski učinki izvedejo
// znotraj te transakcije. To omogoča, da je order.updateMany + handleOrderCancellation
// + createAuditLog atomarno — če returnStockForOrder failne, se tudi order.updateMany
// roll-back-a in order ostane v prejšnjem statusu (namesto "cancelled but stock not returned").
//
export async function handleOrderCancellation(
  id: string, existingOrder: {
    tableId: string | null; orderNumber: number; inventoryDeducted: boolean;
  },
  cancelReason: string | undefined, employeeId?: string,
  tx?: TransactionClient,
) {
  // Webhook: order.cancelled — vedno izven transakcije (non-blocking, ne vpliva na konsistentnost)
  emitEvent('order.cancelled', {
    orderId: id, orderNumber: existingOrder.orderNumber,
    reason: cancelReason || 'Ni razloga',
  }).catch(err => logger.error('API', '[Webhook] order.cancelled napaka:', err))

  const runInside = async (client: TransactionClient) => {
    // Sprosti mizo atomarno
    if (existingOrder.tableId) {
      await freeTableIfNoActiveOrders(existingOrder.tableId, client)
    }

    await client.orderItem.updateMany({
      where: { orderId: id, status: { in: ['pending', 'preparing', 'ready'] } },
      data: { status: 'cancelled' },
    })

    // VRNI ZALOGO če je bila razknjižena
    if (existingOrder.inventoryDeducted) {
      const returnResult = await returnStockForOrder(
        id, existingOrder.orderNumber,
        cancelReason ? `PREKLIČENO: ${cancelReason}` : 'PREKLIČENO',
        client, // ← predamo outer tx
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
    }, client) // ← predamo tx
  }

  if (tx) {
    await runInside(tx)
  } else {
    // Backward-compat: če ni outer tx, vseeno poženemo v notranji transakciji
    // da ohranimo atomarnost med orderItem.updateMany in returnStockForOrder
    await db.$transaction(async (innerTx) => {
      await runInside(innerTx)
    })
  }

  // WS broadcast — izven transakcije (ne vpliva na konsistentnost)
  broadcastWS('ORDER_CANCELLED', {
    orderId: id, orderNumber: existingOrder.orderNumber,
    cancelReason: cancelReason || '',
  })
}
