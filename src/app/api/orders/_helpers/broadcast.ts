// Pomožne funkcije za WebSocket broadcast in samodejni tisk

import { getAppUrl } from '@/lib/utils'
import { logger } from '@/lib/logger'

// Helper za WebSocket broadcast (varen klic — deluje tudi brez WS strežnika)
// FIX: prejšnja koda je tiho pregoltnila napake — KDS obvestila so izginila neopaženo.
// Sedaj logiramo napako, da je operater lahko zazna problem z WS strežnikom.
export async function broadcastWS(type: string, payload: unknown) {
  try {
    const res = await fetch(`${getAppUrl()}/api/ws-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
    if (!res.ok) {
      logger.warn('WS_BROADCAST', `HTTP ${res.status} pri broadcast (${type}) — WS strežnik morda nedosegljiv`)
    }
  } catch (error: unknown) {
    // WS strežnik ni na voljo — logiraj ampak ne prekini tokov
    logger.warn('WS_BROADCAST', `Napaka pri broadcast (${type}):`, error instanceof Error ? error.message : error)
  }
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
