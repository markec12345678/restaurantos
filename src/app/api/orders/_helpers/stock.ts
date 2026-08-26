// Pomožne funkcije za razknjiževanje zaloge in stranske učinke po ustvarjanju naročila

import { db, createAuditLog } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { deductStockForOrder, broadcastLowStockAlert } from '@/lib/stock-deduction'
import { emitOrderCreated } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { broadcastWS, autoPrintKitchenOrder } from './broadcast'
import { notifyNewOrder } from '@/lib/push/notifications'

// Tip za podatke naročila za post-creation efekti
export interface PostCreationOrderData {
  id: string
  orderNumber: number
  type: string
  tableId: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  total: any
}

// Samodejno razknjiževanje zaloge ob oddaji naročila
export async function handleStockDeduction(
  orderId: string,
  orderNumber: number,
  orderItems: Array<{ menuItemId: string; quantity: number }>,
): Promise<{ stockDeducted: boolean }> {
  let stockDeducted = false
  try {
    const stockResult = await deductStockForOrder(orderId, orderNumber, orderItems)
    stockDeducted = true
    await db.order.update({ where: { id: orderId }, data: { inventoryDeducted: true } })
    if (stockResult.lowStockAlerts.length > 0) {
      broadcastLowStockAlert(stockResult.lowStockAlerts)
    }
  } catch (stockError: unknown) {
    logger.error('API', `[STOCK] Napaka pri razknjiževanju zaloge za naročilo ${orderNumber}`, stockError)
  }
  return { stockDeducted }
}

// Obdelaj stranske učinke po ustvarjanju naročila (WS, tisk, webhook, revizija)
export async function handlePostCreationEffects(
  order: PostCreationOrderData,
  employeeId: string | null | undefined,
  stockDeducted: boolean,
): Promise<void> {
  broadcastWS('NEW_ORDER', {
    orderId: order.id, orderNumber: order.orderNumber,
    type: order.type, tableId: order.tableId, total: toNum(order.total),
  })

  autoPrintKitchenOrder(order as unknown as Record<string, unknown>)

  // FIX: Pošlji push notification kuharjem in natakarjem o novem naročilu
  const tableNum = order.tableId ? await getTableNumber(order.tableId) : null
  notifyNewOrder(order.orderNumber, tableNum, 0).catch(err =>
    logger.warn('PUSH', 'Napaka pri push notification za novo naročilo:', err)
  )

  emitOrderCreated({
    orderId: order.id, orderNumber: order.orderNumber,
    type: order.type, tableId: order.tableId || undefined, total: toNum(order.total),
  }).catch(err => logger.error('API', '[Webhook] order.created napaka:', err))

  await createAuditLog({
    userId: employeeId || undefined,
    action: 'CREATE_ORDER',
    entityType: 'Order',
    entityId: order.id,
    details: { orderNumber: order.orderNumber, total: toNum(order.total), type: order.type, tableId: order.tableId, inventoryDeducted: stockDeducted },
  })
}

// Helper za pridobitev številke mize
async function getTableNumber(tableId: string): Promise<number | null> {
  try {
    const table = await db.table.findUnique({
      where: { id: tableId },
      select: { number: true },
    })
    return table?.number || null
  } catch {
    return null
  }
}
