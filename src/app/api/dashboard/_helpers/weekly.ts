// Pomožne funkcije za Dashboard API — Tedenski prihodki in čakalni čas

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { ljubljanaDayBounds, ljubljanaTodayStr } from '@/lib/timezone-sl'
import { addDaysToYmd } from './ymd'

// FIX R85-H1: Tenant scope helper — null = super-admin (globalni pogled,
// NIKOLI { locationId: null } filter).
const locationWhere = (locationId: string | null) => (locationId ? { locationId } : {})

// ─── Tedenska poraba ────────────────────────────────────────

export async function computeWeeklyRevenue(sevenDaysAgo: Date, locationId: string | null = null): Promise<{ date: string; revenue: number }[]> {
  const weeklyRevenueByDay = await db.order.groupBy({
    by: ['createdAt'],
    where: { createdAt: { gte: sevenDaysAgo }, status: 'completed', paymentStatus: 'paid', ...locationWhere(locationId) },
    _sum: { total: true },
  })

  // Zgradi dailyRevenue iz groupBy rezultatov
  // R158-4 (R159-b): vedra po LJ poslovnemu dnevu (prej setHours po
  // strežniškem TZ + UTC oznaka). Signature NE spreminjata — sevenDaysAgo
  // prihaja iz route kot LJ meja.
  const dailyRevenue: { date: string; revenue: number }[] = []
  const todayYmd = ljubljanaTodayStr()
  for (let i = 6; i >= 0; i--) {
    const ymd = addDaysToYmd(todayYmd, -i)
    const { start: day, end: nextDay } = ljubljanaDayBounds(ymd)
    const dayRevenue = weeklyRevenueByDay
      .filter(g => {
        const d = new Date(g.createdAt)
        return d >= day && d < nextDay
      })
      .reduce((sum, g) => sum + toNum(g._sum.total), 0)
    dailyRevenue.push({ date: ymd, revenue: round2(dayRevenue) })
  }

  return dailyRevenue
}

// ─── Povprečni čakalni čas ──────────────────────────────────

export async function computeAvgWaitTime(today: Date, tomorrow: Date, locationId: string | null = null): Promise<number> {
  const completedOrdersForWait = await db.order.findMany({
    where: { createdAt: { gte: today, lt: tomorrow }, status: 'completed', ...locationWhere(locationId) },
    select: { createdAt: true, updatedAt: true },
  })
  const avgWaitMinutes = completedOrdersForWait.length > 0
    ? completedOrdersForWait.reduce((sum, o) => {
        const created = new Date(o.createdAt).getTime()
        const completed = new Date(o.updatedAt).getTime()
        return sum + (completed - created) / 60000
      }, 0) / completedOrdersForWait.length
    : 0
  return Math.round(avgWaitMinutes)
}
