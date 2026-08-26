// Pomožne funkcije za Dashboard API — Tedenski prihodki in čakalni čas

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'

// ─── Tedenska poraba ────────────────────────────────────────

export async function computeWeeklyRevenue(sevenDaysAgo: Date): Promise<{ date: string; revenue: number }[]> {
  const weeklyRevenueByDay = await db.order.groupBy({
    by: ['createdAt'],
    where: { createdAt: { gte: sevenDaysAgo }, status: 'completed', paymentStatus: 'paid' },
    _sum: { total: true },
  })

  // Zgradi dailyRevenue iz groupBy rezultatov
  const dailyRevenue: { date: string; revenue: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const day = new Date()
    day.setDate(day.getDate() - i)
    day.setHours(0, 0, 0, 0)
    const nextDay = new Date(day)
    nextDay.setDate(nextDay.getDate() + 1)
    const dayStr = day.toISOString().split('T')[0]
    const dayRevenue = weeklyRevenueByDay
      .filter(g => {
        const d = new Date(g.createdAt)
        return d >= day && d < nextDay
      })
      .reduce((sum, g) => sum + toNum(g._sum.total), 0)
    dailyRevenue.push({ date: dayStr, revenue: round2(dayRevenue) })
  }

  return dailyRevenue
}

// ─── Povprečni čakalni čas ──────────────────────────────────

export async function computeAvgWaitTime(today: Date, tomorrow: Date): Promise<number> {
  const completedOrdersForWait = await db.order.findMany({
    where: { createdAt: { gte: today, lt: tomorrow }, status: 'completed' },
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
