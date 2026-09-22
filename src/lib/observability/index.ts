// ============================================
// OBSERVABILITY — javni API modula
// ============================================
export {
  METRICS,
  incCounter,
  countEventsInWindow,
  setGauge,
  getGauge,
  observeHistogram,
  getMetricsSnapshot,
  findMetric,
  resetMetricsForTests,
  newRequestId,
} from './metrics'
export type { MetricSnapshot, HistogramStats, MetricType } from './metrics'
