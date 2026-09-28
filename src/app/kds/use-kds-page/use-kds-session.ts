'use client'

import { useEffect, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

// ═══════════════════════════════════════════════════════════════
// KDS WebSocket — Povezava in poslušanje sporočil
// ═══════════════════════════════════════════════════════════════

// R151-c (FU-3): eksponentni backoff — min(1000·2^n, 30 s), kanon
// useDriverWs (WS_RECONNECT_BASE_MS/WS_RECONNECT_MAX_MS) in
// useWSConnect. Števec poskusov se resetira ob AUTH_SUCCESS, da mrežni
// blip sredi seje ne podeduje velike zakasnitve.
export const KDS_WS_RECONNECT_BASE_MS = 1000
export const KDS_WS_RECONNECT_MAX_MS = 30_000
// Ohrani obstoječo semantiko omejitve poskusov (prej fiksni 3 s × 30).
export const KDS_WS_RECONNECT_MAX_ATTEMPTS = 30

/** Zakasnitev n-tega reconnect poskusa (0-indeksiran) — čisti helper za teste */
export function kdsWsBackoffDelayMs(retries: number): number {
  return Math.min(KDS_WS_RECONNECT_BASE_MS * 2 ** retries, KDS_WS_RECONNECT_MAX_MS)
}

export interface ShouldConnectKdsWsInput {
  /** process.env.NODE_ENV (build-time inline v klient bundleju) */
  nodeEnv: string | undefined
  /** window.location.hostname konča z '.vercel.app' */
  isVercelHostname: boolean
  /** process.env.NEXT_PUBLIC_WS_DISABLED (KDS kanon izklop) */
  wsDisabledFlag: string | undefined
}

/**
 * R151-c: odločitev, ali se KDS sploh poveže na WS — vzorec useDriverWs
 * (shouldConnectWs, runda 12): next dev NIMA WS strežnika (server.js
 * produkciski-only) → v devu ne poskušaj (30×3 s retry šum), Vercel
 * serverless in NEXT_PUBLIC_WS_DISABLED='true' ostajata obstoječa izklopa.
 */
export function shouldConnectKdsWs(input: ShouldConnectKdsWsInput): boolean {
  if (input.nodeEnv !== 'production') return false
  if (input.isVercelHostname) return false
  if (input.wsDisabledFlag === 'true') return false
  return true
}

export function useKDSWebSocket(
  employee: { id: string; name: string; role: string } | null,
  playSound: () => void,
) {
  const queryClient = useQueryClient()
  const [wsConnected, setWsConnected] = useState(false)

  useEffect(() => {
    // R151-c: dev guard (runda 12 kanon, useDriverWs vzorec) + obstoječa
    // Vercel/flag izklopa. Polling prevzame osveževanje (glej useQuery
    // refetchInterval v use-kds-orders.ts).
    if (
      !shouldConnectKdsWs({
        nodeEnv: process.env.NODE_ENV,
        isVercelHostname:
          typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app'),
        wsDisabledFlag: process.env.NEXT_PUBLIC_WS_DISABLED,
      })
    ) {
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`
    let ws: WebSocket | null = null
    let retries = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    let disposed = false
    const scheduleReconnect = () => {
      if (disposed) return
      if (retries >= KDS_WS_RECONNECT_MAX_ATTEMPTS) return
      const delay = kdsWsBackoffDelayMs(retries)
      retries += 1
      timer = setTimeout(connect, delay)
    }
    const connect = () => {
      if (disposed) return
      try {
        ws = new WebSocket(wsUrl)
        ws.onopen = () => {
          setWsConnected(true); retries = 0
          // WS AUDIT: token poslan kot AUTH sporočilo (nikoli v URL-ju) + pravilen
          // format { type: 'AUTH', payload: { token } } — prej { type: 'AUTH', token }
          // ki ga server ni prepoznal (4002 Manjka žeton).
          const token = localStorage.getItem('pos_token') || sessionStorage.getItem('pos_auth_token')
          if (token) {
            ws?.send(JSON.stringify({ type: 'AUTH', payload: { token } }))
          }
        }
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            // FIX FASE 2: API pošilja uppercase (NEW_ORDER), klient je prej poslušal lowercase.
            // Normaliziraj na lowercase za konsistentnost.
            const msgType = (data.type || '').toLowerCase()
            // R151-c: uspešna avtentikacija → backoff nazaj na 1 s (useDriverWs
            // kanon) — kratek mrežni blip sredi seje ne podeduje 30 s zakasnitve.
            if (msgType === 'auth_success') {
              retries = 0
              return
            }
            if (msgType === 'new_order' || msgType === 'order_updated' || msgType === 'order_update' || msgType === 'item_status_changed' || msgType === 'item_status_update' || msgType === 'order_ready' || msgType === 'order_cancelled') {
              // Takoj invalidiraj KDS query — real-time refresh (ne čaka 5s polling)
              queryClient.invalidateQueries({ queryKey: queryKeys.orders.kds })
              if (msgType === 'new_order') {
                playSound()
                if (navigator.vibrate) navigator.vibrate([200, 100, 200])
              }
            }
          } catch {
            // Neveljavno sporočilo WebSocket — ignoriraj
          }
        }
        // R151-c: fiksni 3 s → eksponentni backoff min(1000·2^n, 30 s),
        // ohranjena omejitev 30 poskusov (scheduleReconnect).
        ws.onclose = () => { setWsConnected(false); ws = null; scheduleReconnect() }
        ws.onerror = () => { ws?.close() }
      } catch {
        // WebSocket povezava ni uspela — poskusi znova v onclose
      }
    }
    if (employee) connect()
    return () => {
      // R151-c: namerni cleanup ne sproži reconnecta (useDriverWs kanon) —
      // prej je unmount pustil živeče setTimeout(connect) po unmountu.
      disposed = true
      if (timer !== null) { clearTimeout(timer); timer = null }
      if (ws) {
        ws.onclose = null
        ws.onerror = null
        ws.close()
        ws = null
      }
    }
  }, [employee, playSound, queryClient])

  return { wsConnected }
}

// ═══════════════════════════════════════════════════════════════
// KDS Session & UI State — Obnova seje, timer, fullscreen
// ═══════════════════════════════════════════════════════════════

export function useKDSSession() {
  const [employee, setEmployee] = useState<{ id: string; name: string; role: string } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [now, setNow] = useState(Date.now())

  // FIX NAPAKA 8: Obnovi sejo — preveri več storage ključev za kompatibilnost
  // z glavno aplikacijo (pos_auth_user) in starejšimi sejami (pos_employee)
  useEffect(() => {
    try {
      // Poskusi najprej pos_employee (KDS-specifična seja)
      const storedKds = localStorage.getItem('pos_employee')
      if (storedKds) {
        const emp = JSON.parse(storedKds)
        if (emp?.id && emp?.name && emp?.role) {
          setEmployee(emp)
          return
        }
      }
      // FIX NAPAKA 8: Če uporabnik ni prijavljen v KDS, poskusi uporabiti sejo
      // iz glavne aplikacije (pos_auth_user) — omogoči seamless prehod iz POS → KDS
      const storedAuth = localStorage.getItem('pos_auth_user') || sessionStorage.getItem('pos_auth_user')
      if (storedAuth) {
        const authUser = JSON.parse(storedAuth)
        if (authUser?.id && authUser?.name && authUser?.role) {
          // Konvertiraj AuthUser v KDS employee format
          const kdsEmployee = {
            id: authUser.id,
            name: authUser.name,
            role: authUser.role,
          }
          // Shrani tudi v pos_employee za prihodnje obiske
          localStorage.setItem('pos_employee', JSON.stringify(kdsEmployee))
          setEmployee(kdsEmployee)
        }
      }
    } catch {
      // Poškodovani podatki v localStorage — ignoriraj in zahtevaj ponovno prijavo
    }
  }, [])

  // Timer
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [])

  // Celozaslonski način
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  const getElapsed = useCallback((dateStr: string | null) => {
    if (!dateStr) return 0
    return Math.floor((now - new Date(dateStr).getTime()) / 60000)
  }, [now])

  return { employee, setEmployee, isFullscreen, toggleFullscreen, getElapsed }
}
