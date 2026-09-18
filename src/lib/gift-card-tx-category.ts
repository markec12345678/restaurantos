// ─── RUNDA 51: kategorizacija transakcij darilnih kartic ───
// ENOTEN VIR resnice za UI (Zgodovina dialog darilnih kartic) —
// zrcalna vzorca loyalty-tx-category.ts (R50): metapodatki (label,
// chip, accent) živijo tukaj, ikone ostanejo v komponenti.
//
// Dejstva iz sheme (prisma/schema.prisma, model GiftCardTransaction):
//  • load      → type 'load',    amount > 0  (nakladanje stanja)
//  • redeem    → type 'redeem',  amount < 0  (poraba na blagajni)
//  • transfer  → type 'transfer',            (prenos med karticami)
//  • adjust    → type 'adjust',              (ročna prilagoditev)
//
// Za razliko od zvestobe darilne kartice NIMA razloga, ki bi
// prekategoriziral transakcijo — kategorija = type, neznani tip →
// 'adjust' (isti fallback, ki ga je dialog doslej uporabljal).

export type GiftCardTxCategory = 'load' | 'redeem' | 'transfer' | 'adjust'

/** Kanonični vrstni red (najpogostejši najprej): nalaganje → poraba → prenos → prilagoditev. */
export const GIFT_CARD_TX_CATEGORY_ORDER: readonly GiftCardTxCategory[] = [
  'load',
  'redeem',
  'transfer',
  'adjust',
] as const

/** Bazalna (chip/accent) metapodatki kategorije — ikone ostanejo v komponenti. */
export const GIFT_CARD_TX_CATEGORY_META: Record<
  GiftCardTxCategory,
  { label: string; chip: string; accent: string }
> = {
  load: {
    label: 'Naloženo',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    accent: 'border-t-emerald-500/70',
  },
  redeem: {
    label: 'Unovčeno',
    chip: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    accent: 'border-t-red-500/70',
  },
  transfer: {
    label: 'Prenos',
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
    accent: 'border-t-violet-500/70',
  },
  adjust: {
    label: 'Prilagojeno',
    chip: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    accent: 'border-t-blue-500/70',
  },
}

/**
 * Kategoriziraj eno transakcijo. Neznani/manjkajoči type → 'adjust'
 * (varnostni pad — dialog je doslej neznane tipe risal kot adjust).
 */
export function giftCardTxCategory(tx: { type: string }): GiftCardTxCategory {
  const type = typeof tx?.type === 'string' ? tx.type : ''
  if (type === 'load') return 'load'
  if (type === 'redeem') return 'redeem'
  if (type === 'transfer') return 'transfer'
  return 'adjust'
}

/**
 * Kategorije, ki se PRISOTAJO v množici (v kanoničnem vrstnem redu,
 * brez duplikatov). Prazna množica → prazen seznam.
 */
export function presentGiftCardTxCategories(
  transactions: ReadonlyArray<{ type: string }>,
): GiftCardTxCategory[] {
  const present = new Set<GiftCardTxCategory>()
  for (const tx of transactions) present.add(giftCardTxCategory(tx))
  return GIFT_CARD_TX_CATEGORY_ORDER.filter((c) => present.has(c))
}

export interface GiftCardTxSummary {
  /** Vsota VSEH pozitivnih zneskov (nalaganja) — nikoli negativna. */
  loaded: number
  /** Vsota ABSOLUTNIH vrednosti negativnih zneskov (poraba/prenos ven) — nikoli negativna. */
  spent: number
  /** Neto sprememba stanja = loaded − spent (lahko 0, nikoli NaN). */
  net: number
  /** Število transakcij v množici. */
  count: number
}

/**
 * Povzetek množice transakcij (filtrirane ali vseh). NaN/Infinity
 * zneski so zaščiteni kot 0 (pokvarjeni podatki ne smejo razbiti KPI).
 */
export function giftCardTxSummary(
  transactions: ReadonlyArray<{ amount: number }>,
): GiftCardTxSummary {
  let loaded = 0
  let spent = 0
  for (const tx of transactions) {
    const amount = typeof tx?.amount === 'number' && Number.isFinite(tx.amount) ? tx.amount : 0
    if (amount > 0) loaded += amount
    else if (amount < 0) spent += Math.abs(amount)
  }
  loaded = Number.isFinite(loaded) ? loaded : 0
  spent = Number.isFinite(spent) ? spent : 0
  return {
    loaded,
    spent,
    net: loaded - spent,
    count: Array.isArray(transactions) ? transactions.length : 0,
  }
}
