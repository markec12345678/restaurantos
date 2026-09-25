'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

// ═══════════════════════════════════════════════════════════════
// KDS Metrics — GET /api/kitchen/metrics?window=today (R133)
// ═══════════════════════════════════════════════════════════════
// Kontrakt-defenziven klient (agent-ctx/R133-design.md §4 + §6):
// ruta pristaja VZPOREDNO (R133-server) → vsi nested objekti so
// NEOBVEZNI, arrayi guardani z Array.isArray, številke null-safe.
// 404/500 → throw → react-query error stanje → panel pokaže
// 'Znova poskusi' (nikoli crash).
// ═══════════════════════════════════════════════════════════════

/** Čakalna vrsta po postaji (live sekcija). */
export interface KdsMetricsQueueRow {
  station?: string | null
  items?: number | null
  oldestMinutes?: number | null
}

/** Throughput po postaji (okno 'Danes'). */
export interface KdsMetricsStationRow {
  station?: string | null
  itemsBumped?: number | null
  avgMinutes?: number | null
  onTimeRate?: number | null
  lateCount?: number | null
}

/** Odgovor /api/kitchen/metrics — vsa polja neobvezna (defenzivni kontrakt). */
export interface KdsMetrics {
  window?: { kind?: string | null; from?: string | null; to?: string | null } | null
  live?: {
    activeTickets?: number | null
    oldestTicketMinutes?: number | null
    avgTicketAgeMinutes?: number | null
    queueByStation?: KdsMetricsQueueRow[]
  } | null
  throughput?: {
    itemsBumped?: number | null
    ordersTouched?: number | null
    avgFiredToReadyMinutes?: number | null
    medianFiredToReadyMinutes?: number | null
    p90FiredToReadyMinutes?: number | null
    onTimeRate?: number | null
    lateCount?: number | null
    avgLateMinutes?: number | null
  } | null
  stations?: KdsMetricsStationRow[]
  caps?: { rowsAnalyzed?: number | null; capped?: boolean } | null
}

/** null-safe številka — deepToNumbers na meji lahko prinese number ALI decimal-string. */
function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function toObj(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function toStr(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * Defenziven parse odgovora — NIKOLI ne vrže; neveljaven/nepopoln odgovor
 * degradira v manjkajoča polja (panel prikaže '—' oz. prazno stanje).
 */
export function parseKdsMetrics(raw: unknown): KdsMetrics {
  const root = toObj(raw)
  if (!root) return {}

  const win = toObj(root.window)
  const live = toObj(root.live)
  const throughput = toObj(root.throughput)
  const caps = toObj(root.caps)

  const queueRaw = live ? live.queueByStation : undefined
  const queueByStation: KdsMetricsQueueRow[] | undefined = Array.isArray(queueRaw)
    ? queueRaw.map((row) => {
        const o = toObj(row)
        return {
          station: o ? toStr(o.station) : null,
          items: toNum(o?.items),
          oldestMinutes: toNum(o?.oldestMinutes),
        }
      })
    : undefined

  const stationsRaw = root.stations
  const stations: KdsMetricsStationRow[] | undefined = Array.isArray(stationsRaw)
    ? stationsRaw.map((row) => {
        const o = toObj(row)
        return {
          station: o ? toStr(o.station) : null,
          itemsBumped: toNum(o?.itemsBumped),
          avgMinutes: toNum(o?.avgMinutes),
          onTimeRate: toNum(o?.onTimeRate),
          lateCount: toNum(o?.lateCount),
        }
      })
    : undefined

  return {
    window: win
      ? { kind: toStr(win.kind), from: toStr(win.from), to: toStr(win.to) }
      : undefined,
    live: live
      ? {
          activeTickets: toNum(live.activeTickets),
          oldestTicketMinutes: toNum(live.oldestTicketMinutes),
          avgTicketAgeMinutes: toNum(live.avgTicketAgeMinutes),
          queueByStation,
        }
      : undefined,
    throughput: throughput
      ? {
          itemsBumped: toNum(throughput.itemsBumped),
          ordersTouched: toNum(throughput.ordersTouched),
          avgFiredToReadyMinutes: toNum(throughput.avgFiredToReadyMinutes),
          medianFiredToReadyMinutes: toNum(throughput.medianFiredToReadyMinutes),
          p90FiredToReadyMinutes: toNum(throughput.p90FiredToReadyMinutes),
          onTimeRate: toNum(throughput.onTimeRate),
          lateCount: toNum(throughput.lateCount),
          avgLateMinutes: toNum(throughput.avgLateMinutes),
        }
      : undefined,
    stations,
    caps: caps
      ? {
          rowsAnalyzed: toNum(caps.rowsAnalyzed),
          capped: typeof caps.capped === 'boolean' ? caps.capped : undefined,
        }
      : undefined,
  }
}

/**
 * Metrična poizvedba KDS — enabled SAMO ko je panel odprt (zaprt panel →
 * ni prometa), refetch 30 s, brez refetch on focus (celozaslonski kuhinjski
 * zaslon — focus pivoti so šum).
 */
export function useKDSMetrics(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.orders.kdsMetrics,
    queryFn: async (): Promise<KdsMetrics> => {
      // Bearer token pattern iz use-kds-orders (sessionStorage → localStorage → pos_token)
      const token = sessionStorage.getItem('pos_auth_token') || localStorage.getItem('pos_auth_token') || localStorage.getItem('pos_token')
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/kitchen/metrics?window=today', { headers })
      // Ne-ok (404 — ruta še ni pristala, 401, 500) → throw → error stanje panela
      if (!res.ok) throw new Error(`Metrike niso dosegljive (HTTP ${res.status})`)
      return parseKdsMetrics(await res.json().catch(() => null))
    },
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  })
}
