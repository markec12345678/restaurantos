// ============================================
// POŠLJI LOW-STOCK OBVESTILO PREKO WEBSOCKET
// ============================================

import { wsBroadcastEvent } from '@/lib/ws-server-broadcast'
import { emitStockLow } from '../event-emitter'
import { logger } from '../logger'

export interface LowStockAlertInput {
  inventoryItemId: string
  name: string
  currentQty: number
  minQty: number
  /** WS AUDIT 2026-09-09: lokacija inventory artikla — za per-location dostavo */
  locationId?: string | null
}

export function broadcastLowStockAlert(alerts: LowStockAlertInput[]) {
  if (alerts.length === 0) return

  // Webhook: stock.low / stock.critical
  for (const alert of alerts) {
    emitStockLow({
      inventoryItemId: alert.inventoryItemId,
      itemName: alert.name,
      currentQty: alert.currentQty,
      minQty: alert.minQty,
    }).catch(err => logger.error('StockDeduction', 'stock.low napaka:', err))
  }

  // WS AUDIT 2026-09-09: prej HTTP fetch na /api/ws-broadcast (401 — brez
  // Authorization glave, eventi so tiho poginili). Zdaj: direkten
  // globalThis.__wsBroadcast klic + locationId za per-location dostavo
  // (zaposleni druge lokacije ne vidijo tujih opozoril o zalogi).
  const payloadLocationId = alerts.find(a => a.locationId)?.locationId ?? null
  wsBroadcastEvent('STOCK_LOW', {
    alerts: alerts.map(a => ({
      inventoryItemId: a.inventoryItemId,
      name: a.name,
      currentQty: a.currentQty,
      minQty: a.minQty,
      locationId: a.locationId ?? null,
      severity: a.currentQty <= 0 ? 'out_of_stock' : 'low_stock',
    })),
    timestamp: new Date().toISOString(),
    locationId: payloadLocationId,
  })
}
