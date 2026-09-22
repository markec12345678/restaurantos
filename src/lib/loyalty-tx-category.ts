// ─── RUNDA 50: kategorizacija transakcij zvestobe ───
// ENOTEN VIR resnice za UI (Zgodovina dialog, prihodnje površine) —
// prej je klasifikacija živela kot lokalna funkcija `specialTx` v
// LoyaltyHistoryDialog (prefix matching brez testov, brez ponovne uporabe).
//
// Dejstva iz backenda (src/app/api/payments/_helpers/loyalty.ts):
//  • earn        → type 'earn', reason "Točke za plačilo X EUR", points > 0
//  • bonus       → type 'earn', reason "Bonus nivoa {nivo} (+N %)", points > 0
//  • povišanje   → type 'earn', points = 0, reason "Povišanje nivoa v {nivo}"
//  • unovčenje   → type 'redeem', points < 0
//  • prilagoditev→ type 'adjust' (ročno prilagajanje točk)
//  • potek       → type 'expire'
//
// KONTRAKT: razlog ima PREDNOST pred type — "Bonus nivoa" in
// "Povišanje nivoa" sta type 'earn', a semantično posebni kategoriji.
// Prefix (startsWith), NE substring: "Velik Bonus nivoa" NI bonus.

export type LoyaltyTxCategory = 'earn' | 'bonus' | 'upgrade' | 'redeem' | 'adjust' | 'expire'

export const LOYALTY_TX_CATEGORY_ORDER: readonly LoyaltyTxCategory[] = [
  'earn',
  'bonus',
  'upgrade',
  'redeem',
  'adjust',
  'expire',
] as const

/** Bazalna (chip/barva) metapodatki kategorije — ikone ostanejo v komponenti. */
export const LOYALTY_TX_CATEGORY_META: Record<
  LoyaltyTxCategory,
  { label: string; chip: string; accent: string }
> = {
  earn: {
    label: 'Prislužene',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    accent: 'border-t-emerald-500/70',
  },
  bonus: {
    label: 'Bonus nivoa',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    accent: 'border-t-amber-500/70',
  },
  upgrade: {
    label: 'Povišanje nivoa',
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
    accent: 'border-t-violet-500/70',
  },
  redeem: {
    label: 'Unovčene',
    chip: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    accent: 'border-t-blue-500/70',
  },
  adjust: {
    label: 'Prilagojene',
    chip: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
    accent: 'border-t-slate-400/70',
  },
  expire: {
    label: 'Potekle',
    chip: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    accent: 'border-t-red-500/70',
  },
}

/**
 * Kategoriziraj eno transakcijo. Neznani/manjkajoči type → 'adjust'
 * (isti fallback, ki ga je dialog doslej uporabljal za neznane tipe).
 *
 * Razlog ZAMENJA kategorijo SAMO pri type 'earn' — "Bonus nivoa" in
 * "Povišanje nivoa" sta edini razlogi, ki jih backend kdaj zapiše ob
 * earn transakciji. Redeem/adjust/expire ostanejo svoj tip, tudi če
 * razlog dvomljivo začne s "Bonus nivoa" (hipotetično pokvarjeni podatki).
 */
export function loyaltyTxCategory(tx: { type: string; reason?: string | null }): LoyaltyTxCategory {
  const type = typeof tx?.type === 'string' ? tx.type : ''
  const reason = typeof tx?.reason === 'string' ? tx.reason : ''
  if (type === 'earn') {
    if (reason.startsWith('Bonus nivoa')) return 'bonus'
    if (reason.startsWith('Povišanje nivoa')) return 'upgrade'
    return 'earn'
  }
  switch (type) {
    case 'redeem':
      return 'redeem'
    case 'expire':
      return 'expire'
    case 'adjust':
    default:
      return 'adjust'
  }
}

/** Minimalna oblika transakcije, ki jo potrebujejo agregacijske funkcije. */
export interface LoyaltyTxLike {
  type: string
  points: number
  reason?: string | null
}

/**
 * Kategorije, ki se DEJANSKO pojavijo med transakcijami, v kanoničnem
 * vrstnem redu (LOYALTY_TX_CATEGORY_ORDER) — filter čipi pokažemo samo
 * za prisotne kategorije, da prazni čipi ne zamešljujejo.
 */
export function presentLoyaltyTxCategories(transactions: readonly LoyaltyTxLike[]): LoyaltyTxCategory[] {
  const present = new Set<LoyaltyTxCategory>()
  for (const tx of transactions ?? []) {
    present.add(loyaltyTxCategory(tx))
  }
  return LOYALTY_TX_CATEGORY_ORDER.filter((c) => present.has(c))
}

export interface LoyaltyTxSummary {
  /** Vsota pozitivnih točk (prislužene + bonusi). */
  earned: number
  /** Vsota |negativnih| točk (unovčenje, potek, negativne prilagoditve). */
  spent: number
  /** Neto sprememba = vsota VSEH točk (ground truth, vključno z 0-točkovnimi povišanji). */
  net: number
  /** Število transakcij v množici. */
  count: number
}

/**
 * Povzetek množice (FILTRIRANE) transakcij — številke opisujejo točno to,
 * kar je v tabeli. Neštevilske/NaN vrednosti šteje kot 0 (varnost).
 */
export function loyaltyTxSummary(transactions: readonly LoyaltyTxLike[]): LoyaltyTxSummary {
  let earned = 0
  let spent = 0
  let net = 0
  let count = 0
  for (const tx of transactions ?? []) {
    const p = Number.isFinite(tx?.points) ? (tx.points as number) : 0
    if (p > 0) earned += p
    else if (p < 0) spent += -p
    net += p
    count += 1
  }
  return { earned, spent, net, count }
}
