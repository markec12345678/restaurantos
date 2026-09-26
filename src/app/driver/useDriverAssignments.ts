'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { UnauthorizedError, authFetch, getStoredToken } from './driver-context'

// =====================================================================
// useDriverAssignments — poll GET /api/delivery/assignments (R137-c)
// Vzorec: display/useDisplayBoard.ts (poll + fetchSeq ref-guard +
// stale-while-error + refetch ob focus/visibilitychange).
// Razlike od display table:
//  - poll 15 s (voznik pod pohodom — frekvenčnejše od table je dovolj)
//  - 401 → loggedOut (re-login), ne config napaka
//  - BREZ self-heal reloada: občasni izpad signala pod pogojem je
//    normalen — stale-while-error + naslednji poll to pozdravita
// Normalizacija na meji (display kanon): status whitelist, orderNumber
// String(), pokvarjen vnos se odstrani, ne upodobi.
// GPS pošiljanje je namenoma IZPUŠČENO (minimal-patch) — server ga
// podpira, glej TODO v DriverApp.tsx.
// =====================================================================

export const DRIVER_POLL_INTERVAL_MS = 15_000

/** Aktivni statusi moje dostave (delivered/failed odpadata iz mine[]) */
export type ActiveDriverStatus = 'assigned' | 'picked_up' | 'on_the_way' | 'arriving'
export type DriverStatus = ActiveDriverStatus | 'delivered' | 'failed'

const KNOWN_DRIVER_STATUSES: readonly string[] = [
  'assigned', 'picked_up', 'on_the_way', 'arriving', 'delivered', 'failed',
]

export interface DriverCheck {
  total: number
  paymentStatus: string
}

export interface DriverOrder {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  type: string
  createdAt: string | null
  checks: DriverCheck[]
}

export interface DriverDeliveryBase {
  address: string
  city: string
  postCode: string
  recipientName: string
  recipientPhone: string
  instructions: string
  order: DriverOrder | null
}

/** ready[] — pripravljeno za prevzem (še brez voznika) */
export interface ReadyDelivery extends DriverDeliveryBase {
  id: string
}

/** mine[] — moja aktivna dostava */
export interface MineDelivery extends DriverDeliveryBase {
  deliveryInfoId: string
  status: DriverStatus
  driverName: string
}

// --- izpeljane vrednosti za kartico (total + gotovina ob prevzemu) ---

/** Vsota check totalov (null, če ni podatka) */
export function orderTotal(order: DriverOrder | null): number | null {
  if (!order || order.checks.length === 0) return null
  return order.checks.reduce((sum, c) => sum + c.total, 0)
}

/** Gotovina ob prevzemu: naročilo neplačano IN obstaja neplačan check */
export function isCashOnDelivery(order: DriverOrder | null): boolean {
  if (!order) return false
  return order.paymentStatus === 'unpaid' && order.checks.some((c) => c.paymentStatus === 'unpaid')
}

// --- normalizacija (display kanon: na meji, defenzivno) ---

function normalizeOrder(raw: unknown): DriverOrder | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  if (rec.id === undefined || rec.id === null) return null
  const checks: DriverCheck[] = Array.isArray(rec.checks)
    ? rec.checks.flatMap((c: unknown): DriverCheck[] => {
        if (!c || typeof c !== 'object') return []
        const cr = c as Record<string, unknown>
        if (typeof cr.total !== 'number' || !Number.isFinite(cr.total)) return []
        return [{ total: cr.total, paymentStatus: typeof cr.paymentStatus === 'string' ? cr.paymentStatus : '' }]
      })
    : []
  return {
    id: String(rec.id),
    orderNumber: rec.orderNumber === undefined || rec.orderNumber === null ? '' : String(rec.orderNumber),
    status: typeof rec.status === 'string' ? rec.status : '',
    paymentStatus: typeof rec.paymentStatus === 'string' ? rec.paymentStatus : '',
    type: typeof rec.type === 'string' ? rec.type : '',
    createdAt: typeof rec.createdAt === 'string' ? rec.createdAt : null,
    checks,
  }
}

function normalizeAddress(rec: Record<string, unknown>): {
  address: string; city: string; postCode: string
  recipientName: string; recipientPhone: string; instructions: string
  order: DriverOrder | null
} {
  return {
    address: typeof rec.address === 'string' ? rec.address : '',
    city: typeof rec.city === 'string' ? rec.city : '',
    postCode: typeof rec.postCode === 'string' ? rec.postCode : '',
    recipientName: typeof rec.recipientName === 'string' ? rec.recipientName : '',
    recipientPhone: typeof rec.recipientPhone === 'string' ? rec.recipientPhone : '',
    instructions: typeof rec.instructions === 'string' ? rec.instructions : '',
    order: normalizeOrder(rec.order),
  }
}

function normalizeReady(raw: unknown): ReadyDelivery[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item: unknown): ReadyDelivery[] => {
    if (!item || typeof item !== 'object') return []
    const rec = item as Record<string, unknown>
    if (rec.id === undefined || rec.id === null) return []
    if (typeof rec.address !== 'string' || rec.address.trim() === '') return []
    return [{ id: String(rec.id), ...normalizeAddress(rec) }]
  })
}

function normalizeMine(raw: unknown): MineDelivery[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item: unknown): MineDelivery[] => {
    if (!item || typeof item !== 'object') return []
    const rec = item as Record<string, unknown>
    if (typeof rec.deliveryInfoId !== 'string' || rec.deliveryInfoId === '') return []
    if (typeof rec.status !== 'string' || !KNOWN_DRIVER_STATUSES.includes(rec.status)) return []
    const info = rec.deliveryInfo
    if (!info || typeof info !== 'object') return []
    const infoRec = info as Record<string, unknown>
    if (typeof infoRec.address !== 'string' || infoRec.address.trim() === '') return []
    return [
      {
        deliveryInfoId: rec.deliveryInfoId,
        status: rec.status as DriverStatus,
        driverName: typeof rec.driverName === 'string' ? rec.driverName : '',
        ...normalizeAddress(infoRec),
      },
    ]
  })
}

export interface DriverAssignmentsState {
  mine: MineDelivery[]
  ready: ReadyDelivery[]
  /** ISO timestamp zadnjega uspešnega odgovora (strežniški, fallback lokalen) */
  timestamp: string | null
  /** true, ko je zadnji fetch uspel (stale-while-error: false obdrži podatke) */
  connected: boolean
  /** true do PRVEGA odgovora (uspešnega ali napake) */
  isLoading: boolean
  /** 401 — seja potekla, zahteva re-login */
  loggedOut: boolean
  /** Ročno/ob akciji sprožen refetch */
  refresh: () => Promise<void>
}

export function useDriverAssignments(): DriverAssignmentsState {
  const [mine, setMine] = useState<MineDelivery[]>([])
  const [ready, setReady] = useState<ReadyDelivery[]>([])
  const [timestamp, setTimestamp] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loggedOut, setLoggedOut] = useState(false)
  const fetchSeq = useRef(0)

  const refresh = useCallback(async (): Promise<void> => {
    const seq = ++fetchSeq.current
    if (!getStoredToken()) {
      setLoggedOut(true)
      setIsLoading(false)
      return
    }
    try {
      const res = await authFetch('/api/delivery/assignments')
      if (seq !== fetchSeq.current) return // zastarel/abortiran odgovor — brez state
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: unknown = await res.json()
      if (seq !== fetchSeq.current) return
      const rec = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
      setMine(normalizeMine(rec.mine))
      setReady(normalizeReady(rec.ready))
      setTimestamp(
        typeof rec.timestamp === 'string' && !Number.isNaN(new Date(rec.timestamp).getTime())
          ? rec.timestamp
          : new Date().toISOString(),
      )
      setConnected(true)
      setIsLoading(false)
    } catch (err) {
      if (seq !== fetchSeq.current) return
      if (err instanceof UnauthorizedError) {
        // 401 — seja ni več veljavna (authFetch je že počistil žeton)
        setLoggedOut(true)
        setIsLoading(false)
        return
      }
      // stale-while-error — obdrži zadnje uspešno stanje, samo pika ugasne
      setConnected(false)
      setIsLoading(false)
    }
  }, [])

  // Poll 15 s + takojšen refetch ob focus / visibilitychange 'visible'
  // (display/useDisplayBoard vzor; cleanup počisti interval + listenere)
  useEffect(() => {
    if (loggedOut) return
    // await v async IIFE — vsi setState so v async continuation
    // (react-hooks/set-state-in-effect kanon)
    void (async () => {
      await refresh()
    })()
    const interval = setInterval(() => {
      void refresh()
    }, DRIVER_POLL_INTERVAL_MS)
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
  }, [loggedOut, refresh])

  return { mine, ready, timestamp, connected, isLoading, loggedOut, refresh }
}
