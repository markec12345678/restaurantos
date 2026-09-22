// ============================================
// RUNDA 67: Zaščita brisanja menija (ENOTEN VIR)
// ============================================
// Schema kaskade kategorije ob brisanju menija (onDelete: Cascade), medtem
// ko menuItems z RESTRICT blokirajo FK. Gol delete zato pomeni:
//  - meni z artikli → Prisma P2003 → generični 500 brez razlage (bug UX)
//  - meni s PRAZNIMI kategorijami → tiha kaskada (podatkovna izguba brez opozorila)
// Ta guard je ENOTEN VIR za API (409 namesto 500) IN UI (AlertDialog) —
// vzorec category-guard (R66). FAIL-SAFE: pokvarjeni števci → blokada.

import { ARTIKEL_FORMS, KATEGORIJA_FORMS, slCount } from './sl-plural'

export interface MenuDeleteDecision {
  /** true → izbris dovoljen (ni artiklov; kategorije so lahko, a opozori) */
  allowed: boolean
  /** HTTP status za API (200 semantika OK; 409 ko blokirano) */
  status: number
  /** Slovensko sporočilo ZA BLOKADO (API error body / UI opozorilna škatla) */
  messageSl: string
  /** Slovensko potrditveno sporočilo za dovoljen primer (UI dialog opis) */
  confirmSl: string
  /** true → izbris bo kaskade-k izbrisal tudi kategorije (prazne) */
  cascadeWarning: boolean
}

/** Varen števec: ne-finitno/negativno → null (fail-safe signal). */
function safeCount(n: number): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null
  return Math.trunc(n)
}

/**
 * Odloči, ali sme biti meni izbrisan glede na število kategorij in artiklov.
 * - artikli > 0 → BLOKADA (živi podatki prodaje; premakni/izbriši najprej)
 * - kategorije > 0, artikli = 0 → dovoljeno + OPOMOŽILO o kaskadi (prazne
 *   kategorije bodo izbrisane skupaj z menijem — schema Cascade)
 * - prazen meni → dovoljeno, trajno dejanje
 * Pokvarjeni števci (NaN/negativno) → BLOKADA — kadar ne vemo, koliko podatkov
 * je pod menijem, ga NE izbrišemo.
 */
export function canDeleteMenu(
  categoryCount: number,
  itemCount: number,
): MenuDeleteDecision {
  const cats = safeCount(categoryCount)
  const items = safeCount(itemCount)

  if (cats === null || items === null) {
    return {
      allowed: false,
      status: 409,
      messageSl:
        'Števila kategorij ali artiklov ni mogoče ugotoviti — brisanje je blokirano iz varnostnih razlogov.',
      confirmSl: '',
      cascadeWarning: false,
    }
  }

  if (items > 0) {
    return {
      allowed: false,
      status: 409,
      messageSl:
        `Meni vsebuje ${slCount(items, ARTIKEL_FORMS)} v ${slCount(cats, KATEGORIJA_FORMS)} — ` +
        'najprej premakni ali izbriši njegove artikle, potem pa izbriši meni.',
      confirmSl: '',
      cascadeWarning: false,
    }
  }

  if (cats > 0) {
    return {
      allowed: true,
      status: 200,
      messageSl: '',
      confirmSl:
        `Meni je brez artiklov. Izbrisal boš tudi ${slCount(cats, KATEGORIJA_FORMS)} ` +
        '(prazne kategorije gredo z menijem).',
      cascadeWarning: true,
    }
  }

  return {
    allowed: true,
    status: 200,
    messageSl: '',
    confirmSl: 'Meni je prazen. Dejanje je trajno — menija ni mogoče obnoviti po izbrisu.',
    cascadeWarning: false,
  }
}
