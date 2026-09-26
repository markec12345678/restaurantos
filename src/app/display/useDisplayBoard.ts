'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DisplayOrder, DisplayOrderStatus, RawDisplayBoardResponse } from './types'

// =====================================================================
// HOOK: display tabla — GET /api/public/display?locationId=<loc> (R136-b)
//  - poll 10 s (setInterval) + takojšen refetch ob focus / visibilitychange
//    'visible' (tabla v ozadju/ugasnjen zaslon → takoj ob vrnitvi v vidnost)
//  - fetchSeq ref-guard proti race-u (kiosk vzor): aborted/ignored odgovori
//    ne postavljajo stanja
//  - stale-while-error: napaka obdrži zadnje uspešno stanje (orders+timestamp),
//    samo connected=false — tabla nikoli ne utripne v prazno
//  - self-heal: 5 zaporednih napak → window.location.reload() (tabla mora
//    delovati nedoločeno — reload reši morebne izgubljene seje/puščice)
//  - 404 → configError (fail-closed lokacija: ne obstaja/neaktivna/format)
// Normalizacija na meji (kiosk vzor): orderNumber String(), status whitelist,
// createdAt MORA biti parseable — pokvarjen vnos se odstrani, ne upodobi.
// =====================================================================

export const DISPLAY_POLL_INTERVAL_MS = 10_000
export const DISPLAY_SELF_HEAL_ERROR_LIMIT = 5

const KNOWN_STATUSES: readonly string[] = ['pending', 'in-progress', 'ready']

function normalizeStatus(val: unknown): DisplayOrderStatus {
  return typeof val === 'string' && KNOWN_STATUSES.includes(val)
    ? (val as DisplayOrderStatus)
    : 'unknown'
}

function normalizeOrder(raw: unknown): DisplayOrder | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  if (rec.orderNumber === undefined || rec.orderNumber === null) return null
  // createdAt MORA biti razumljiv datum (brez njega ni "oddano X min nazaj")
  const createdAt = typeof rec.createdAt === 'string' ? rec.createdAt : ''
  if (!createdAt || Number.isNaN(new Date(createdAt).getTime())) return null
  const tableRaw = rec.tableNumber
  const tableNumber =
    typeof tableRaw === 'number' && Number.isFinite(tableRaw)
      ? tableRaw
      : typeof tableRaw === 'string' && tableRaw.trim() !== '' && !Number.isNaN(Number(tableRaw))
        ? Number(tableRaw)
        : null
  return {
    orderNumber: String(rec.orderNumber),
    status: normalizeStatus(rec.status),
    type: typeof rec.type === 'string' ? rec.type : '',
    tableNumber,
    createdAt,
  }
}

function normalizeResponse(data: unknown): DisplayOrder[] {
  const rec = data && typeof data === 'object' ? (data as RawDisplayBoardResponse) : null
  if (!rec || !Array.isArray(rec.orders)) return []
  return rec.orders.flatMap(o => {
    const order = normalizeOrder(o)
    return order ? [order] : []
  })
}

function extractTimestamp(data: unknown): string {
  const rec = data && typeof data === 'object' ? (data as RawDisplayBoardResponse) : null
  if (rec && typeof rec.timestamp === 'string' && !Number.isNaN(new Date(rec.timestamp).getTime())) {
    return rec.timestamp
  }
  return new Date().toISOString()
}

export interface DisplayBoardState {
  orders: DisplayOrder[]
  /** ISO timestamp zadnjega uspešnega odgovora (strežniški, fallback lokalen) */
  timestamp: string | null
  /** true, ko je zadnji fetch uspel (stale-while-error: false obdrži podatke) */
  connected: boolean
  /** true do PRVEGA odgovora (uspešnega ali napake) — Connecting zaslon */
  isLoading: boolean
  /** 404 (neznana/neaktivna/napačna lokacija) → ConfigError zaslon */
  configError: boolean
}

export function useDisplayBoard(locationId: string | null, enabled: boolean): DisplayBoardState {
  const [orders, setOrders] = useState<DisplayOrder[]>([])
  const [timestamp, setTimestamp] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [configError, setConfigError] = useState(false)
  const fetchSeq = useRef(0)
  const consecutiveErrors = useRef(0)

  const refresh = useCallback(async (): Promise<void> => {
    const seq = ++fetchSeq.current
    if (!locationId) return
    try {
      // Relativen fetch (hišno pravilo) — brez absolutnih URL-jev
      const res = await fetch(`/api/public/display?locationId=${encodeURIComponent(locationId)}`)
      if (seq !== fetchSeq.current) return // zastarel/abortiran odgovor — brez state
      if (res.status === 404) {
        // Fail-closed lokacija (ne obstaja/neaktivna/napačen format) — config napaka
        setConfigError(true)
        setIsLoading(false)
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: unknown = await res.json()
      if (seq !== fetchSeq.current) return
      consecutiveErrors.current = 0
      setOrders(normalizeResponse(data))
      setTimestamp(extractTimestamp(data))
      setConnected(true)
      setIsLoading(false)
    } catch {
      if (seq !== fetchSeq.current) return
      // stale-while-error — obdrži zadnje uspešno stanje, samo pika ugasne
      consecutiveErrors.current += 1
      setConnected(false)
      setIsLoading(false)
      if (consecutiveErrors.current >= DISPLAY_SELF_HEAL_ERROR_LIMIT) {
        // Self-heal: 5 zaporednih napak (~50 s) → reload (nedoločeno delovanje)
        window.location.reload()
      }
    }
  }, [locationId])

  // Poll 10 s + takojšen refetch ob focus / visibilitychange 'visible'
  // (qr-menu use-effects vzor; cleanup počisti interval + listenere)
  useEffect(() => {
    if (!enabled || !locationId) return
    // await v async IIFE — vsi setState so v async continuation
    // (react-hooks/set-state-in-effect kanon)
    void (async () => {
      await refresh()
    })()
    const interval = setInterval(() => {
      void refresh()
    }, DISPLAY_POLL_INTERVAL_MS)
    const refetch = () => {
      void refresh()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    window.addEventListener('focus', refetch)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', refetch)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, locationId, refresh])

  return {
    orders,
    timestamp,
    connected,
    isLoading,
    // brez lokacije = config napaka (izpeljano — brez setState v effect body)
    configError: configError || !locationId,
  }
}
