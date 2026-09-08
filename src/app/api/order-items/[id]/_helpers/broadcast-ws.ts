// WebSocket broadcast helper

import { wsBroadcastEvent } from '@/lib/ws-server-broadcast'

// Helper za WebSocket broadcast
// WS AUDIT 2026-09-09: prej HTTP fetch na /api/ws-broadcast (401 — brez
// Authorization glave). Zdaj: direkten globalThis.__wsBroadcast klic.
export function broadcastWS(type: string, payload: unknown) {
  wsBroadcastEvent(type, (payload ?? null) as Record<string, unknown> | null)
}
