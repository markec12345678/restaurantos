// ============================================
// RUNDA 69: Zaščita brisanja zvestobnega računa (ENOTEN VIR)
// ============================================
// LoyaltyTransaction (onDelete: Restrict) — goli delete bi vrgel P2003 →
// generični 500 brez razlage (isti vzorec kot darilne kartice R69, kategorije
// R66, meniji R67, skupine dodatkov R68). Poleg tega bi izbris računa s
// točkami tiho uničil vrednost, ki jo je gost pridobil z nakupi. Pravilna
// akcija je DEAKTIVACIJA (isActive=false prek PUT), ne brisanje.
// Zato: transakcije > 0 → blokada (zgodovina točk se ohranja); točke > 0 →
// blokada s predlogom deaktivacije; prazen račun brez zgodovine → dovoljeno.
// UI in API SKUPAJ uporabljata to čisto funkcijo (ENOTEN VIR).

import { TOCKA_TOZILNIK_FORMS, TRANSAKCIJA_TOZILNIK_FORMS, slCount } from './sl-plural'

export interface LoyaltyDeleteDecision {
  /** true → izbris dovoljen (račun prazen, brez zgodovine) */
  allowed: boolean
  /** HTTP status za API (200/204 semantika → API si preslika; 409 ko blokirano) */
  status: number
  /** Slovensko sporočilo za toast/API error body */
  messageSl: string
  /** true → priporočamo deaktivacijo (isActive=false) namesto brisanja */
  suggestDeactivate: boolean
}

/**
 * Odloči, ali sme biti zvestobni račun izbrisan.
 * - transakcije > 0 → BLOKIRANO (zgodovina točk; predlagaj deaktivacijo)
 * - točke > 0 (tudi brez transakcij) → BLOKIRANO (pridobljena vrednost; predlagaj deaktivacijo)
 * - 0 transakcij IN 0 točk → dovoljeno
 * FAIL-SAFE: pokvarjen števec (NaN/Infinity/negativno) → BLOKIRANO — kadar ne
 * vemo, koliko zgodovine račun nosi, ga NE izbrišemo (vzorec category-guard R66).
 */
export function canDeleteLoyaltyAccount(transactionCount: number, pointsBalance: number): LoyaltyDeleteDecision {
  if (
    typeof transactionCount !== 'number' || !Number.isFinite(transactionCount) || transactionCount < 0 ||
    typeof pointsBalance !== 'number' || !Number.isFinite(pointsBalance) || pointsBalance < 0
  ) {
    return {
      allowed: false,
      status: 409,
      suggestDeactivate: false,
      messageSl:
        'Števila transakcij ali točk računa ni mogoče ugotoviti — brisanje je blokirano iz varnostnih razlogov.',
    }
  }

  const txns = Math.trunc(transactionCount)

  if (txns > 0) {
    return {
      allowed: false,
      status: 409,
      suggestDeactivate: true,
      messageSl:
        `Račun ima ${slCount(txns, TRANSAKCIJA_TOZILNIK_FORMS)} — zgodovina točk se ohranja ` +
        'in je ni mogoče izbrisati. Deaktivirajte račun (izklopite "Aktiven") namesto brisanja.',
    }
  }

  if (pointsBalance > 0) {
    return {
      allowed: false,
      status: 409,
      suggestDeactivate: true,
      messageSl:
        `Račun ima še ${slCount(pointsBalance, TOCKA_TOZILNIK_FORMS)} — računa s točkami ni mogoče izbrisati. ` +
        'Deaktivirajte račun (izklopite "Aktiven") namesto brisanja.',
    }
  }

  return {
    allowed: true,
    status: 200,
    suggestDeactivate: false,
    messageSl: 'Račun je prazen in brez zgodovine — izbris je mogoč.',
  }
}
