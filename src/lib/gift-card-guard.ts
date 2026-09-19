// ============================================
// RUNDA 69: Zaščita brisanja darilne kartice (ENOTEN VIR)
// ============================================
// Darilna kartica je denarna entiteta z dvema vrstama zgodovine:
// 1. GiftCardTransaction (onDelete: Restrict) — goli delete bi vrgel P2003
//    → generični 500 brez razlage (isti vzorec kot kategorije R66, meniji
//    R67, skupine dodatkov R68).
// 2. Stanje (balance) — uničenje kartice s stanjem bi tiho izgubilo denar
//    gosta. Pravilna akcija je SUSPENDIRANJE kartice, ne brisanje.
// Zato: transakcije > 0 → blokada (fiskalna zgodovina se ohranja); stanje
// > 0 → blokada s predlogom suspendiranja; prazna kartica brez zgodovine →
// dovoljeno. UI in API SKUPAJ uporabljata to čisto funkcijo (ENOTEN VIR).

import { TRANSAKCIJA_TOZILNIK_FORMS, slCount } from './sl-plural'
import { formatEUR } from './safe-format'

export interface GiftCardDeleteDecision {
  /** true → izbris dovoljen (kartica prazna, brez zgodovine) */
  allowed: boolean
  /** HTTP status za API (200/204 semantika → API si preslika; 409 ko blokirano) */
  status: number
  /** Slovensko sporočilo za toast/API error body */
  messageSl: string
  /** true → priporočamo suspendiranje namesto brisanja (kartica ima zgodovino ali stanje) */
  suggestSuspend: boolean
}

/**
 * Odloči, ali sme biti darilna kartica izbrisana.
 * - transakcije > 0 → BLOKIRANO (fiskalna zgodovina; predlagaj suspendiranje)
 * - stanje > 0 (tudi brez transakcij) → BLOKIRANO (denarna vrednost; predlagaj suspendiranje)
 * - 0 transakcij IN stanje 0 → dovoljeno
 * FAIL-SAFE: pokvarjen števec/znesek (NaN/Infinity/negativno) → BLOKIRANO —
 * kadar ne vemo, koliko zgodovine kartica nosi, je NE izbrišemo (vzorec
 * category-guard R66). DB count() vedno vrne necelo negativno število, zato
 * ta veja ščiti pred refaktor-bugom.
 */
export function canDeleteGiftCard(transactionCount: number, balanceEur: number): GiftCardDeleteDecision {
  if (
    typeof transactionCount !== 'number' || !Number.isFinite(transactionCount) || transactionCount < 0 ||
    typeof balanceEur !== 'number' || !Number.isFinite(balanceEur) || balanceEur < 0
  ) {
    return {
      allowed: false,
      status: 409,
      suggestSuspend: false,
      messageSl:
        'Števila transakcij ali stanja kartice ni mogoče ugotoviti — brisanje je blokirano iz varnostnih razlogov.',
    }
  }

  const txns = Math.trunc(transactionCount)

  if (txns > 0) {
    return {
      allowed: false,
      status: 409,
      suggestSuspend: true,
      messageSl:
        `Kartica ima ${slCount(txns, TRANSAKCIJA_TOZILNIK_FORMS)} — njihova zgodovina se ` +
        'ohranja za fiskalne namene in je ni mogoče izbrisati. Suspendirajte kartico namesto tega.',
    }
  }

  if (balanceEur > 0) {
    return {
      allowed: false,
      status: 409,
      suggestSuspend: true,
      messageSl:
        `Kartica ima še ${formatEUR(balanceEur)} stanja — kartice z denarno vrednostjo ni mogoče izbrisati. ` +
        'Suspendirajte kartico namesto tega.',
    }
  }

  return {
    allowed: true,
    status: 200,
    suggestSuspend: false,
    messageSl: 'Kartica je prazna in brez zgodovine — izbris je mogoč.',
  }
}
