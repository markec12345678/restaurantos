// ============================================
// ZGODOVINA NABAVNIH CEN — STATS KANON (P1-08, epic #115, runda 130)
// ============================================
//
// ČIST modul (BREZ DB klicev — pariteta z '@/lib/reorder/canon'):
// povzetki cen (summarizePrices), izbira najboljšega dobavitelja
// (pickBestSupplier) in račun marže (computeMarginPercent).
//
// Decimal kontrakt (hišni kanon): IZRAČUN je EXACT v Prisma.Decimal,
// IZPIS je STRING. Vhodne cene sprejmejo vse DecimalLike oblike
// (string | number | Prisma.Decimal) prek '@/lib/decimal' → toDec.
//
//   avg30 / avg90  = povprečje cen v zadnjih 30/90 dneh (observedAt okno
//                    "od zdaj"; izpis toFixed(4) — pariteta s stolpcem
//                    DECIMAL(12,4))
//   min90 / max90  = min/max v 90-dnevnem oknu (EXACT string)
//   lastPrice/lastAt = zadnje opažanje (max observedAt; EXACT string / ISO)
//   trend          = PROBE (zadnje opažanje) vs povprečje STAREJŠIH opazovanj
//                    v 30-dnevnem oknu (baseline IZKLJUČI probe — sicer zadnja
//                    cena vleče svojo lastno primerjavo in točne meje ±5 %
//                    niso izračunljive): Δ > +5% → 'up', < −5% → 'down',
//                    sicer 'stable'. < 2 opažanji v oknu (probe + vsaj 1
//                    baseline) = 'insufficient' (kanon P1-07: če podatkov ni
//                    dovolj, ne izmišljujemo; degenerirana primerjava
//                    last-vs-last je 'insufficient', ne lažni 'stable').
//
// Determinističnost: summarizePrices sprejme opcionalen `now` (testi),
// privzeto new Date().
// ============================================

import { Prisma } from '@prisma/client'
import { toDec, greaterThan } from '../decimal'

export type DecimalLike = string | number | Prisma.Decimal

/** Vhodna vrstica za summarizePrices (Decimal-like cena + čas opažanja). */
export interface PriceHistoryRowInput {
  unitPrice: DecimalLike
  observedAt: Date | string
}

export type PriceTrend = 'up' | 'down' | 'stable' | 'insufficient'

export interface PriceSummary {
  lastPrice: string | null
  lastAt: string | null
  avg30: string | null
  avg90: string | null
  min90: string | null
  max90: string | null
  count: number
  trend: PriceTrend
}

// --- Kanonske konstante (edini vir resnice za UI hinte) ---
/** Okno povprečja za trend primerjavo (dni). */
export const TREND_WINDOW_DAYS = 30
/** Dolgo okno povprečja/min/max (dni). */
export const LONG_WINDOW_DAYS = 90
/** Prag trenda v % (EXACT: |Δ%| > 5 → up/down; točno ±5 je 'stable'). */
export const TREND_THRESHOLD_PERCENT = 5
/** Število opazovanj v trend oknu pod katerim je trend 'insufficient'. */
export const TREND_MIN_OBSERVATIONS = 2
/** Izpis povprečij — pariteta s stolpcem DECIMAL(12,4). */
export const AVG_OUTPUT_DECIMALS = 4

const DAY_MS = 86_400_000

/** Povprečje izvrstic izračunano EXACT v Decimal, izpis toFixed(4). */
function avgDecimal(prices: Prisma.Decimal[]): string | null {
  if (prices.length === 0) return null
  const sum = prices.reduce((acc, p) => acc.plus(p), new Prisma.Decimal(0))
  return sum.dividedBy(prices.length).toFixed(AVG_OUTPUT_DECIMALS)
}

/**
 * Povzetek zgodovine cen za EN (dobavitelj, artikel) par — čist, determinističen.
 *
 * @param rows - zgodovinske vrstice (poljuben vrstni red; funkcija sortira)
 * @param opts.now - referenčni "zdaj" (default: new Date()) — za testne fiksure
 */
export function summarizePrices(
  rows: readonly PriceHistoryRowInput[],
  opts?: { now?: Date },
): PriceSummary {
  const now = opts?.now ?? new Date()

  if (rows.length === 0) {
    return {
      lastPrice: null, lastAt: null, avg30: null, avg90: null,
      min90: null, max90: null, count: 0, trend: 'insufficient',
    }
  }

  // Normalizacija: (observedAt, price) pari, naraščajoče po času (stabilno —
  // izenačeni časi ohranijo vhodni vrstni red, zadnji zmaguje za lastPrice).
  const normalized = rows.map((r, idx) => ({
    idx,
    at: new Date(r.observedAt),
    price: toDec(r.unitPrice),
  }))
  normalized.sort((a, b) => (a.at.getTime() !== b.at.getTime()
    ? a.at.getTime() - b.at.getTime()
    : a.idx - b.idx))

  const last = normalized[normalized.length - 1]
  const cutoff30 = new Date(now.getTime() - TREND_WINDOW_DAYS * DAY_MS)
  const cutoff90 = new Date(now.getTime() - LONG_WINDOW_DAYS * DAY_MS)

  const in30 = normalized.filter(r => r.at.getTime() >= cutoff30.getTime())
  const in90 = normalized.filter(r => r.at.getTime() >= cutoff90.getTime())

  // Trend: EXACT primerjava PROBE (globalno zadnje opažanje) vs povprečje
  // STAREJŠIH opažanj v 30-dnevnem oknu (vse Decimal). in30 je naraščajoče
  // sortiran in vsebuje probe (če je globalni last zunaj 30-dnevnega okna,
  // je in30 prazen) — zato je baseline in30 BREZ zadnjega elementa. Meja:
  // točno ±5% je 'stable' (spec: >5% up, <−5% down, sicer stable). <2
  // opažanji v oknu = 'insufficient' (stara zgodovina ne dokazuje trenda).
  let trend: PriceTrend
  const baselines = in30.slice(0, -1)
  if (in30.length < TREND_MIN_OBSERVATIONS || baselines.length === 0) {
    trend = 'insufficient'
  } else {
    const avg30Dec = baselines.reduce((acc, r) => acc.plus(r.price), new Prisma.Decimal(0))
      .dividedBy(baselines.length)
    const pctChange = last.price.minus(avg30Dec).dividedBy(avg30Dec).times(100)
    if (greaterThan(pctChange, TREND_THRESHOLD_PERCENT)) trend = 'up'
    else if (greaterThan(pctChange.times(-1), TREND_THRESHOLD_PERCENT)) trend = 'down'
    else trend = 'stable'
  }

  return {
    lastPrice: last.price.toString(),
    lastAt: last.at.toISOString(),
    avg30: avgDecimal(in30.map(r => r.price)),
    avg90: avgDecimal(in90.map(r => r.price)),
    min90: in90.length > 0
      ? in90.reduce<Prisma.Decimal>((min, r) => (r.price.comparedTo(min) < 0 ? r.price : min), in90[0].price).toString()
      : null,
    max90: in90.length > 0
      ? in90.reduce<Prisma.Decimal>((max, r) => (r.price.comparedTo(max) > 0 ? r.price : max), in90[0].price).toString()
      : null,
    count: normalized.length,
    trend,
  }
}

// ============================================
// PICK BEST SUPPLIER — UI hint ("najugodnejši dobavitelj")
// ============================================

/** Vnos: par (dobavitelj, njegov povzetek cen; null zgodovina dovoljena). */
export interface SupplierSummaryPair {
  supplierId: string
  summary: PriceSummary | null
}

export interface BestSupplierHint {
  supplierId: string | null
  lastPrice: string | null
}

/**
 * Najnižji lastPrice med dobavitelji (EXACT Decimal primerjava).
 * Dobavitelji brez zgodovine (summary null ALI lastPrice null) so izključeni.
 * Vsem manjkajo zgodovina → { supplierId: null, lastPrice: null }.
 * Izenačeni ceni zmaguje PRVI v vhodnem vrstnem redu (deterministično).
 * lastPrice se vrne EXACT kot vhodni string (brez Decimal re-kanonizacije —
 * '3.90' ostane '3.90', hišni kanon EXACT round-trip).
 */
export function pickBestSupplier(summaries: readonly SupplierSummaryPair[]): BestSupplierHint {
  let best: BestSupplierHint = { supplierId: null, lastPrice: null }
  for (const pair of summaries) {
    const raw = pair.summary?.lastPrice ?? null
    if (raw == null) continue
    const price = toDec(raw)
    if (!price.isFinite() || price.comparedTo(0) <= 0) continue
    if (best.lastPrice == null || price.comparedTo(toDec(best.lastPrice)) < 0) {
      best = { supplierId: pair.supplierId, lastPrice: raw }
    }
  }
  return best
}

// ============================================
// MARGIN — (price − cost) / price kot string % (1 decimalka)
// ============================================

/**
 * Marža v % kot string, zaokrožena na 1 decimalko. Negativna marža je
 * dovoljena (izguba). `sellingPrice <= 0` (ali ne-finite) → null —
 * kanon: brez cene ni marže, ne izmišljujemo.
 */
export function computeMarginPercent(sellingPrice: DecimalLike, cost: DecimalLike): string | null {
  const price = toDec(sellingPrice)
  if (!price.isFinite() || price.comparedTo(0) <= 0) return null
  const pct = price.minus(toDec(cost)).dividedBy(price).times(100)
  return pct.toFixed(1)
}
