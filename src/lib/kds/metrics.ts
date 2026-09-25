// ============================================
// KDS METRIKE — čista matematička lib (R133 / epic #115 P1-09)
// ============================================
// Kanon P1-09: metrike so READ-ONLY agregati nad bumped vrsticami — NIKOLI
// ne pišejo Order/OrderItem/KotDocument. Lib je BREZ db importa (testabilnost,
// pariteta src/lib/procurement/pack-size R131) — vrstice (KdsBumpedRow)
// zgradi klicatelj (route / testi).
//
// Kanonska pravila (agent-ctx/R133-design.md §3):
// 1. Base time za prep statistiko = `firedAt ?? createdAt` — ISTA semantika
//    kot KDS display fallback (R114): Sales tok ne nastavi firedAt, brez
//    fallbacka bi metrike slepo ignorirale polovico prometa. Razreši klicatelj
//    ALI helper resolveBaseAt() (spodaj).
// 2. prepMinutes: (readyAt − baseAt) / 60_000; negativno = 0 clamp (urni
//    zamik / DST: ready PRED base = napaka podatka — clamp 0, nikoli negativne
//    metrike). Neveljavni datumi (NaN) → null.
// 3. On-time meja INKLUSIVNA: elapsed ≤ target = on-time.
// 4. onTimeRate je null, če je onTimeSample = 0. Vrstice BREZ tarče
//    (targetMinutes null) so iz onTimeRate izključene, ampak štejejo v
//    count / itemsBumped.
// 5. Zaokroževanje: minute round 1 decimalka; procenti 0–100 round 1.
// 6. percentiles: linearna interpolacija, rank = p·(n−1), floor/ceil lerp.
// ============================================

export interface KdsBumpedRow {
  readyAt: Date
  /** firedAt ?? createdAt (kanon #1) — razreši klicatelj ALI resolveBaseAt() */
  baseAt: Date
  /** tarča priprave v minutah (null = brez tarče → izključena iz onTimeRate) */
  targetMinutes: number | null
  /** prepStation.type (null → 'other' v station breakdown) */
  station: string | null
  orderId: string
}

export interface KdsPrepStats {
  /** prep-stat vzorec (vse podane vrstice — vključno brez tarče) */
  count: number
  avgMinutes: number | null
  medianMinutes: number | null
  p90Minutes: number | null
  /** vzorec s tarčo (onTimeRate denominator) */
  onTimeSample: number
  /** 0–100, round 1; null če onTimeSample === 0 */
  onTimeRate: number | null
  lateCount: number
  /** povprečna prekoračitev (samo late), round 1; null če ni zamud */
  avgLateMinutes: number | null
}

export interface KdsStationBreakdown {
  station: string
  itemsBumped: number
  avgMinutes: number | null
  onTimeRate: number | null
  lateCount: number
}

const MS_PER_MINUTE = 60_000

/** Minute round 1 decimalka (kanon #5). */
export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Kanon #1: base time prep statistike = firedAt ?? createdAt. */
export function resolveBaseAt(
  firedAt: Date | null | undefined,
  createdAt: Date,
): Date {
  return firedAt ?? createdAt
}

/** Date-like → ms (NaN, če ni veljaven datum). Duck-typing prek getTime()
 * (instanceof je prečno-realm krhek v vmThreads testnih kontekstih). */
function dateToMs(value: unknown): number {
  if (value == null) return NaN
  if (typeof value === 'number') return value
  if (typeof value === 'object' && typeof (value as Date).getTime === 'function') {
    return (value as Date).getTime()
  }
  return NaN
}

/**
 * Prep minute za eno bumped vrstico: (readyAt − baseAt) / 60_000.
 * Negativna razlika (ready pred base — urni zamik / DST) → 0 clamp (kanon #2).
 * Neveljavni/manjkajoči datumi → null (nikoli NaN v agregate).
 */
export function prepMinutes(row: Pick<KdsBumpedRow, 'readyAt' | 'baseAt'>): number | null {
  const ready = dateToMs(row.readyAt)
  const base = dateToMs(row.baseAt)
  if (!Number.isFinite(ready) || !Number.isFinite(base)) return null
  const minutes = (ready - base) / MS_PER_MINUTE
  return minutes > 0 ? minutes : 0
}

/**
 * Percentil z linearno interpolacijo (kanon #6): rank = p·(n−1),
 * floor/ceil lerp. Pričakuje UREJEN seznam (ASC). Prazen → null.
 */
export function percentiles(sortedMinutes: number[], p: 0.5 | 0.9): number | null {
  if (!Array.isArray(sortedMinutes) || sortedMinutes.length === 0) return null
  if (typeof p !== 'number' || !Number.isFinite(p)) return null
  const n = sortedMinutes.length
  const rank = p * (n - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  if (lo === hi) return sortedMinutes[lo]
  const frac = rank - lo
  return sortedMinutes[lo] + (sortedMinutes[hi] - sortedMinutes[lo]) * frac
}

/**
 * Agregati prep časa nad bumped vrsticami (kanoni #2–#5).
 * count = celoten podani vzorec; minute agregati samo nad veljavnimi vrsticami;
 * onTimeRate samo nad vzorcem s tarčo (inkluzivna meja elapsed ≤ target).
 */
export function computePrepStats(rows: KdsBumpedRow[]): KdsPrepStats {
  const count = rows.length
  if (count === 0) {
    return {
      count: 0,
      avgMinutes: null,
      medianMinutes: null,
      p90Minutes: null,
      onTimeSample: 0,
      onTimeRate: null,
      lateCount: 0,
      avgLateMinutes: null,
    }
  }

  const minutes = rows
    .map(row => prepMinutes(row))
    .filter((m): m is number => m !== null)

  const avgMinutes = minutes.length > 0
    ? round1(minutes.reduce((sum, m) => sum + m, 0) / minutes.length)
    : null

  const sorted = [...minutes].sort((a, b) => a - b)
  const median = percentiles(sorted, 0.5)
  const p90 = percentiles(sorted, 0.9)

  // On-time vzorec: SAMO vrstice s tarčo (targetMinutes != null). Meja
  // INKLUSIVNA: elapsed ≤ target = on-time (kanon #3). Brez-tarčne vrstice so
  // iz onTimeRate izključene, ampak ostanejo v count / itemsBumped (kanon #4).
  let onTimeCount = 0
  let lateCount = 0
  let lateSumMinutes = 0
  let onTimeSample = 0
  for (const row of rows) {
    if (row.targetMinutes == null || !Number.isFinite(row.targetMinutes)) continue
    const m = prepMinutes(row)
    if (m === null) continue
    onTimeSample += 1
    if (m <= row.targetMinutes) {
      onTimeCount += 1
    } else {
      lateCount += 1
      lateSumMinutes += m - row.targetMinutes
    }
  }

  return {
    count,
    avgMinutes,
    medianMinutes: median === null ? null : round1(median),
    p90Minutes: p90 === null ? null : round1(p90),
    onTimeSample,
    onTimeRate: onTimeSample > 0 ? round1((onTimeCount / onTimeSample) * 100) : null,
    lateCount,
    avgLateMinutes: lateCount > 0 ? round1(lateSumMinutes / lateCount) : null,
  }
}

/**
 * Breakdown po postajah (kanon: groupBy station, null → 'other'), sortirano
 * po itemsBumped desc (najbolj obremenjena postaja prva; enak izkupiček →
 * obstoječi vrstni red vstavljanja — stabilen sort).
 */
export function computeStationBreakdown(rows: KdsBumpedRow[]): KdsStationBreakdown[] {
  const groups = new Map<string, KdsBumpedRow[]>()
  for (const row of rows) {
    const key = row.station ?? 'other'
    const bucket = groups.get(key)
    if (bucket) bucket.push(row)
    else groups.set(key, [row])
  }

  const breakdown: KdsStationBreakdown[] = []
  for (const [station, groupRows] of groups) {
    const stats = computePrepStats(groupRows)
    breakdown.push({
      station,
      itemsBumped: groupRows.length,
      avgMinutes: stats.avgMinutes,
      onTimeRate: stats.onTimeRate,
      lateCount: stats.lateCount,
    })
  }
  return breakdown.sort((a, b) => b.itemsBumped - a.itemsBumped)
}
