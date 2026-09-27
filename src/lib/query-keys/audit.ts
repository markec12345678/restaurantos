// ============================================
// QUERY KEYS — Audit/retention (R148-c, epic #115 #35)
// ============================================

/**
 * R148-c (epic #115 #35 Audit/retention): tipke za verify-chain,
 * retention preview in archive dry-run (kontrakt R148-b).
 *
 * - verifyChain   → GET /api/audit/verify-chain (integriteta verige,
 *                   anchor-aware — documented truncations)
 * - retention     → GET /api/audit/retention (policy + eligible counts +
 *                   chain anchor/head — admin dry-run preview)
 * - archiveDryRun → POST /api/audit/archive (brez apply) — tipka vsebuje
 *                   cutoff, ker je odgovor cutoff-specific.
 *
 * Unifikacija (kanon R145-c): EN koren ['audit'] — vse audit tipke izhajajo
 * iz njega. Opomba: AuditLogViewer seznam vnosev še vedno uporablja legacy
 * ključ ['audit-logs', queryString] (izven te tovarne — dednost r12).
 */
export const auditKeys = {
  all: ['audit'] as const,
  verifyChain: ['audit', 'verify-chain'] as const,
  retention: ['audit', 'retention'] as const,
  archiveDryRun: (cutoff: string) => ['audit', 'archive-dry-run', cutoff] as const,
}
