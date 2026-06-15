// Pomožne funkcije za poročilo po zaposlenih — Agregacija in obdelava

import { db } from '@/lib/db'
import { toNum, multiply } from '@/lib/decimal'

// ─── Tipi ───

export interface EmployeeStatsEntry {
  employeeId: string
  employeeName: string
  role: string
  orderCount: number
  totalRevenue: number
  totalSubtotal: number
  totalTax: number
  totalDiscount: number
  totalTips: number
  avgOrderValue: number
  itemsSold: number
  voidedItems: number
  categoryBreakdown: Record<string, { category: string; revenue: number; quantity: number }>
  hourlyBreakdown: Record<string, { hour: string; revenue: number; orders: number }>
  topItems: Record<string, { name: string; quantity: number; revenue: number }>
}

export function createEmptyStats(employeeId: string, name: string, role: string): EmployeeStatsEntry {
  return {
    employeeId,
    employeeName: name,
    role,
    orderCount: 0,
    totalRevenue: 0,
    totalSubtotal: 0,
    totalTax: 0,
    totalDiscount: 0,
    totalTips: 0,
    avgOrderValue: 0,
    itemsSold: 0,
    voidedItems: 0,
    categoryBreakdown: {},
    hourlyBreakdown: {},
    topItems: {},
  }
}

export function aggregateOrderItems(
  stats: EmployeeStatsEntry,
  order: {
    orderItems: Array<{
      voided: boolean
      quantity: number
      price: import('@/lib/decimal').DecimalLike
      menuItemId: string
      menuItem?: { name?: string; category?: { name?: string } }
    }>
    createdAt: Date
  },
): void {
  for (const oi of order.orderItems) {
    if (oi.voided) {
      stats.voidedItems += oi.quantity
      continue
    }

    stats.itemsSold += oi.quantity

    // Kategorije
    const cat = oi.menuItem?.category?.name || 'Ostalo'
    if (!stats.categoryBreakdown[cat]) {
      stats.categoryBreakdown[cat] = { category: cat, revenue: 0, quantity: 0 }
    }
    stats.categoryBreakdown[cat].revenue += toNum(multiply(oi.price, oi.quantity))
    stats.categoryBreakdown[cat].quantity += oi.quantity

    // Top artikli
    const itemKey = oi.menuItemId
    if (!stats.topItems[itemKey]) {
      stats.topItems[itemKey] = {
        name: oi.menuItem?.name || 'Neznan',
        quantity: 0,
        revenue: 0,
      }
    }
    stats.topItems[itemKey].quantity += oi.quantity
    stats.topItems[itemKey].revenue += toNum(multiply(oi.price, oi.quantity))

    // Urna porazdelitev
    const hour = String(new Date(order.createdAt).getHours()).padStart(2, '0')
    if (!stats.hourlyBreakdown[hour]) {
      stats.hourlyBreakdown[hour] = { hour: `${hour}:00`, revenue: 0, orders: 0 }
    }
    stats.hourlyBreakdown[hour].revenue += toNum(multiply(oi.price, oi.quantity))
  }

  // Dodaj urno porazdelitev naročil
  const hour = String(new Date(order.createdAt).getHours()).padStart(2, '0')
  if (stats.hourlyBreakdown[hour]) {
    stats.hourlyBreakdown[hour].orders += 1
  }
}

// ─── Skupni seštevek ───

export interface EmployeeTotals {
  totalRevenue: number
  totalTips: number
  totalOrders: number
  totalItemsSold: number
  totalVoidedItems: number
  avgOrderValue: number
  employeeCount: number
}

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
