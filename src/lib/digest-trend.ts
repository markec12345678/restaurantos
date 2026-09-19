// ============================================
// DIGEST TREND — trend za dnevni povzetek (R71: 7 dni, R72: 7/30 toggle)
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
  /** R72: ali stolpec pokaže tekstovno oznako (gostota: >14 dni → redkejše:
   * vsak 5. + zadnji + najboljši; ≤14 dni → vsi) — oznake ostanejo v
   * aria-labelih stolpcev za bralnike zapisa */
  showLabel: boolean
  /** R72: je dan PONEDELJEK (tedenski ločilnik v mesecni sparkline) */
  isWeekStart: boolean
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

/** Notranji: razčleni 'YYYY-MM-DD' → UTC dele ali null. Polni range-check:
 *  Date.UTC TIHO normalizira izven-obseg dneve ('2026-02-30' → 1. mar!),
 *  zato zahtevamo round-trip (konstruirani UTC deli = vhodni deli). */
function parseUTCDateStrict(dateStr: string): { y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr).trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (Number.isNaN(dt.getTime())) return null
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return { y, mo, d }
}

/** Kratka slovenska oznaka dneva za 'YYYY-MM-DD' (brez Intl — deterministično).
 *  Validira obseg (mesec 1–12, dolžina meseca — Date.UTC sicer TIHO normalizira
 *  izven obsega, npr. '2026-02-30' → 1. mar) in vrne napačno oznako. */
export function slShortDayLabel(dateStr: string): string {
  const p = parseUTCDateStrict(dateStr)
  if (!p) return ''
  return SL_DAYS_SHORT[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()]
}

/** R72: tedenski ločilnik — je 'YYYY-MM-DD' ponedeljek? (neveljaven vhod → false;
 *  polni range-check — Date.UTC tiho normalizira '2026-02-30' → 1. mar) */
export function isWeekStart(dateStr: string): boolean {
  const p = parseUTCDateStrict(dateStr)
  if (!p) return false
  return new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay() === 1
}

/** Prag gosto/redko oznake: >14 stolpcev → oznake vsak 5. dan (R72). */
export const SPARSE_LABEL_THRESHOLD = 14

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

  // R72: gosto/redko oznake — pri >SPARSE_LABEL_THRESHOLD stolpcih se tekstovne
  // oznake izpisujejo vsak 5. dan + zadnji + najboljši (ostali ostanejo prazni,
  // a ohranijo višino vrstice — brez layout shift-a); podatki ostanejo v
  // aria-labelih in title nasvetih
  const sparse = sorted.length > SPARSE_LABEL_THRESHOLD
  const lastIdx = sorted.length - 1

  const points: TrendPoint[] = sorted.map((d, i) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.date)!
    const dayNum = Number(m[3])
    const isBest = bestDate === d.date
    return {
      date: d.date,
      revenue: d.revenue,
      ordersCount: d.ordersCount,
      dayLabel: slShortDayLabel(d.date),
      dayNum,
      // 0 promet → višina 0 (UI nariše 2px stub prek minHeight); min 2 % velja
      // samo za pozitivne vrednosti da so majhni stolpci očesno vidni
      heightPct: d.revenue > 0 && max > 0 ? Math.max((d.revenue / max) * 100, 2) : 0,
      isBest,
      showLabel: !sparse || i % 5 === 4 || i === lastIdx || isBest,
      isWeekStart: isWeekStart(d.date),
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
