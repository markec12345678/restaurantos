// ============================================
// QUERY KEYS — Prenos podatkov (Data portability, R147-c)
// ============================================

/**
 * R147-c (epic #115 #34 Data portability): manifest counts prek
 * GET /api/export/portability?mode=manifest (kontrakt R147-b).
 *
 * `loc` je lokacijski filter:
 *   - 'all'      → sentinel 'Vse lokacije (globalno)' — manifest URL BREZ
 *                  locationId (globalni izvoz super-admina, MODEL A),
 *   - <locationId> → manifest za posamezno lokacijo (?locationId=…).
 *
 * Izvoz je read-only (ni mutacij) — ključi služijo predvsem
 * predpomnjenju manifest po lokaciji. Unifikacija (kanon R145-c):
 * EN koren ['portability'] — vse portability tipke izhajajo iz njega.
 */
export const portabilityKeys = {
  all: ['portability'] as const,
  manifest: (loc: string) => ['portability', 'manifest', loc] as const,
}
