// ============================================
// POŠLJI LOW-STOCK OBVESTILO PREKO WEBSOCKET
// ============================================

import { getAppUrl } from '../utils'
import { emitStockLow } from '../event-emitter'
import { logger } from '../logger'

export async function broadcastLowStockAlert(
  alerts: Array<{ inventoryItemId: string; name: string; currentQty: number; minQty: number }>
) {
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

  try {
    await fetch(`${getAppUrl()}/api/ws-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'STOCK_LOW',
        payload: {
          alerts: alerts.map(a => ({
            inventoryItemId: a.inventoryItemId,
            name: a.name,
            currentQty: a.currentQty,
            minQty: a.minQty,
            severity: a.currentQty <= 0 ? 'out_of_stock' : 'low_stock',
          })),
          timestamp: new Date().toISOString(),
        },
      }),
    })
  } catch {
    // WS ni na voljo — tiho
  }
}
