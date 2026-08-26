import { logger } from '@/lib/logger'
import type { WSEventType } from './types'

// ============================================
// WS BROADCAST HELPER (za uporabo v API-jih)
// ============================================

/**
 * Pošlje WebSocket dogodek preko strežniškega broadcast-a
 * To funkcijo kličejo API rute, ko želijo obvestiti KDS odjemalce
 */
export async function broadcastWSEvent(type: WSEventType, payload: unknown): Promise<void> {
  try {
    await fetch('/api/ws-broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch (err: unknown) {
    logger.error('WS', 'Broadcast napaka:', err)
  }
}
