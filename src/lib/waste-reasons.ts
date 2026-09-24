// ============================================
// ODPAD — canonical razlogi (epic #115 §3, runda 119)
// ============================================
// Prodajna poraba ≠ odpad ≠ popravek zaloge. Razlogi so CANONICAL enum
// vrednosti (shranjene v WasteRecord.reason), UI oznake pa slovenske.
// Skupni vir za API validacijo (Zod), poročila (grouping) in UI.

export const WASTE_REASONS = [
  'SPOILED', // pokvarjeno
  'EXPIRED', // pretečeno
  'BROKEN', // razbito
  'INCORRECT_PREP', // napačno pripravljeno
  'RETURNED', // vrnjeno (od goste / od mize)
  'STAFF_MEAL', // osebni obrok (staff meal)
  'TEST_PREP', // testna priprava / kušnjava
  'INVENTORY_VARIANCE', // inventurna razlika (merljiva razlika, NE kraja)
  'UNKNOWN_LOSS', // neznan manko
] as const

export type WasteReason = (typeof WASTE_REASONS)[number]

export const WASTE_REASON_LABELS: Record<WasteReason, string> = {
  SPOILED: 'Pokvarjeno',
  EXPIRED: 'Pretečen rok',
  BROKEN: 'Razbito',
  INCORRECT_PREP: 'Napačno pripravljeno',
  RETURNED: 'Vrnjeno',
  STAFF_MEAL: 'Osebni obrok',
  TEST_PREP: 'Testna priprava',
  INVENTORY_VARIANCE: 'Inventurna razlika',
  UNKNOWN_LOSS: 'Neznan manko',
}

/** Varno vrne oznako razloga (neznana vrednost → raw string, ne crash). */
export function wasteReasonLabel(reason: string): string {
  return (WASTE_REASON_LABELS as Record<string, string>)[reason] ?? reason
}

/** Ciljna stopnja odpadka (% COGS) — prikazni cilj v UI (WasteTracker KPI). */
export const WASTE_TARGET_PERCENT = 2
