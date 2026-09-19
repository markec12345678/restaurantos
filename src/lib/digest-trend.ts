// ============================================
// DIGEST TREND — 7-dnevni trend za dnevni povzetek (R71)
// ============================================
// Čista, strežniško-varna biblioteka (isti vzorec kot pctChange R65 /
// tierLabelSl R62 / paymentMethodLabelSl R62):
//   • computeDigestTrend(raw) — iz surovih dnevnih agregatov izračuna
//     točke sparkline-a (širine/višine %, oznake dni, "najboljši dan",
//     skupka + povprečje)
//   • slShortDayLabel(dateStr) — kratka slovenska oznaka dneva ("pon",
//     "tor", …) BREZ Intl (deterministično v VSEH okoljih — Vercel edge,
//     node, testi; Intl z "sl" ni zagotovljen na vseh runtime-ih)
//   • formatEURShort(v) — kompakten format za oznake nad stolpci
//     ("1.235 €" — brez centov, tisočice s piko)
//
// Pravila:
//   • vhodni dnevi so sortirani po datumu NAROBE — lib sortira ASC in
//     obreže na ZADNJIH `days` (privzeto 7) vnosov
//   • ne-finitne/negativne vrednosti → 0 (fail-safe, kot toNum v digest)
//   • max <= 0 (vsi dnevi brez prometa) → vse širine 0, brez "najboljšega"
//     dneva (bestDate null) — UI pokaže prazno stanje
//   • dnevnik duplikatov (isti datum 2×) → ZDRUŽI (vsota) — API lahko
//     v prihodnosti agregira iz več virov
// ============================================

export interface TrendDayRaw {
  date: string // 'YYYY-MM-DD'
  revenue: number
  ordersCount: number
}

export interface TrendPoint {
  date: string
  revenue: number
  ordersCount: number
  /** Kratka slovenska oznaka dneva: pon/tor/sre/čet/pet/sob/ned */
  dayLabel: string
  /** Dan v mesecu (18) — pod labelo v sparkline-u */
  dayNum: number
  /** Višina stolpca v % (0–100), relativno na najboljši dan */
  heightPct: number
  /** Najboljši dan v obdobju (najvišji promet; izenačeni → prvi zasede) */
  isBest: boolean
}

export interface DigestTrend {
  points: TrendPoint[]
  /** Število dni v trendu (po obrezovanju/združevanju) */
  dayCount: number
  /** Skupni promet v obdobju */
  total: number
  /** Povprečje na dan (total / dayCount; 0 če dayCount === 0) */
  avgPerDay: number
  /** Skupno število naročil v obdobju */
  totalOrders: number
  /** Datum najboljšega dne ali null (brez prometa / prazen vhod) */
  bestDate: string | null
  /** Višina črtkane linije povprečja v % (0–100) ali null (brez prometa) */
  avgLinePct: number | null
}

const SL_DAYS_SHORT = ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob'] as const

/** Kratka slovenska oznaka dneva za 'YYYY-MM-DD' (brez Intl — deterministično).
 *  Validira tudi obseg (mesec 1–12, dan 1–31) — Date.UTC sicer TIHO normalizira
 *  izven obsega (npr. '2026-13-99' → veljaven datum!) in vrne napačno oznako. */
export function slShortDayLabel(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr).trim())
  if (!m) return ''
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return ''
  const dt = new Date(Date.UTC(Number(m[1]), mo - 1, d))
  if (Number.isNaN(dt.getTime())) return ''
  return SL_DAYS_SHORT[dt.getUTCDay()]
}

/** Kompakten format za oznake nad stolpci: brez centov, tisočice s piko.
 *  Ročna implementacija (NE Intl) — isti razlog kot formatEUR v safe-format:
 *  Node small-ICU nima podatkov za lokalo → deterministično povsod. */
export function formatEURShort(v: unknown): string {
  const n = Number(v)
  const safe = Number.isFinite(n) && n > 0 ? n : 0
  const grouped = String(Math.round(safe)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${grouped} €`
}

function toSafeNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Iz surovih dnevnih agregatov zgradi trend za sparkline. Čista funkcija —
 * brez db/React odvisnosti, uporablja jo API (digest-trend route) in testi.
 */
export function computeDigestTrend(raw: TrendDayRaw[], days = 7): DigestTrend {
  const empty: DigestTrend = {
    points: [],
    dayCount: 0,
    total: 0,
    avgPerDay: 0,
    totalOrders: 0,
    bestDate: null,
    avgLinePct: null,
  }
  if (!Array.isArray(raw) || raw.length === 0) return empty

  // 1) Združi duplikate po datumu + fail-safe številke
  const byDate = new Map<string, TrendDayRaw>()
  for (const r of raw) {
    if (!r || typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue
    const existing = byDate.get(r.date)
    if (existing) {
      existing.revenue += toSafeNum(r.revenue)
      existing.ordersCount += toSafeNum(r.ordersCount)
    } else {
      byDate.set(r.date, { date: r.date, revenue: toSafeNum(r.revenue), ordersCount: toSafeNum(r.ordersCount) })
    }
  }
  if (byDate.size === 0) return empty

  // 2) Sortiraj ASC po datumu + obreži na zadnjih `days`
  const sorted = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-Math.max(1, Math.floor(days)))

  // 3) Skaliranje: višine % relativno na max promet
  const max = Math.max(...sorted.map(d => d.revenue))
  let bestDate: string | null = null
  let bestRevenue = -1
  for (const d of sorted) {
    if (d.revenue > bestRevenue) {
      bestRevenue = d.revenue
      bestDate = d.date
    }
  }

  const points: TrendPoint[] = sorted.map(d => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.date)!
    const dayNum = Number(m[3])
    return {
      date: d.date,
      revenue: d.revenue,
      ordersCount: d.ordersCount,
      dayLabel: slShortDayLabel(d.date),
      dayNum,
      // 0 promet → višina 0 (UI nariše 2px stub prek minHeight); min 2 % velja
      // samo za pozitivne vrednosti da so majhni stolpci očesno vidni
      heightPct: d.revenue > 0 && max > 0 ? Math.max((d.revenue / max) * 100, 2) : 0,
      isBest: bestDate === d.date,
    }
  })

  const total = sorted.reduce((s, d) => s + d.revenue, 0)
  const totalOrders = sorted.reduce((s, d) => s + d.ordersCount, 0)

  return {
    points,
    dayCount: points.length,
    total,
    avgPerDay: points.length > 0 ? total / points.length : 0,
    totalOrders,
    bestDate: bestRevenue > 0 ? bestDate : null,
    avgLinePct: max > 0 && total > 0 ? Math.max((total / points.length / max) * 100, 2) : null,
  }
}
