// ============================================
// WEBHOOK ENGINE — Tipi in konstante
// Profesionalen sistem za zanesljivo dostavo webhookov
// ============================================

// ============================================
// TIPI
// ============================================

export type WebhookEventType =
  | 'order.created'
  | 'order.updated'
  | 'order.paid'
  | 'order.ready'
  | 'order.cancelled'
  | 'order.delivered'
  | 'payment.received'
  | 'payment.refunded'
  | 'receipt.created'
  | 'receipt.fiscal_verified'
  | 'stock.low'
  | 'stock.critical'
  | 'stock.restocked'
  | 'shift.started'
  | 'shift.ended'
  | 'cash_register.opened'
  | 'cash_register.closed'
  | 'reservation.created'
  | 'reservation.cancelled'
  | 'guest.created'
  | 'loyalty.tier_upgraded'
  | 'daily_report.ready'
  | 'delivery.status_changed'
  | 'delivery.driver_assigned'
  | 'tip_pool.distributed'
  | 'z_report.generated'
  | 'z_report.finalized'
  | 'integration.sync_failed'

export interface WebhookPayload {
  id: string
  event: WebhookEventType
  timestamp: string
  data: Record<string, unknown>
  restaurant?: {
    name: string
    id: string
  }
}

export interface DeliveryResult {
  success: boolean
  statusCode: number
  responseBody: string
  durationMs: number
}

// ============================================
// KONSTANTE
// ============================================

export const WEBHOOK_TIMEOUT_MS = 10_000 // 10 sekund timeout
export const MAX_RESPONSE_BODY_LENGTH = 1000 // Prvih 1000 znakov odziva
export const RETRY_DELAYS_MS = [60_000, 300_000, 900_000, 3_600_000, 10_800_000] // 1min, 5min, 15min, 1h, 3h
export const MAX_PAYLOAD_SIZE = 256 * 1024 // 256 KB max payload
