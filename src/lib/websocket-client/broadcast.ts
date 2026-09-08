import { wsBroadcastEvent } from '@/lib/ws-server-broadcast'
import type { WSEventType } from './types'

// ============================================
// WS BROADCAST HELPER (za uporabo v API-jih)
// ============================================

/**
 * Pošlji WebSocket dogodek prek strežniškega broadcast-a
 * To funkcijo kličejo API rute, ko želijo obvestiti KDS odjemalce
 *
 * WS AUDIT 2026-09-09: prej HTTP fetch na /api/ws-broadcast (dvojno pokvarjeno:
 * 401 zaradi manjkajoče Authorization glave + relativni URL je metal napako).
 * Zdaj: direkten globalThis.__wsBroadcast klic v istem procesu.
 */
export async function broadcastWSEvent(type: WSEventType, payload: unknown): Promise<void> {
  wsBroadcastEvent(type, (payload ?? null) as Record<string, unknown> | null)
}
