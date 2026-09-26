'use client'

// =====================================================================
// useDriverWs — WS push naročnina voznika (R139, epic #115 dopolnitev).
//
// Strežniški dogodki (server.js, isti proces) → coarse refetch signal:
//   DELIVERY_UPDATED { deliveryInfoId, reason, status, locationId }
//   NEW_ORDER        { ..., type: 'delivery', locationId }  (obstoječ —
//                     wolt/bolt/online-order že broadcastajo; nova
//                     dostava za prevzem = ta signal)
// Payload je NAMERNA coarse: ids/status/locationId, NIKOLI PII — voznik
// podatke vedno potegne prek GET /api/delivery/assignments (whitelist,
// integracijsko testirano). Stanje se IZ WS payloada NIKOLI ne nastavlja.
//
// Kanon: use-kds-session.ts (URL + AUTH format + Vercel izklop),
// useWSConnect.ts (eksponentni backoff min(1000·2^n, 30 s)),
// driver-context.ts (triple-shramba žetona). Žeton NIKOLI v URL —
// strežnik take handshakes BLOKIRA z 401 (ws-core detectTokenInHandshakeUrl).
//
// Polling (useDriverAssignments, 15 s) ostaja NESPREMENJEN kot fallback —
// WS samo pospeši refetch (NotificationCenter vzorec). V devu (next dev)
// se WS ne povezuje: produkciski-only (runda 12 — server.js dev RSC
// hidracija pokvarjena; next dev nima /ws upgrade handlerja).
// =====================================================================

import { useEffect, useRef } from 'react'
import { getStoredToken } from './driver-context'

export const WS_RECONNECT_BASE_MS = 1000
export const WS_RECONNECT_MAX_MS = 30_000

// --- čisti helperji (izvoženi za testiranje — R138 vzorec) ---

export interface ShouldConnectWsInput {
  /** process.env.NODE_ENV (build-time inline v klient bundleju) */
  nodeEnv: string | undefined
  /** window.location.hostname konča z '.vercel.app' */
  isVercelHostname: boolean
  /** process.env.NEXT_PUBLIC_WS_DISABLED (KDS kanon izklop) */
  wsDisabledFlag: string | undefined
  /** obstaja veljaven žeton (getStoredToken()) */
  hasToken: boolean
}

/**
 * Odločitev, ali se voznikov zaslon sploh poveže na WS.
 * false: dev build (next dev nima WS strežnika — runda 12),
 *        Vercel serverless (brez custom serverja),
 *        NEXT_PUBLIC_WS_DISABLED='true', brez žetona.
 */
export function shouldConnectWs(input: ShouldConnectWsInput): boolean {
  if (input.nodeEnv !== 'production') return false
  if (input.isVercelHostname) return false
  if (input.wsDisabledFlag === 'true') return false
  return input.hasToken
}

/**
 * Je sporočilo relevantno za voznika? Samo 2 tipa sprožita refetch:
 * DELIVERY_UPDATED (vedno) in NEW_ORDER z payload.type === 'delivery'
 * (nova dostava za prevzem — dine-in/takeout NEW_ORDER voznika ne zanima).
 * Malformirani vnosi → false (tiho ignorirani).
 */
export function isDriverRelevantEvent(type: unknown, payload: unknown): boolean {
  if (typeof type !== 'string') return false
  if (type === 'DELIVERY_UPDATED') return true
  if (type === 'NEW_ORDER') {
    return (
      !!payload &&
      typeof payload === 'object' &&
      (payload as { type?: unknown }).type === 'delivery'
    )
  }
  return false
}

interface UseDriverWsOptions {
  /** Refetch klic (useDriverAssignments refresh — fetchSeq dedupe prepreči dupe) */
  onSignal: () => void
  /** false (odjava) → cleanup povezave; true → (re)connect */
  enabled: boolean
}

/**
 * WS naročnina brez lastnega state-a (state-free hook): ob relevantnem
 * dogodku samo pokliče onSignal(). Reconnect z eksponentnim backoffom;
 * retries se resetirajo ob AUTH_SUCCESS (4003 po restartu strežnika se
 * pozdravi sam — naslednji REST poll sinhronizira wsSessions store).
 */
export function useDriverWs({ onSignal, enabled }: UseDriverWsOptions): void {
  const onSignalRef = useRef(onSignal)
  useEffect(() => {
    onSignalRef.current = onSignal
  }, [onSignal])

  useEffect(() => {
    if (!enabled) return
    if (
      !shouldConnectWs({
        nodeEnv: process.env.NODE_ENV,
        isVercelHostname:
          typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app'),
        wsDisabledFlag: process.env.NEXT_PUBLIC_WS_DISABLED,
        hasToken: !!getStoredToken(),
      })
    ) {
      return
    }

    let ws: WebSocket | null = null
    let retries = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    let disposed = false

    const scheduleReconnect = () => {
      if (disposed) return
      const delay = Math.min(WS_RECONNECT_BASE_MS * 2 ** retries, WS_RECONNECT_MAX_MS)
      retries += 1
      timer = setTimeout(connect, delay)
    }

    const connect = () => {
      if (disposed) return
      // žeton NIKOLI v URL (strežnik blokira handshake z 401 — ws-core)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      try {
        ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
      } catch {
        scheduleReconnect()
        return
      }
      ws.onopen = () => {
        const token = getStoredToken()
        if (!token) {
          ws?.close()
          return
        }
        // WS AUDIT format: { type: 'AUTH', payload: { token } } (KDS kanon)
        ws?.send(JSON.stringify({ type: 'AUTH', payload: { token } }))
      }
      ws.onmessage = (event: MessageEvent<string>) => {
        let msg: unknown
        try {
          msg = JSON.parse(event.data)
        } catch {
          return
        }
        if (!msg || typeof msg !== 'object') return
        const rec = msg as Record<string, unknown>
        if (rec.type === 'AUTH_SUCCESS') {
          retries = 0 // povezava + avtentikacija OK — backoff nazaj na 1 s
          return
        }
        // CONNECTED greeting / AUTH_REQUIRED / pong / RATE_LIMITED / tuji
        // tipi (KDS, NotificationCenter) → ignorirani; stanje IZ payloada
        // se NIKOLI ne nastavlja — samo refetch signal.
        if (isDriverRelevantEvent(rec.type, rec.payload)) {
          onSignalRef.current()
        }
      }
      ws.onclose = () => {
        ws = null
        scheduleReconnect()
      }
      ws.onerror = () => {
        ws?.close()
      }
    }

    connect()

    return () => {
      disposed = true
      if (timer !== null) clearTimeout(timer)
      if (ws) {
        ws.onclose = null // namerni cleanup ne sproži reconnecta
        ws.onerror = null
        ws.close()
        ws = null
      }
    }
  }, [enabled])
}
