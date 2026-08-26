// Skupni seštevek in finalizacija statistike

import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import type { EmployeeStatsEntry, EmployeeTotals } from './types'

export async function computeEmployeeTotals(
  where: Record<string, unknown>,
  result: Array<{ voidedItems: number }>,
): Promise<EmployeeTotals> {
  const [orderAggregates, itemCount] = await Promise.all([
    db.order.aggregate({
      where,
      _sum: { total: true, tip: true, discount: true },
      _count: true,
    }),
    db.orderItem.count({
      where: { order: where, voided: false },
    }),
  ])

  return {
    totalRevenue: toNum(orderAggregates._sum.total),
    totalTips: toNum(orderAggregates._sum.tip),
    totalOrders: orderAggregates._count,
    totalItemsSold: itemCount,
    totalVoidedItems: result.reduce((s, e) => s + e.voidedItems, 0),
    avgOrderValue: orderAggregates._count > 0
      ? Math.round((toNum(orderAggregates._sum.total) / orderAggregates._count) * 100) / 100
      : 0,
    employeeCount: result.length,
  }
}

export function finalizeStats(stats: EmployeeStatsEntry) {
  stats.avgOrderValue = stats.orderCount > 0
    ? Math.round((stats.totalRevenue / stats.orderCount) * 100) / 100
    : 0
  stats.totalRevenue = Math.round(stats.totalRevenue * 100) / 100
  stats.totalSubtotal = Math.round(stats.totalSubtotal * 100) / 100
  stats.totalTax = Math.round(stats.totalTax * 100) / 100
  stats.totalDiscount = Math.round(stats.totalDiscount * 100) / 100
  stats.totalTips = Math.round(stats.totalTips * 100) / 100

  const categoryBreakdown = Object.values(stats.categoryBreakdown)
    .sort((a, b) => b.revenue - a.revenue)
    .map(c => ({ ...c, revenue: Math.round(c.revenue * 100) / 100 }))

  const hourlyBreakdown = Object.values(stats.hourlyBreakdown)
    .sort((a, b) => a.hour.localeCompare(b.hour))
    .map(h => ({ ...h, revenue: Math.round(h.revenue * 100) / 100 }))

  const topItems = Object.values(stats.topItems)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(i => ({ ...i, revenue: Math.round(i.revenue * 100) / 100 }))

  return {
    ...stats,
    categoryBreakdown,
    hourlyBreakdown,
    topItems,
  }
}
