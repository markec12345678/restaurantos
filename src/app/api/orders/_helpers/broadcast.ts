// Pomožne funkcije za WebSocket broadcast in samodejni tisk

import { getAppUrl } from '@/lib/utils'
import { wsBroadcastEvent } from '@/lib/ws-server-broadcast'
import { logger } from '@/lib/logger'

// Helper za WebSocket broadcast (varen klic — deluje tudi brez WS strežnika)
// WS AUDIT 2026-09-09: prej HTTP fetch na /api/ws-broadcast (401 — klici niso
// poslali Authorization glave, eventi so tiho poginili). Zdaj: direkten
// globalThis.__wsBroadcast klic v istem procesu custom serverja.
export function broadcastWS(type: string, payload: unknown) {
  wsBroadcastEvent(type, (payload ?? null) as Record<string, unknown> | null)
}

// Helper za samodejni tisk kuhinjskega naročila
export async function autoPrintKitchenOrder(order: Record<string, unknown>) {
  try {
    await fetch(`${getAppUrl()}/api/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'order', orderId: order.id }),
    })
  } catch (error: unknown) {
    // Tiskanje ni na voljo — logiraj kot info (ne kritično)
    logger.info('PRINT', `Samodejni tisk nedosegljiv za order ${order.id}:`, error instanceof Error ? error.message : error)
  }
}
