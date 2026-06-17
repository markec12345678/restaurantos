// Pomožne funkcije za Dashboard API — Današnja agregacija in mize/zaloga

import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import type { TodayAggregationResult, TablesStockRecentResult } from './types'

// ─── Današnja agregacija ───────────────────────────────────

export async function fetchTodayAggregation(today: Date, tomorrow: Date): Promise<TodayAggregationResult> {
  const [todayPaidAgg, todayStatusCounts] = await Promise.all([
    // FIX V4: Finančni podatki (revenue/tips/tax) se zapišejo ob plačilu — uporabi paidAt
    // Prejšnja koda je uporabljala createdAt, kar je povzročilo napačne številke
    // (tips=€0 v dashboard, a €2.29 v Z-report, ker se tip zapiše šele ob payment)
    db.order.aggregate({
      where: { paidAt: { gte: today, lt: tomorrow }, paymentStatus: 'paid' },
      _sum: { total: true, tip: true, tax: true, discount: true },
      _count: true,
      _avg: { total: true },
    }),
    db.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: today, lt: tomorrow } },
      _count: true,
    }),
  ])

  const todayRevenue = toNum(todayPaidAgg._sum.total)
  const todayTips = toNum(todayPaidAgg._sum.tip)
  const todayTax = toNum(todayPaidAgg._sum.tax)
  const todayDiscount = toNum(todayPaidAgg._sum.discount)
  const paidOrderCount = todayPaidAgg._count
  const avgOrderValue = paidOrderCount > 0 ? todayRevenue / paidOrderCount : 0
  const totalOrders = todayStatusCounts.reduce((sum, g) => sum + g._count, 0)
  const completedOrders = todayStatusCounts.find(g => g.status === 'completed')?._count ?? 0
  const cancelledOrders = todayStatusCounts.find(g => g.status === 'cancelled')?._count ?? 0
  const pendingOrders = todayStatusCounts.find(g => g.status === 'pending')?._count ?? 0
  const inProgressOrders = todayStatusCounts.find(g => g.status === 'in-progress')?._count ?? 0
  const readyOrders = todayStatusCounts.find(g => g.status === 'ready')?._count ?? 0

  return {
    todayRevenue, todayTips, todayTax, todayDiscount,
    paidOrderCount, avgOrderValue, totalOrders,
    completedOrders, cancelledOrders, pendingOrders, inProgressOrders, readyOrders,
  }
}

// ─── Mize, zaloga, zadnja naročila ─────────────────────────

export async function fetchTablesStockRecent(): Promise<TablesStockRecentResult> {
  const [activeTables, totalTables, lowStockItems, recentOrders] = await Promise.all([
    db.table.count({ where: { status: 'occupied' } }),
    db.table.count(),
    // Raw SQL za cross-field primerjavo (quantity <= minQuantity) — Prisma tega ne podpira
    db.$queryRaw<Array<{ id: string; name: string; quantity: number; minQuantity: number; unit: string | null }>>`
      SELECT id, name, quantity, "minQuantity", unit
      FROM "InventoryItem"
      WHERE quantity <= "minQuantity"
      ORDER BY name ASC
      LIMIT 5
    `,
    db.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { table: true, orderItems: { include: { menuItem: true } } },
    }),
  ])

  return { activeTables, totalTables, lowStockItems, recentOrders }
}
