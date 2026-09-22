// ============================================
// OBSERVABILITY — Metrični register (in-process)
// ============================================
// P1-observability: lahkotni register BREZ zunanjih odvisnosti
// (Prometheus/Sentry sta ločena plast — ta register je vir resnice,
// ki ga izpostavi /api/monitoring/metrics).
//
// Zasnova:
//   - Counter:  monotonno štetje (http_5xx_total, furs_errors_total, ...)
//   - Gauge:    trenutna vrednost (queue depth — nastavljena iz DB)
//   - Histogram: opažanja latenc (db_query_latency_ms, furs_latency_ms)
//                → count/sum/min/max/p50/p95/p99 (reservoir 1024)
//   - Event buffer: zadnjih N časovnih žigov dogodka na izbranem
//     števcu — omogoča okenske alerte ("500 spike v zadnjih 5 min")
//     brez zunanjega time-series sistema.
//
// Vsa stanja so globalna (prek globalThis, da preživijo HMR v dev).
// ============================================

import { randomUUID } from 'crypto'

export type MetricType = 'counter' | 'gauge' | 'histogram'

export interface HistogramStats {
  count: number
  sum: number
  min: number
  max: number
  p50: number
  p95: number
  p99: number
}

export interface MetricSnapshot {
  name: string
  type: MetricType
  /** Counter/gauge vrednost (histogram: število opažanj) */
  value: number
  /** Histogram statistika (samo histogram) */
  stats?: HistogramStats
  /** Časovni žigi zadnjih dogodkov (samo counter z events=true) */
  recentEvents?: number[]
  updatedAt: number
}

const RESERVOIR_SIZE = 1024
const RECENT_EVENTS_SIZE = 256

interface CounterState { value: number; events: number[]; updatedAt: number }
interface GaugeState { value: number; updatedAt: number }
interface HistogramState {
  count: number; sum: number; min: number; max: number
  reservoir: number[]; updatedAt: number
}

interface RegistryState {
  counters: Map<string, CounterState>
  gauges: Map<string, GaugeState>
  histograms: Map<string, HistogramState>
  startedAt: number
}

const globalForMetrics = globalThis as unknown as { __observabilityRegistry?: RegistryState }

function getRegistry(): RegistryState {
  if (!globalForMetrics.__observabilityRegistry) {
    globalForMetrics.__observabilityRegistry = {
      counters: new Map(),
      gauges: new Map(),
      histograms: new Map(),
      startedAt: Date.now(),
    }
  }
  return globalForMetrics.__observabilityRegistry
}

// ─── Standardna imena metrik (P1-observability specifikacija) ───
export const METRICS = {
  /** HTTP 5xx napake (handleApiError) */
  HTTP_5XX: 'http_5xx_total',
  /** HTTP 4xx (vidnost, ne alert) */
  HTTP_4XX: 'http_4xx_total',
  /** Neuspešne prijave (PIN) */
  AUTH_LOGIN_FAILED: 'auth_login_failed_total',
  /** Uspešne prijave */
  AUTH_LOGIN_SUCCESS: 'auth_login_success_total',
  /** Latenca DB poizvedb (ms) — Prisma $extends */
  DB_QUERY_LATENCY: 'db_query_latency_ms',
  /** Latenca FURS overitve (ms) */
  FURS_LATENCY: 'furs_latency_ms',
  /** FURS napake (timeout, zavrnitev) */
  FURS_ERRORS: 'furs_errors_total',
  /** FURS uspešne overitve */
  FURS_SUCCESS: 'furs_success_total',
  /** Outbox: globina vrste (pending) — gauge iz DB */
  QUEUE_DEPTH: 'outbox_queue_depth',
  /** Outbox: dead-letter vrsta */
  QUEUE_DEAD_LETTER: 'outbox_dead_letter_depth',
  /** Outbox: failed */
  QUEUE_FAILED: 'outbox_failed_depth',
  /** Neuspešne offline sinhronizacije (konflikti, zavrnitve) */
  SYNC_FAILED: 'offline_sync_failed_total',
  /** Plačila brez knjigovodskega vnosa (accounting vrzel) */
  PAYMENTS_WITHOUT_JOURNAL: 'payments_without_journal_total',
  /** Neuspešni payment webhooki (outbox failed, tip payment) */
  PAYMENT_WEBHOOK_FAILED: 'payment_webhook_failed_total',
  /** Negativna zaloga (število artiklov) */
  INVENTORY_NEGATIVE: 'inventory_negative_count',
  /** Neusklajenost inventarja (ledger ≠ trenutna količina) */
  INVENTORY_MISMATCH: 'inventory_ledger_mismatch_count',
} as const

// ─── Counter ───

/** Povečaj števec. `trackEvents=true` shranjuje časovne žige zadnjih
 *  256 dogodkov — omogoča okenske alerte (npr. "5 FURS napak v 10 min"). */
export function incCounter(name: string, value = 1, trackEvents = false): void {
  const reg = getRegistry()
  const entry = reg.counters.get(name) ?? { value: 0, events: [], updatedAt: Date.now() }
  entry.value += value
  if (trackEvents) {
    entry.events.push(Date.now())
    if (entry.events.length > RECENT_EVENTS_SIZE) entry.events.shift()
  }
  entry.updatedAt = Date.now()
  reg.counters.set(name, entry)
}

/** Prestej dogodke na števcu v zadnjih `windowMs` (okno). */
export function countEventsInWindow(name: string, windowMs: number): number {
  const entry = getRegistry().counters.get(name)
  if (!entry) return 0
  const cutoff = Date.now() - windowMs
  return entry.events.filter(ts => ts >= cutoff).length
}

// ─── Gauge ───

export function setGauge(name: string, value: number): void {
  const reg = getRegistry()
  reg.gauges.set(name, { value, updatedAt: Date.now() })
}

export function getGauge(name: string): number | undefined {
  return getRegistry().gauges.get(name)?.value
}

// ─── Histogram ───

export function observeHistogram(name: string, valueMs: number): void {
  const reg = getRegistry()
  const h = reg.histograms.get(name) ?? {
    count: 0, sum: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY,
    reservoir: [], updatedAt: Date.now(),
  }
  h.count += 1
  h.sum += valueMs
  h.min = Math.min(h.min, valueMs)
  h.max = Math.max(h.max, valueMs)
  // Uniform reservoir — vzdržljiv za percentile brez pomnilniške rasti
  if (h.reservoir.length < RESERVOIR_SIZE) {
    h.reservoir.push(valueMs)
  } else {
    const idx = Math.floor(Math.random() * h.count)
    if (idx < RESERVOIR_SIZE) h.reservoir[idx] = valueMs
  }
  h.updatedAt = Date.now()
  reg.histograms.set(name, h)
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

function histogramStats(h: HistogramState): HistogramStats {
  const sorted = [...h.reservoir].sort((a, b) => a - b)
  return {
    count: h.count,
    sum: Math.round(h.sum * 100) / 100,
    min: h.min === Number.POSITIVE_INFINITY ? 0 : Math.round(h.min * 100) / 100,
    max: h.max === Number.NEGATIVE_INFINITY ? 0 : Math.round(h.max * 100) / 100,
    p50: Math.round(percentile(sorted, 50) * 100) / 100,
    p95: Math.round(percentile(sorted, 95) * 100) / 100,
    p99: Math.round(percentile(sorted, 99) * 100) / 100,
  }
}

// ─── Snapshot ───

export function getMetricsSnapshot(): {
  metrics: MetricSnapshot[]
  process: { startedAt: string; uptimeSeconds: number }
} {
  const reg = getRegistry()
  const metrics: MetricSnapshot[] = []

  for (const [name, c] of reg.counters) {
    metrics.push({
      name, type: 'counter', value: c.value,
      ...(c.events.length > 0 ? { recentEvents: c.events } : {}),
      updatedAt: c.updatedAt,
    })
  }
  for (const [name, g] of reg.gauges) {
    metrics.push({ name, type: 'gauge', value: g.value, updatedAt: g.updatedAt })
  }
  for (const [name, h] of reg.histograms) {
    metrics.push({ name, type: 'histogram', value: h.count, stats: histogramStats(h), updatedAt: h.updatedAt })
  }

  return {
    metrics,
    process: {
      startedAt: new Date(reg.startedAt).toISOString(),
      uptimeSeconds: Math.floor((Date.now() - reg.startedAt) / 1000),
    },
  }
}

/** Poišči metriko po imenu v snapshotu (pomožnik za teste/alerte). */
export function findMetric(name: string): MetricSnapshot | undefined {
  return getMetricsSnapshot().metrics.find(m => m.name === name)
}

/** Reset (SAMO testi) — počisti register. */
export function resetMetricsForTests(): void {
  globalForMetrics.__observabilityRegistry = {
    counters: new Map(),
    gauges: new Map(),
    histograms: new Map(),
    startedAt: Date.now(),
  }
}

/** Generiraj kratek enoličen ID (pomožnik). */
export function newRequestId(): string {
  return randomUUID().substring(0, 8)
}
