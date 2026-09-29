// Pomožne funkcije za Dashboard API — WoW primerjava, heatmap, gosti

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { ljubljanaDayBounds, ljubljanaDateTimeParts } from '@/lib/timezone-sl'
import { addDaysToYmd } from './ymd'
import type { WowComparisonResult } from './types'

// FIX R85-H1: Tenant scope helper — null = super-admin (globalni pogled,
// NIKOLI { locationId: null } filter).
const locationWhere = (locationId: string | null) => (locationId ? { locationId } : {})

// ─── WoW primerjava ─────────────────────────────────────────

export async function computeWowComparison(today: Date, locationId: string | null = null): Promise<WowComparisonResult> {
  // R158-4 (R159-b): ponedeljek tedna po LJ poslovnemu dnevu — prej
  // setDate/setHours po strežniškem TZ. today prihaja iz route kot LJ polnoč.
  const todayYmd = ljubljanaDateTimeParts(today.toISOString()).date
  const [ty, tm, td] = todayYmd.split('-').map(Number)
  const mondayOffset = (new Date(Date.UTC(ty, tm - 1, td)).getUTCDay() + 6) % 7 // Pon=0
  const mondayYmd = addDaysToYmd(todayYmd, -mondayOffset)
  const thisWeekStart = ljubljanaDayBounds(mondayYmd).start
  const lastWeekStart = ljubljanaDayBounds(addDaysToYmd(mondayYmd, -7)).start
  const lastWeekEnd = thisWeekStart

  const [thisWeekAgg, lastWeekAgg, thisWeekDailyRaw, lastWeekDailyRaw] = await Promise.all([
    db.order.aggregate({
      where: { createdAt: { gte: thisWeekStart }, paymentStatus: 'paid', ...locationWhere(locationId) },
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
    }),
    db.order.aggregate({
      where: { createdAt: { gte: lastWeekStart, lt: lastWeekEnd }, paymentStatus: 'paid', ...locationWhere(locationId) },
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
    }),
    // Daily breakdown za ta teden
    db.order.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: thisWeekStart }, paymentStatus: 'paid', ...locationWhere(locationId) },
      _sum: { total: true },
      _count: true,
    }),
    // Daily breakdown za prejšnji teden
    db.order.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: lastWeekStart, lt: lastWeekEnd }, paymentStatus: 'paid', ...locationWhere(locationId) },
      _sum: { total: true },
      _count: true,
    }),
  ])

  const thisWeekRevenue = toNum(thisWeekAgg._sum.total)
  const lastWeekRevenue = toNum(lastWeekAgg._sum.total)
  const thisWeekOrderCount = thisWeekAgg._count
  const lastWeekOrderCount = lastWeekAgg._count
  const thisWeekAvg = thisWeekOrderCount > 0 ? thisWeekRevenue / thisWeekOrderCount : 0
  const lastWeekAvg = lastWeekOrderCount > 0 ? lastWeekRevenue / lastWeekOrderCount : 0

  const wowRevenueChange = lastWeekRevenue > 0 ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0
  const wowOrderChange = lastWeekOrderCount > 0 ? ((thisWeekOrderCount - lastWeekOrderCount) / lastWeekOrderCount) * 100 : 0
  const wowAvgChange = lastWeekAvg > 0 ? ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100 : 0

  // Zgravi daily array iz groupBy
  const thisWeekDaily: { date: string; revenue: number; orders: number }[] = []
  const lastWeekDaily: { date: string; revenue: number; orders: number }[] = []
  // R158-4 (R159-b): vedra + oznake po LJ dnevih (YMD stringi, LJ bounds)
  for (let i = 0; i < 7; i++) {
    const thisYmd = addDaysToYmd(mondayYmd, i)
    const { start: dayStart, end: dayEnd } = ljubljanaDayBounds(thisYmd)

    const thisDayRev = thisWeekDailyRaw.filter(g => new Date(g.createdAt) >= dayStart && new Date(g.createdAt) < dayEnd).reduce((s, g) => s + toNum(g._sum.total), 0)
    const thisDayCount = thisWeekDailyRaw.filter(g => new Date(g.createdAt) >= dayStart && new Date(g.createdAt) < dayEnd).reduce((s, g) => s + g._count, 0)
    thisWeekDaily.push({ date: thisYmd, revenue: round2(thisDayRev), orders: thisDayCount })

    const lastYmd = addDaysToYmd(mondayYmd, i - 7)
    const { start: lastDayStart, end: lastDayEnd } = ljubljanaDayBounds(lastYmd)

    const lastDayRev = lastWeekDailyRaw.filter(g => new Date(g.createdAt) >= lastDayStart && new Date(g.createdAt) < lastDayEnd).reduce((s, g) => s + toNum(g._sum.total), 0)
    const lastDayCount = lastWeekDailyRaw.filter(g => new Date(g.createdAt) >= lastDayStart && new Date(g.createdAt) < lastDayEnd).reduce((s, g) => s + g._count, 0)
    lastWeekDaily.push({ date: lastYmd, revenue: round2(lastDayRev), orders: lastDayCount })
  }

  return {
    thisWeek: { revenue: round2(thisWeekRevenue), orders: thisWeekOrderCount, avgOrder: round2(thisWeekAvg) },
    lastWeek: { revenue: round2(lastWeekRevenue), orders: lastWeekOrderCount, avgOrder: round2(lastWeekAvg) },
    changes: { revenue: round2(wowRevenueChange), orders: round2(wowOrderChange), avgOrder: round2(wowAvgChange) },
    thisWeekDaily,
    lastWeekDaily,
  }
}

// ─── Heatmap — groupBy namesto 126 filter+reduce iteracij ──

export async function computeHeatmapData(locationId: string | null = null): Promise<{ day: number; hour: number; revenue: number; orders: number }[]> {
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
  const heatmapRaw = await db.order.groupBy({
    by: ['createdAt'],
    where: { createdAt: { gte: fourWeeksAgo }, paymentStatus: 'paid', ...locationWhere(locationId) },
    _sum: { total: true },
    _count: true,
  })
  const heatmapData: { day: number; hour: number; revenue: number; orders: number }[] = []
  for (let d = 0; d < 7; d++) {
    for (let h = 6; h <= 23; h++) {
      const matching = heatmapRaw.filter(g => {
        // R158-4 (R159-b): day×hour po LJ delih (prej strežniški TZ)
        const parts = ljubljanaDateTimeParts(new Date(g.createdAt).toISOString())
        const [gy, gm, gd] = parts.date.split('-').map(Number)
        const dayOfWeek = (new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay() + 6) % 7 // Pon=0, Ned=6
        return dayOfWeek === d && Number(parts.time.slice(0, 2)) === h
      })
      const rev = matching.reduce((s, g) => s + toNum(g._sum.total), 0)
      const count = matching.reduce((s, g) => s + g._count, 0)
      heatmapData.push({ day: d, hour: h, revenue: round2(rev), orders: count })
    }
  }
  return heatmapData
}

// ─── Gosti ──────────────────────────────────────────────────

// FIX R85-H1: Guest model NIMA lastnega locationId (schema backlog — R82-E
// census). Scope je izpeljan prek order zveze (Guest → orders → locationId):
// lokacijski uporabnik vidi goste z vsaj enim naročilom na svoji lokaciji;
// super-admin (null) vidi globalno statistiko. Fail-closed: gost brez
// naročil je viden samo super-adminu.
const guestLocationWhere = (locationId: string | null) =>
  locationId ? { orders: { some: { locationId } } } : {}

export async function fetchGuestAnalytics(locationId: string | null = null): Promise<{ totalGuests: number; repeatGuests: number; guestReturnRate: number }> {
  const scopeWhere = guestLocationWhere(locationId)
  const [repeatGuests, totalGuests] = await Promise.all([
    db.guest.count({ where: { totalVisits: { gt: 1 }, ...scopeWhere } }),
    db.guest.count({ where: scopeWhere }),
  ])
  const guestReturnRate = totalGuests > 0 ? (repeatGuests / totalGuests) * 100 : 0
  return { totalGuests, repeatGuests, guestReturnRate: round2(guestReturnRate) }
}
