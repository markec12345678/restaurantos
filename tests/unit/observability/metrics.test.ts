// ============================================
// P1-OBSERVABILITY — Testi metričnega registra
// ============================================
import { describe, it, expect, beforeEach } from 'vitest'
import {
  METRICS,
  incCounter,
  countEventsInWindow,
  setGauge,
  getGauge,
  observeHistogram,
  getMetricsSnapshot,
  findMetric,
  resetMetricsForTests,
} from '@/lib/observability/metrics'
import { countWsDisconnectsInWindow } from '@/lib/observability/ws'
import type { WsMetrics } from '@/lib/observability/ws'

describe('P1-observability: metrični register', () => {
  beforeEach(() => {
    resetMetricsForTests()
  })

  it('incCounter povečuje vrednost in getMetricsSnapshot jo vrne', () => {
    incCounter(METRICS.HTTP_5XX)
    incCounter(METRICS.HTTP_5XX)
    incCounter(METRICS.FURS_ERRORS, 5)

    const http5xx = findMetric(METRICS.HTTP_5XX)
    expect(http5xx?.type).toBe('counter')
    expect(http5xx?.value).toBe(2)

    const furs = findMetric(METRICS.FURS_ERRORS)
    expect(furs?.value).toBe(5)
  })

  it('countEventsInWindow šteje dogodke v oknu (in ignorira stare)', () => {
    incCounter(METRICS.FURS_ERRORS, 1, true)
    incCounter(METRICS.FURS_ERRORS, 1, true)
    incCounter(METRICS.FURS_ERRORS, 1, true)

    // Vsi 3 so zdaj (okno 10 min)
    expect(countEventsInWindow(METRICS.FURS_ERRORS, 10 * 60 * 1000)).toBe(3)
    // Brez event bufferja (trackEvents=false) → 0 tudi z ogromnim oknom
    incCounter(METRICS.HTTP_4XX)
    expect(countEventsInWindow(METRICS.HTTP_4XX, 60_000)).toBe(0)
    // Neobstoječ števec → 0
    expect(countEventsInWindow('neobstoje', 60_000)).toBe(0)
  })

  it('gauge nastavi in prebere trenutno vrednost', () => {
    setGauge(METRICS.QUEUE_DEPTH, 42)
    expect(getGauge(METRICS.QUEUE_DEPTH)).toBe(42)

    setGauge(METRICS.QUEUE_DEPTH, 7)
    expect(getGauge(METRICS.QUEUE_DEPTH)).toBe(7)
    expect(getGauge('neobstojeca')).toBeUndefined()
  })

  it('histogram računa count/sum/min/max in percentile', () => {
    for (const ms of [10, 20, 30, 40, 50]) {
      observeHistogram(METRICS.DB_QUERY_LATENCY, ms)
    }
    const m = findMetric(METRICS.DB_QUERY_LATENCY)
    expect(m?.type).toBe('histogram')
    expect(m?.stats?.count).toBe(5)
    expect(m?.stats?.sum).toBe(150)
    expect(m?.stats?.min).toBe(10)
    expect(m?.stats?.max).toBe(50)
    expect(m?.stats?.p50).toBeGreaterThanOrEqual(20)
    expect(m?.stats?.p50).toBeLessThanOrEqual(40)
    expect(m?.stats?.p95).toBe(50)
  })

  it('snapshot vsebuje process uptime in vse tipe', () => {
    incCounter(METRICS.AUTH_LOGIN_FAILED, 1, true)
    setGauge(METRICS.QUEUE_DEPTH, 3)
    observeHistogram(METRICS.FURS_LATENCY, 100)

    const snap = getMetricsSnapshot()
    expect(snap.process.uptimeSeconds).toBeGreaterThanOrEqual(0)
    expect(snap.metrics.map(m => m.type)).toContain('counter')
    expect(snap.metrics.map(m => m.type)).toContain('gauge')
    expect(snap.metrics.map(m => m.type)).toContain('histogram')

    // Event buffer je v snapshotu (recentEvents)
    const failed = snap.metrics.find(m => m.name === METRICS.AUTH_LOGIN_FAILED)
    expect(failed?.recentEvents?.length).toBe(1)
  })

  it('register preživi več klicov inc/observe (monotonost)', () => {
    for (let i = 0; i < 100; i++) {
      incCounter(METRICS.HTTP_5XX)
      observeHistogram(METRICS.DB_QUERY_LATENCY, i)
    }
    expect(findMetric(METRICS.HTTP_5XX)?.value).toBe(100)
    expect(findMetric(METRICS.DB_QUERY_LATENCY)?.stats?.count).toBe(100)
  })
})

describe('P1-observability: WS okensko štetje odklopov', () => {
  it('countWsDisconnectsInWindow šteje samo recentne', () => {
    const now = Date.now()
    const ws: WsMetrics = {
      connectionsTotal: 10,
      connectionsActive: 2,
      disconnectsTotal: 8,
      // 2 recentna (1s, 2s nazaj) + 1 star (10 min nazaj)
      disconnectsRecent: [now - 1000, now - 2000, now - 10 * 60 * 1000],
      messagesReceived: 50,
      broadcastsSent: 30,
      processUptimeSeconds: 100,
    }
    // Okno 5 min: oba recentna, star izpad
    expect(countWsDisconnectsInWindow(ws, 5 * 60 * 1000)).toBe(2)
    // Ozko okno (500 ms): disconnect pred 1 s NI več notri → 0
    expect(countWsDisconnectsInWindow(ws, 500)).toBe(0)
    // Null WS (custom server ne teče) → 0
    expect(countWsDisconnectsInWindow(null, 5 * 60 * 1000)).toBe(0)
    // Svež dogodek (now) v 500ms oknu → 1
    expect(countWsDisconnectsInWindow({ ...ws, disconnectsRecent: [now] }, 500)).toBe(1)
  })
})
