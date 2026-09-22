// ============================================
// RUNDA 70: Vezave skupin dodatkov ↔ artikli — čisti kontrakti (ENOTEN VIR)
// ============================================
// Group-side attach (menuItemIds) in item-side attach (modifierGroupIds) morata
// pravila scope-a deliti z istim virom, sicer se API-ji razidejo (lekcija
// R66–R68: guard lib = API in UI VEDNO konsistentna).
//
// Kontrakt (fail-safe, vzorec category-guard/menu-guard/modifier-guard):
// - dedupeIds: ohrani vrstni red, odstrani duplikate in prazne/ne-veljavne id-je
// - attachmentScopeDecision: vsak zahtevan id MORA biti najden v scope-u
//   (inScopeCount === requestedCount). Manjka ENOLIK → zavrnitev.
//   Ne-številske/negativne vrednosti → blokada (nikoli odobri).

export interface AttachmentScopeDecision {
  allowed: boolean
  status: number
  messageSl: string
}

/** je veljaven id za vezavo (ne-prazen niz) */
function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.trim().length > 0
}

/**
 * Odstrani duplikate in prazne/ne-veljavne vnose, ohrani vrstni red prve pojavitve.
 * Varnost: ne-veljavni vnosi (ne-nizi, prazni, whitespace) so tiho odstranjeni.
 */
export function dedupeIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (!isValidId(id)) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** je število varno za primerjavo (končno, ne-negativno celo) */
function isSafeCount(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && Number.isInteger(n)
}

/**
 * Odločitev o scope-u vezav: število zahtevanih id-jev MORA biti enako
 * številu id-jev, najdenih v scope-u lokacije. Manjka tudi samo EN —
 * gre za tujo lokacijo ali neobstoječ zapis → zavrnitev (404 vzorec
 * notInScopeResponse; ne razkrivaj, KATERI id je problem).
 *
 * Fail-safe: NaN/Infinity/negativna vrednost → blokada.
 */
export function attachmentScopeDecision(
  requestedCount: number,
  inScopeCount: number,
): AttachmentScopeDecision {
  if (!isSafeCount(requestedCount) || !isSafeCount(inScopeCount)) {
    return {
      allowed: false,
      status: 400,
      messageSl: 'Neveljavni podatki za vezave dodatkov — preverite poslane id-je.',
    }
  }
  if (requestedCount === inScopeCount) {
    return { allowed: true, status: 200, messageSl: '' }
  }
  return {
    allowed: false,
    status: 404,
    messageSl: 'Nekatere povezave ne pripadajo tej lokaciji ali ne obstajajo — vezave so zavrnjene.',
  }
}
