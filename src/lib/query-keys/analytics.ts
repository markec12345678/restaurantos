// ============================================
// QUERY KEYS — Napredna analitika (R149-b, epic #115 #36)
// ============================================
// GET /api/analytics/overview — okno + granularnost + MODEL A scope.

export const analyticsKeys = {
  all: ['analytics'] as const,
  /** params: { start, end, granularity?, locationId? } — GET /api/analytics/overview */
  overview: (params?: Record<string, unknown>) => ['analytics', 'overview', params ?? null] as const,
}
