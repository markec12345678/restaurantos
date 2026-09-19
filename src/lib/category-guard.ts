// ============================================
// RUNDA 66: Zaščita brisanja kategorije (ENOTEN VIR)
// ============================================
// Kategorija brez artiklov se lahko izbriše; kategorija Z artikli je
// blokirana (409) — artikli so živi podatki prodaje in fiscalnih računov,
// cascade brisanje bi porušilo zgodovino. UI in API SKUPAJ uporabljata to
// čisto funkcijo za odločitev + slovensko sporočilo (ENOTEN VIR, vzorec
// payment-methods-sl / percent-change).

import { ARTIKEL_FORMS, slCount } from './sl-plural'

export interface CategoryDeleteDecision {
  /** true → izbris dovoljen (kategorija je prazna) */
  allowed: boolean
  /** HTTP status za API (200/204 semantika → API si preslika; 409 ko blokirano) */
  status: number
  /** Slovensko sporočilo za toast/API error body */
  messageSl: string
}

/**
 * Odloči, ali sme biti kategorija izbrisana glede na število artiklov.
 * - prazna kategorija (0 artiklov) → dovoljeno
 * - N > 0 → blokirano s sporočilom, ki pove koliko artiklov in kaj naj admin stori
 * FAIL-SAFE: pokvarjen števec (NaN/Infinity/negativno) → BLOKIRANO — kadar ne
 * vemo, koliko artiklov kategorija ima, je NE izbrišemo. DB count() vedno
 * vrne necelo negativno število, zato ta veja ščiti pred refaktor-bugom.
 */
export function canDeleteCategory(itemCount: number): CategoryDeleteDecision {
  if (typeof itemCount !== 'number' || !Number.isFinite(itemCount) || itemCount < 0) {
    return {
      allowed: false,
      status: 409,
      messageSl:
        'Števila artiklov ni mogoče ugotoviti — brisanje je blokirano iz varnostnih razlogov.',
    }
  }

  const safeCount = Math.trunc(itemCount)

  if (safeCount === 0) {
    return {
      allowed: true,
      status: 200,
      messageSl: 'Kategorija je prazna in jo je mogoče izbrisati.',
    }
  }

  return {
    allowed: false,
    status: 409,
    messageSl:
      `Kategorija vsebuje ${slCount(safeCount, ARTIKEL_FORMS)} — ` +
      'najprej premakni ali izbriši njene artikle, potem pa izbriši kategorijo.',
  }
}
