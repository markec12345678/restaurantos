// ============================================
// RUNDA 68: Zaščita brisanja skupine dodatkov (ENOTEN VIR)
// ============================================
// Skupina dodatkov (modifier group) brez pripetih artiklov se lahko izbriše;
// skupina Z pripetimi artikli je blokirana (409). Prisma schema ima na
// MenuItemModifierGroup.modifierGroup onDelete: Cascade — goli db delete bi
// TIHO odstranil vezavo dodatkov z vseh artiklov (artikli sami ostanejo, ampak
// npr. "Način pečenja" izgine iz vseh zrezkov brez opozorila). To je isti vzorec
// tihe izgube podatkov kot pri kategorijah (R66) in menijih (R67). UI in API
// SKUPAJ uporabljata to čisto funkcijo (ENOTEN VIR, vzorec category-guard).

import { ARTIKEL_FORMS, slCount } from './sl-plural'

export interface ModifierGroupDeleteDecision {
  /** true → izbris dovoljen (skupina ni pripeta nobenemu artiklu) */
  allowed: boolean
  /** HTTP status za API (200 semantika → API si preslika; 409 ko blokirano) */
  status: number
  /** Slovensko sporočilo za toast/API error body */
  messageSl: string
}

/**
 * Odloči, ali sme biti skupina dodatkov izbrisana glede na število artiklov,
 * na katere je pripeta (join MenuItemModifierGroup).
 * - 0 artiklov → dovoljeno (skupina je osirotela, varno za izbris)
 * - N > 0 → blokirano s sporočilom, ki pove koliko artiklov izgubi vezavo
 * FAIL-SAFE: pokvarjen števec (NaN/Infinity/negativno) → BLOKIRANO — kadar ne
 * vemo, na koliko artiklih je skupina v uporabi, je NE izbrišemo (isti
 * kontrakt kot canDeleteCategory / canDeleteMenu).
 */
export function canDeleteModifierGroup(itemCount: number): ModifierGroupDeleteDecision {
  if (typeof itemCount !== 'number' || !Number.isFinite(itemCount) || itemCount < 0) {
    return {
      allowed: false,
      status: 409,
      messageSl:
        'Števila artiklov s to skupino dodatkov ni mogoče ugotoviti — brisanje je blokirano iz varnostnih razlogov.',
    }
  }

  const safeCount = Math.trunc(itemCount)

  if (safeCount === 0) {
    return {
      allowed: true,
      status: 200,
      messageSl: 'Skupina dodatkov ni pripeta nobenemu artiklu in jo je mogoče izbrisati.',
    }
  }

  return {
    allowed: false,
    status: 409,
    messageSl:
      `Skupina dodatkov je pripeta ${slCount(safeCount, ARTIKEL_FORMS)} — ` +
      'izbris bi odstranil dodatke s teh artiklov. Najprej odveži skupino v urejevalniku artiklov.',
  }
}
