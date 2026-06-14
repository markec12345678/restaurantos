// ============================================
// EVENT EMITTER — Centralni sistem za sprožanje dogodkov
// Povezuje poslovno logiko z webhooki in integracijami
// Uporaba: emitEvent('order.paid', { orderId: '...', total: 42.50 })
// ============================================

import { logger } from '@/lib/logger'
import { triggerWebhook, type WebhookEventType } from '@/lib/webhook-engine'

// ============================================
// TIPI DOGODKOV IN NJIHOVI PAYLOADI
// ============================================

interface EventPayloadMap {
  'order.created': { orderId: string; orderNumber: number; type: string; tableId?: string; total: number }
  'order.updated': { orderId: string; changes: string[]; status: string }
  'order.paid': { orderId: string; orderNumber: number; total: number; paymentMethod: string; tip: number }
  'order.ready': { orderId: string; orderNumber: number }
  'order.cancelled': { orderId: string; orderNumber: number; reason: string }
  'order.delivered': { orderId: string; orderNumber: number; deliveryAddress: string }
  'payment.received': { paymentId: string; orderId: string; amount: number; type: string }
  'payment.refunded': { paymentId: string; orderId: string; amount: number; reason: string }
  'receipt.created': { receiptId: string; receiptNumber: string; orderId: string; total: number }
  'receipt.fiscal_verified': { receiptId: string; zoi: string; eor: string }
  'stock.low': { inventoryItemId: string; itemName: string; currentQty: number; minQty: number }
  'stock.critical': { inventoryItemId: string; itemName: string; currentQty: number; minQty: number }
  'stock.restocked': { inventoryItemId: string; itemName: string; newQty: number; previousQty: number }
  'shift.started': { shiftId: string; employeeName: string; jobName: string }
  'shift.ended': { shiftId: string; employeeName: string; totalMinutes: number }
  'cash_register.opened': { shiftId: string; employeeName: string; startingCash: number }
  'cash_register.closed': { shiftId: string; employeeName: string; totalSales: number; cashDifference: number }
  'reservation.created': { reservationId: string; customerName: string; dateTime: string; partySize: number }
  'reservation.cancelled': { reservationId: string; customerName: string; reason: string }
  'guest.created': { guestId: string; name: string; email: string }
  'loyalty.tier_upgraded': { loyaltyAccountId: string; customerName: string; oldTier: string; newTier: string }
  'daily_report.ready': { date: string; totalSales: number; totalOrders: number }
  'delivery.status_changed': { orderId: string; orderNumber: string; status: string; driverName: string; estimatedArrival: string | null }
  'delivery.driver_assigned': { deliveryInfoId: string; driverName: string; driverPhone: string }
  'tip_pool.distributed': { tipPoolId: string; totalTips: number; employeeCount: number }
  'z_report.generated': { reportId: string; date: string; totalSales: number }
  'z_report.finalized': { reportId: string; date: string; totalSales: number; finalizedBy: string }
  'integration.sync_failed': { integrationId: string; integrationName: string; error: string }
}

// ============================================
// GLAVNA FUNKCIJA
// ============================================

/**
 * Sproži dogodek v sistemu — pošlje webhookom in integracijam
 * 
 * Uporaba:
 *   await emitEvent('order.paid', { orderId: '...', orderNumber: 42, total: 25.50, paymentMethod: 'cash', tip: 2.00 })
 */
export async function emitEvent<E extends WebhookEventType & keyof EventPayloadMap>(
  event: E,
  data: EventPayloadMap[E]
): Promise<void> {
  // Sproži webhooke (ne blokiraj glavne logike)
  triggerWebhook(event, data as Record<string, unknown>).catch(err => {
    logger.error('EventEmitter', `Napaka pri sprožanju webhooka za ${event}:`, err)
  })

  // Dodatne akcije glede na tip dogodka
  // (npr. sinhronizacija z integracijami se obravnava ločeno)
}

// ============================================
// POMOŽNE FUNKCIJE ZA POSLOVNO LOGIKO
// ============================================

/**
 * Sproži dogodek ob ustvarjanju naročila
 */
export async function emitOrderCreated(params: {
  orderId: string
  orderNumber: number
  type: string
  tableId?: string
  total: number
}): Promise<void> {
  await emitEvent('order.created', params)
}

/**
 * Sproži dogodek ob plačilu naročila
 */
export async function emitOrderPaid(params: {
  orderId: string
  orderNumber: number
  total: number
  paymentMethod: string
  tip: number
}): Promise<void> {
  await emitEvent('order.paid', params)
}

/**
 * Sproži dogodek ob nizki zalogi
 */
export async function emitStockLow(params: {
  inventoryItemId: string
  itemName: string
  currentQty: number
  minQty: number
}): Promise<void> {
  // Loči med "low" in "critical"
  const isCritical = params.currentQty <= params.minQty * 0.25
  if (isCritical) {
    await emitEvent('stock.critical', params)
  } else {
    await emitEvent('stock.low', params)
  }
}

/**
 * Sproži dogodek ob ustvarjanju računa
 */
export async function emitReceiptCreated(params: {
  receiptId: string
  receiptNumber: string
  orderId: string
  total: number
}): Promise<void> {
  await emitEvent('receipt.created', params)
}

/**
 * Sproži dogodek ob davčnem potrjevanju računa (FURS)
 */
export async function emitReceiptFiscalVerified(params: {
  receiptId: string
  zoi: string
  eor: string
}): Promise<void> {
  await emitEvent('receipt.fiscal_verified', params)
}
