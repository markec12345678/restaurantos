// Pomožne funkcije za Dashboard API — WoW primerjava, heatmap, gosti

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import type { WowComparisonResult } from './types'

// ─── WoW primerjava ─────────────────────────────────────────

export async function computeWowComparison(today: Date): Promise<WowComparisonResult> {
  const thisWeekStart = new Date(today)
  thisWeekStart.setDate(today.getDate() - today.getDay() + 1) // Ponedeljek
  thisWeekStart.setHours(0, 0, 0, 0)
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  const lastWeekEnd = new Date(thisWeekStart)

  const [thisWeekAgg, lastWeekAgg, thisWeekDailyRaw, lastWeekDailyRaw] = await Promise.all([
    db.order.aggregate({
      where: { createdAt: { gte: thisWeekStart }, paymentStatus: 'paid' },
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
    }),
    db.order.aggregate({
      where: { createdAt: { gte: lastWeekStart, lt: lastWeekEnd }, paymentStatus: 'paid' },
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
    }),
    // Daily breakdown za ta teden
    db.order.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: thisWeekStart }, paymentStatus: 'paid' },
      _sum: { total: true },
      _count: true,
    }),
    // Daily breakdown za prejšnji teden
    db.order.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: lastWeekStart, lt: lastWeekEnd }, paymentStatus: 'paid' },
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
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(thisWeekStart)
    dayStart.setDate(dayStart.getDate() + i)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const thisDayRev = thisWeekDailyRaw.filter(g => new Date(g.createdAt) >= dayStart && new Date(g.createdAt) < dayEnd).reduce((s, g) => s + toNum(g._sum.total), 0)
    const thisDayCount = thisWeekDailyRaw.filter(g => new Date(g.createdAt) >= dayStart && new Date(g.createdAt) < dayEnd).reduce((s, g) => s + g._count, 0)
    thisWeekDaily.push({ date: dayStart.toISOString().split('T')[0], revenue: round2(thisDayRev), orders: thisDayCount })

    const lastDayStart = new Date(lastWeekStart)
    lastDayStart.setDate(lastDayStart.getDate() + i)
    const lastDayEnd = new Date(lastDayStart)
    lastDayEnd.setDate(lastDayEnd.getDate() + 1)

    const lastDayRev = lastWeekDailyRaw.filter(g => new Date(g.createdAt) >= lastDayStart && new Date(g.createdAt) < lastDayEnd).reduce((s, g) => s + toNum(g._sum.total), 0)
    const lastDayCount = lastWeekDailyRaw.filter(g => new Date(g.createdAt) >= lastDayStart && new Date(g.createdAt) < lastDayEnd).reduce((s, g) => s + g._count, 0)
    lastWeekDaily.push({ date: lastDayStart.toISOString().split('T')[0], revenue: round2(lastDayRev), orders: lastDayCount })
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

export async function computeHeatmapData(): Promise<{ day: number; hour: number; revenue: number; orders: number }[]> {
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
  const heatmapRaw = await db.order.groupBy({
    by: ['createdAt'],
    where: { createdAt: { gte: fourWeeksAgo }, paymentStatus: 'paid' },
    _sum: { total: true },
    _count: true,
  })
  const heatmapData: { day: number; hour: number; revenue: number; orders: number }[] = []
  for (let d = 0; d < 7; d++) {
    for (let h = 6; h <= 23; h++) {
      const matching = heatmapRaw.filter(g => {
        const date = new Date(g.createdAt)
        const dayOfWeek = (date.getDay() + 6) % 7 // Pon=0, Ned=6
        return dayOfWeek === d && date.getHours() === h
      })
      const rev = matching.reduce((s, g) => s + toNum(g._sum.total), 0)
      const count = matching.reduce((s, g) => s + g._count, 0)
      heatmapData.push({ day: d, hour: h, revenue: round2(rev), orders: count })
    }
  }
  return heatmapData
}

// ─── Gosti ──────────────────────────────────────────────────

export async function fetchGuestAnalytics(): Promise<{ totalGuests: number; repeatGuests: number; guestReturnRate: number }> {
  const [repeatGuests, totalGuests] = await Promise.all([
    db.guest.count({ where: { totalVisits: { gt: 1 } } }),
    db.guest.count(),
  ])
  const guestReturnRate = totalGuests > 0 ? (repeatGuests / totalGuests) * 100 : 0
  return { totalGuests, repeatGuests, guestReturnRate: round2(guestReturnRate) }
}
