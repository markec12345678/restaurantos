// ============================================
// _helpers — GET /api/analytics/overview (epic #115 #36 Advanced analytics, R149-b)
// ============================================
// Čist strežniški modul (BREZ UI importov): okno/bucket matematika +
// agregacije + deterministični sorti. Konstante ANALYTICS_MAX_WINDOW_DAYS in
// ANALYTICS_ROW_CAP so izvožene za teste (fail-closed caps, R148 CAP precedens).
//
// Kanoni:
//   • Okno po LJ koledarju (P2-08, src/lib/timezone-sl.ts — ljubljanaDayBounds
//     je CET/CEST-varen); `end` datum je INKLUZIVEN → endExclusive = polnoč
//     naslednjega LJ dneva. Prejšnje primerjalno okno = enako dolgo, takoj
//     pred `start` (prevStart/prevEnd).
//   • EN order.findMany z minimalnim selectom + determinističen orderBy
//     [{paidAt:'asc'},{id:'asc'}] → JS bucketizacija day (LJ koledar) /
//     week (ISO) / month — fiksno dolge serije VKLJUČNO s praznimi vedri.
//   • comparison: order.aggregate nad prejšnjim oknom + pctChange (R65,
//     '@/lib/percent-change' — prev <= 0 → null, deljenje z 0 brez "∞ %";
//     kanon lib/email/daily-digest.ts).
//   • topItems/categoryBreakdown: orderItem.groupBy po menuItemId
//     (voided:false, naročila paid-window+scope), _sum quantity/price →
//     JS re-sort z ID tie-breakerjem; imena = prikazni lookup
//     (menuItem.findMany in:id). revenue = price_sum × quantity_sum
//     (NETO semantika — dashboard _helpers-analytics precedens).
//   • hourlyProfile: fiksni 24-vektor po LJ uri (ljubljanaDateTimeParts —
//     NIKOLI server-local getHours(), kar krši P2-08).
//   • paymentMix: payment.groupBy by type (status 'completed',
//     check.order paid-window+scope) — Payment ledger = §28 source of truth;
//     order.paymentMethod legacy fallback NI uporabljen.
//   • orderTypeMix: order.groupBy by type + _sum total + _count.
//   • staffPerformance: order.groupBy by employeeId (not null) top 20 →
//     employee.findMany (prikazna imena) → sort revenue desc, orders desc,
//     employeeId asc — zapira dashboard 'Nedodeljeno' placeholder vrzel.
//   • Vsi Decimal → number skozi toNum/round2; odgovor skozi deepToNumbers;
//     NIČ timestampov (generatedAt prepovedan) → byte-identični ponovni klici.
// ============================================

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { toNum, round2, deepToNumbers } from '@/lib/decimal'
import { ljubljanaDayBounds, ljubljanaDateTimeParts } from '@/lib/timezone-sl'
import { pctChange } from '@/lib/percent-change'

// ── Fail-closed caps (izvoženi za teste) ────────────────────────────────────
/** Največja dolžina okna v dnevih (strožje od validateReportDateRange 366d). */
export const ANALYTICS_MAX_WINDOW_DAYS = 90
/** Fail-closed cap: order.count() pre-check → 400, če okno vsebuje več naročil. */
export const ANALYTICS_ROW_CAP = 50_000

const TOP_ITEMS_CAP = 10
const STAFF_PERFORMANCE_CAP = 20

export type Granularity = 'day' | 'week' | 'month'
export const ANALYTICS_GRANULARITIES: readonly Granularity[] = ['day', 'week', 'month'] as const

// ── Datumski pripomočki (čisti, koledarski — brez ur/ČZ) ───────────────────

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

/** 'YYYY-MM-DD' → UTC ms polnoči tega koledarskega datuma (nižje od LJ okna). */
function ymdToUtcMs(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00.000Z`)
}

export function isValidYmd(s: string): boolean {
  return YMD_RE.test(s) && !Number.isNaN(ymdToUtcMs(s))
}

/** Koledarski datum ± celo število dni (čisto UTC-date aritmetika). */
function addDays(ymd: string, days: number): string {
  return new Date(ymdToUtcMs(ymd) + days * 86_400_000).toISOString().slice(0, 10)
}

/** ISO teden (ponedeljkovo pravilo) za koledarski datum. */
function isoWeekInfo(ymd: string): { year: number; week: number } {
  const date = new Date(ymdToUtcMs(ymd))
  const dayNum = (date.getUTCDay() + 6) % 7 // pon=0 … ned=6
  const thursday = new Date(date)
  thursday.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1))
  const fd = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fd + 3)
  if (firstThursday.getUTCFullYear() < thursday.getUTCFullYear()) {
    firstThursday.setUTCDate(firstThursday.getUTCDate() + 7)
  }
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
  return { year: thursday.getUTCFullYear(), week }
}

function isoWeekLabel(ymd: string): string {
  const { year, week } = isoWeekInfo(ymd)
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** Ponedeljek ISO tedna, ki vsebuje podani datum. */
function mondayOfIsoWeek(ymd: string): string {
  const date = new Date(ymdToUtcMs(ymd))
  const dayNum = (date.getUTCDay() + 6) % 7
  return addDays(ymd, -dayNum)
}

function firstOfNextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10) // mesec je 0-based → `m` = naslednji
}

// ── Okno ───────────────────────────────────────────────────────────────────

export type AnalyticsWindow = {
  start: string
  end: string
  granularity: Granularity
  prevStart: string
  prevEnd: string
  windowDays: number
  /** UTC trenutek ljubljanske polnoči začetnega dne. */
  startUTC: Date
  /** UTC trenutek ljubljanske polnoči dneva PO `end` (end je inkluziven). */
  endExclusiveUTC: Date
  prevStartUTC: Date
  prevEndExclusiveUTC: Date
}

export type AnalyticsParamsResult = { error: string } | { window: AnalyticsWindow }

/**
 * Validacija query parametrov (start/end/granularity) + fail-closed caps.
 * Sporočila v slovenščini, konsistentna z validateReportDateRange kanonom
 * ('Začetni datum mora biti v formatu YYYY-MM-DD', 'Začetni datum ne more
 * biti pred 2020', 'Začetni datum mora biti pred končnim').
 */
export function validateAnalyticsParams(
  start: string | null,
  end: string | null,
  granularity: string | null,
): AnalyticsParamsResult {
  if (!start) return { error: 'Začetni datum je obvezen.' }
  if (!end) return { error: 'Končni datum je obvezen.' }
  if (!isValidYmd(start)) return { error: 'Začetni datum mora biti v formatu YYYY-MM-DD' }
  if (!isValidYmd(end)) return { error: 'Končni datum mora biti v formatu YYYY-MM-DD' }

  // prazen string = privzetek (canon `searchParams.get('x') || default`, r146)
  const gran = (granularity || 'day') as Granularity
  if (!ANALYTICS_GRANULARITIES.includes(gran)) {
    return { error: 'Neznana granularnost. Dovoljene: day, week, month' }
  }

  if (ymdToUtcMs(start) < ymdToUtcMs('2020-01-01')) {
    return { error: 'Začetni datum ne more biti pred 2020' }
  }
  if (ymdToUtcMs(start) > ymdToUtcMs(end)) {
    return { error: 'Začetni datum mora biti pred končnim' }
  }
  const windowDays = Math.round((ymdToUtcMs(end) - ymdToUtcMs(start)) / 86_400_000) + 1
  if (windowDays > ANALYTICS_MAX_WINDOW_DAYS) {
    return {
      error: `Obdobje ne sme preseči ${ANALYTICS_MAX_WINDOW_DAYS} dni. Uporabite manjše obdobje.`,
    }
  }

  // Prejšnje okno: enako dolgo, takoj pred start (prevEnd = dan pred start).
  const prevEnd = addDays(start, -1)
  const prevStart = addDays(start, -windowDays)
  return {
    window: {
      start,
      end,
      granularity: gran,
      prevStart,
      prevEnd,
      windowDays,
      startUTC: ljubljanaDayBounds(start).start,
      endExclusiveUTC: ljubljanaDayBounds(end).end,
      prevStartUTC: ljubljanaDayBounds(prevStart).start,
      prevEndExclusiveUTC: ljubljanaDayBounds(start).start,
    },
  }
}

// ── Vrste vrstic (minimalni select / groupBy rezultati) ────────────────────

type OrderRow = {
  paidAt: Date | null
  total: Prisma.Decimal
  tip: Prisma.Decimal
  tax: Prisma.Decimal
  discount: Prisma.Decimal
  type: string
  employeeId: string | null
}

type MenuItemGroup = {
  menuItemId: string
  _sum: { quantity: number | null; price: Prisma.Decimal | null }
}

type PaymentGroup = {
  type: string
  _sum: { amount: Prisma.Decimal | null; tipAmount: Prisma.Decimal | null }
  _count: number
}

type OrderTypeGroup = {
  type: string
  _sum: { total: Prisma.Decimal | null }
  _count: number
}

type StaffGroup = {
  employeeId: string | null
  _sum: { total: Prisma.Decimal | null }
  _count: number
}

const locationWhere = (locId: string | null): { locationId?: string } =>
  locId ? { locationId: locId } : {}

// ── Serija: fiksno dolga polja vedrov (vključno s praznimi) ────────────────

type SeriesBucket = {
  bucket: string
  start: string
  end: string
  revenue: number
  orders: number
  avgOrderValue: number
}

function emptyBucket(bucket: string, fromYmd: string, toYmdExclusive: string): SeriesBucket {
  return {
    bucket,
    start: ljubljanaDayBounds(fromYmd).start.toISOString(),
    end: ljubljanaDayBounds(toYmdExclusive).start.toISOString(),
    revenue: 0,
    orders: 0,
    avgOrderValue: 0,
  }
}

function enumerateBuckets(win: AnalyticsWindow): SeriesBucket[] {
  if (win.granularity === 'day') {
    const buckets: SeriesBucket[] = []
    for (let d = win.start; d <= win.end; d = addDays(d, 1)) {
      buckets.push(emptyBucket(d, d, addDays(d, 1)))
    }
    return buckets
  }
  if (win.granularity === 'week') {
    const buckets: SeriesBucket[] = []
    for (let monday = mondayOfIsoWeek(win.start); ymdToUtcMs(monday) <= ymdToUtcMs(win.end); monday = addDays(monday, 7)) {
      buckets.push(emptyBucket(isoWeekLabel(monday), monday, addDays(monday, 7)))
    }
    return buckets
  }
  // month
  const buckets: SeriesBucket[] = []
  const endMonth = win.end.slice(0, 7)
  for (let ym = win.start.slice(0, 7); ym <= endMonth; ym = firstOfNextMonth(ym).slice(0, 7)) {
    const first = `${ym}-01`
    buckets.push(emptyBucket(ym, first, firstOfNextMonth(ym)))
  }
  return buckets
}

/** Ključ vedra za LJ koledarski datum pri dani granularnosti. */
function bucketKeyForDate(dateYmd: string, gran: Granularity): string {
  if (gran === 'day') return dateYmd
  if (gran === 'week') return isoWeekLabel(dateYmd)
  return dateYmd.slice(0, 7)
}

// ── Deterministični sorti (tie-breaker po ID — R149-a kanon) ───────────────

function byQuantityThenRevenueThenId(a: MenuItemGroup, b: MenuItemGroup): number {
  const qa = a._sum.quantity ?? 0
  const qb = b._sum.quantity ?? 0
  if (qb !== qa) return qb - qa
  const ra = toNum(a._sum.price) * qa
  const rb = toNum(b._sum.price) * qb
  if (rb !== ra) return rb - ra
  return a.menuItemId < b.menuItemId ? -1 : a.menuItemId > b.menuItemId ? 1 : 0
}

// ── Glavna agregacija ──────────────────────────────────────────────────────

export type AnalyticsOverviewResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; reason: 'row_cap'; count: number }

export async function buildAnalyticsOverview(
  locId: string | null,
  win: AnalyticsWindow,
): Promise<AnalyticsOverviewResult> {
  const loc = locationWhere(locId)
  const paidWindow: Prisma.OrderWhereInput = {
    paymentStatus: 'paid',
    paidAt: { gte: win.startUTC, lt: win.endExclusiveUTC },
    ...loc,
  }
  const prevWindow: Prisma.OrderWhereInput = {
    paymentStatus: 'paid',
    paidAt: { gte: win.prevStartUTC, lt: win.prevEndExclusiveUTC },
    ...loc,
  }

  // Fail-closed ROW_CAP: count pre-check ŠELE pred findMany (presežen → 400,
  // findMany/aggregate/groupBy se NIKOLI ne pokličejo).
  const rowCount = await db.order.count({ where: paidWindow })
  if (rowCount > ANALYTICS_ROW_CAP) {
    return { ok: false, reason: 'row_cap', count: rowCount }
  }

  const [rows, prevAgg, topGroups, catGroups, paymentGroups, typeGroups, staffGroups] =
    await Promise.all([
      db.order.findMany({
        where: paidWindow,
        select: { paidAt: true, total: true, tip: true, tax: true, discount: true, type: true, employeeId: true },
        orderBy: [{ paidAt: 'asc' }, { id: 'asc' }],
      }),
      db.order.aggregate({ where: prevWindow, _sum: { total: true }, _count: true }),
      db.orderItem.groupBy({
        by: ['menuItemId'],
        where: { voided: false, order: paidWindow },
        _sum: { quantity: true, price: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: TOP_ITEMS_CAP,
      }),
      db.orderItem.groupBy({
        by: ['menuItemId'],
        where: { voided: false, order: paidWindow },
        _sum: { quantity: true, price: true },
      }),
      db.payment.groupBy({
        by: ['type'],
        where: { status: 'completed', check: { order: paidWindow } },
        _sum: { amount: true, tipAmount: true },
        _count: true,
      }),
      db.order.groupBy({
        by: ['type'],
        where: paidWindow,
        _sum: { total: true },
        _count: true,
      }),
      db.order.groupBy({
        by: ['employeeId'],
        where: { ...paidWindow, employeeId: { not: null } },
        _sum: { total: true },
        _count: true,
      }),
    ])

  // ── KPI + serija + urni profil: EN prehod skozi minimalne vrstice ──
  let revenueRaw = 0
  let taxRaw = 0
  let tipsRaw = 0
  let discountsRaw = 0
  let orders = 0

  const series = enumerateBuckets(win)
  const seriesIndex = new Map(series.map((b, i) => [b.bucket, i]))
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    revenue: 0,
    orders: 0,
  }))

  for (const row of rows as OrderRow[]) {
    if (!row.paidAt) continue
    const total = toNum(row.total)
    const parts = ljubljanaDateTimeParts(row.paidAt.toISOString()) // { date:'YYYY-MM-DD', time:'HH:mm' } po LJ

    // KPI
    revenueRaw += total
    taxRaw += toNum(row.tax)
    tipsRaw += toNum(row.tip)
    discountsRaw += toNum(row.discount)
    orders += 1

    // Serija (fiksna vedra; vrstica izven enumeracije se varno ignorira)
    const idx = seriesIndex.get(bucketKeyForDate(parts.date, win.granularity))
    if (idx !== undefined) {
      series[idx].revenue += total
      series[idx].orders += 1
    }

    // Urni profil po LJ uri (0–23) — P2-08: NIKOLI server-local getHours()
    const hour = Number(parts.time.slice(0, 2))
    if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
      hourly[hour].revenue += total
      hourly[hour].orders += 1
    }
  }

  const kpis = {
    revenue: round2(revenueRaw),
    tax: round2(taxRaw),
    tips: round2(tipsRaw),
    discounts: round2(discountsRaw),
    orders,
    avgOrderValue: orders > 0 ? round2(revenueRaw / orders) : 0,
  }

  const finalizedSeries = series.map((b) => ({
    ...b,
    revenue: round2(b.revenue),
    avgOrderValue: b.orders > 0 ? round2(b.revenue / b.orders) : 0,
  }))

  const hourlyProfile = hourly.map((h) => ({ ...h, revenue: round2(h.revenue) }))

  // ── Comparison: prejšnje enako dolgo okno (order.aggregate) + pctChange ──
  const prevRevenueRaw = toNum(prevAgg._sum.total)
  const prevOrders = prevAgg._count
  const prevAvgRaw = prevOrders > 0 ? prevRevenueRaw / prevOrders : 0
  const comparison = {
    revenue: {
      current: kpis.revenue,
      previous: round2(prevRevenueRaw),
      deltaPct: pctChange(kpis.revenue, round2(prevRevenueRaw)),
    },
    orders: {
      current: orders,
      previous: prevOrders,
      deltaPct: pctChange(orders, prevOrders),
    },
    avgOrderValue: {
      current: kpis.avgOrderValue,
      previous: round2(prevAvgRaw),
      deltaPct: pctChange(kpis.avgOrderValue, round2(prevAvgRaw)),
    },
  }

  // ── topItems: re-sort (quantity desc, revenue desc, menuItemId asc) ──
  const topSorted = [...(topGroups as MenuItemGroup[])].sort(byQuantityThenRevenueThenId).slice(0, TOP_ITEMS_CAP)
  const menuItems =
    topSorted.length > 0
      ? await db.menuItem.findMany({
          where: { id: { in: topSorted.map((g) => g.menuItemId) } },
          select: { id: true, name: true },
        })
      : []
  const nameById = new Map(menuItems.map((m) => [m.id, m.name]))
  const topItems = topSorted.map((g) => {
    const qty = g._sum.quantity ?? 0
    return {
      menuItemId: g.menuItemId,
      name: nameById.get(g.menuItemId) ?? '(neimenovan artikel)',
      quantity: qty,
      revenue: round2(toNum(g._sum.price) * qty), // NETO price_sum × quantity (dashboard precedens)
    }
  })

  // ── categoryBreakdown: isti groupBy (brez take) + kategorija lookup ──
  const catItems =
    catGroups.length > 0
      ? await db.menuItem.findMany({
          where: { id: { in: (catGroups as MenuItemGroup[]).map((g) => g.menuItemId) } },
          select: { id: true, category: { select: { name: true } } },
        })
      : []
  const catById = new Map(catItems.map((m) => [m.id, m.category?.name ?? 'Ostalo']))
  const catMap = new Map<string, { category: string; quantity: number; revenue: number }>()
  for (const g of catGroups as MenuItemGroup[]) {
    const qty = g._sum.quantity ?? 0
    const revenue = toNum(g._sum.price) * qty
    const category = catById.get(g.menuItemId) ?? 'Ostalo'
    const acc = catMap.get(category) ?? { category, quantity: 0, revenue: 0 }
    acc.quantity += qty
    acc.revenue += revenue
    catMap.set(category, acc)
  }
  const categoryBreakdown = [...catMap.values()]
    .map((c) => ({ ...c, revenue: round2(c.revenue) }))
    .sort((a, b) => b.revenue - a.revenue || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0))

  // ── paymentMix (Payment ledger = §28 source of truth) ──
  const paymentMix = (paymentGroups as PaymentGroup[])
    .map((g) => ({
      type: g.type,
      amount: round2(toNum(g._sum.amount)),
      tips: round2(toNum(g._sum.tipAmount)),
      count: g._count,
    }))
    .sort((a, b) => b.amount - a.amount || (a.type < b.type ? -1 : a.type > b.type ? 1 : 0))

  // ── orderTypeMix ──
  const orderTypeMix = (typeGroups as OrderTypeGroup[])
    .map((g) => ({
      type: g.type,
      revenue: round2(toNum(g._sum.total)),
      orders: g._count,
    }))
    .sort((a, b) => b.revenue - a.revenue || (a.type < b.type ? -1 : a.type > b.type ? 1 : 0))

  // ── staffPerformance: top 20, imena = prikazni lookup ──
  const staffSorted = (staffGroups as StaffGroup[])
    .map((g) => ({
      employeeId: g.employeeId ?? '',
      revenue: toNum(g._sum.total),
      orders: g._count,
    }))
    .sort(
      (a, b) =>
        b.revenue - a.revenue ||
        b.orders - a.orders ||
        (a.employeeId < b.employeeId ? -1 : a.employeeId > b.employeeId ? 1 : 0),
    )
    .slice(0, STAFF_PERFORMANCE_CAP)
  const employees =
    staffSorted.length > 0
      ? await db.employee.findMany({
          where: { id: { in: staffSorted.map((s) => s.employeeId) } },
          select: { id: true, name: true },
        })
      : []
  const nameByEmpId = new Map(employees.map((e) => [e.id, e.name]))
  const staffPerformance = staffSorted.map((s) => ({
    employeeId: s.employeeId,
    name: nameByEmpId.get(s.employeeId) ?? '',
    revenue: round2(s.revenue),
    orders: s.orders,
  }))

  const payload = {
    window: {
      start: win.start,
      end: win.end,
      granularity: win.granularity,
      prevStart: win.prevStart,
      prevEnd: win.prevEnd,
    },
    kpis,
    series: finalizedSeries,
    comparison,
    topItems,
    categoryBreakdown,
    hourlyProfile,
    paymentMix,
    orderTypeMix,
    staffPerformance,
    meta: { rowCap: ANALYTICS_ROW_CAP, windowDays: win.windowDays },
  }

  // Decimal→number sanitairec (canon) — payload sicer vsebuje že čista števila.
  return { ok: true, payload: deepToNumbers(payload) }
}
