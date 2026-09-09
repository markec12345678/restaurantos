// ============================================
// OBSERVABILITY — WebSocket metrike iz custom server-ja
// ============================================
// server.js (custom server, ločen proces) vzdržuje WS števce in jih
// izpostavi na /internal/ws-metrics (x-internal-secret = WS_BROADCAST_SECRET).
// Ta helper jih pripoji v monitoring ruthe (metrics + alerts), kadar
// custom server teče — v next dev/serverless izostanejo (graceful).
// ============================================

export interface WsMetrics {
  connectionsTotal: number
  connectionsActive: number
  disconnectsTotal: number
  /** Časovni žigi (epoch ms) zadnjih ~256 odklopov */
  disconnectsRecent?: number[]
  messagesReceived: number
  broadcastsSent: number
  lastDisconnectReason?: string
  processUptimeSeconds: number
}

/** Pridobi WS metrike iz custom server-ja (null, če ni na voljo). */
export async function fetchWsMetrics(): Promise<WsMetrics | null> {
  const secret = process.env.WS_BROADCAST_SECRET
  if (!secret) return null
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/internal/ws-metrics`, {
      headers: { 'x-internal-secret': secret },
      signal: AbortSignal.timeout(500),
    })
    if (!res.ok) return null
    return (await res.json()) as WsMetrics
  } catch {
    // Custom server ni zagnan (next dev / serverless) — WS metike izostanejo
    return null
  }
}

/** Prestej WS odklope v zadnjih `windowMs` (iz disconnectsRecent bufferja). */
export function countWsDisconnectsInWindow(ws: WsMetrics | null, windowMs: number): number {
  if (!ws?.disconnectsRecent?.length) return 0
  const cutoff = Date.now() - windowMs
  return ws.disconnectsRecent.filter(ts => ts >= cutoff).length
}
