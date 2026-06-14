// Pomožne funkcije za Dashboard API
// Izvlečene iz route.ts za boljšo berljivost in vzdrževanje

import { db } from '@/lib/db'
import { toNum, round2, abs } from '@/lib/decimal'

// ─── Tipi za vrnjene vrednosti ─────────────────────────────

export interface TodayAggregationResult {
  todayRevenue: number
  todayTips: number
  todayTax: number
  todayDiscount: number
  paidOrderCount: number
  avgOrderValue: number
  totalOrders: number
  completedOrders: number
  cancelledOrders: number
  pendingOrders: number
  inProgressOrders: number
  readyOrders: number
}

export interface TablesStockRecentResult {
  activeTables: number
  totalTables: number
  lowStockItems: Array<{ id: string; name: string; quantity: number; minQuantity: number; unit: string | null }>
  recentOrders: Awaited<ReturnType<typeof db.order.findMany>>
}

export interface FursShiftCogsResult {
  fursStatus: {
    configured: boolean
    environment: string
    todayVerified: number
    todayUnverified: number
  }
  activeShift: {
    id: string
    openedAt: string
    startingCash: number
    cashSales: number
    cardSales: number
    totalSales: number
    totalOrders: number
  } | null
  todayCogs: number
  grossProfit: number
  grossMargin: number
}

export interface WowComparisonResult {
  thisWeek: { revenue: number; orders: number; avgOrder: number }
  lastWeek: { revenue: number; orders: number; avgOrder: number }
  changes: { revenue: number; orders: number; avgOrder: number }
  thisWeekDaily: { date: string; revenue: number; orders: number }[]
  lastWeekDaily: { date: string; revenue: number; orders: number }[]
}

// ─── Današnja agregacija ───────────────────────────────────

export async function fetchTodayAggregation(today: Date, tomorrow: Date): Promise<TodayAggregationResult> {
  const [todayPaidAgg, todayStatusCounts] = await Promise.all([
    db.order.aggregate({
      where: { createdAt: { gte: today, lt: tomorrow }, paymentStatus: 'paid' },
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
      FROM InventoryItem
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

// ─── FURS status, aktivna izmena, COGS ─────────────────────

export async function fetchFursShiftCogs(today: Date, tomorrow: Date, todayRevenue: number): Promise<FursShiftCogsResult> {
  const [settings, todayVerifiedReceipts, todayUnverifiedReceipts, activeShift, stockMovements] = await Promise.all([
    db.restaurantSettings.findFirst({ where: { isActive: true } }),
    db.receipt.count({
      where: { createdAt: { gte: today, lt: tomorrow }, fiscalVerified: true },
    }),
    db.receipt.count({
      where: { createdAt: { gte: today, lt: tomorrow }, fiscalVerified: false },
    }),
    db.cashRegisterShift.findFirst({
      where: { status: 'open' },
      orderBy: { openedAt: 'desc' },
    }),
    db.stockTransaction.findMany({
      where: { createdAt: { gte: today, lt: tomorrow }, type: 'sale' },
      select: { totalCost: true },
    }),
  ])

  const todayCogs = stockMovements.reduce((sum, t) => sum + toNum(abs(t.totalCost)), 0)
  const grossProfit = todayRevenue - todayCogs

  return {
    fursStatus: {
      configured: !!(settings?.fursCertPath),
      environment: settings?.fursEnvironment || 'test',
      todayVerified: todayVerifiedReceipts,
      todayUnverified: todayUnverifiedReceipts,
    },
    activeShift: activeShift ? {
      id: activeShift.id,
      openedAt: activeShift.openedAt.toISOString(),
      startingCash: toNum(activeShift.startingCash),
      cashSales: toNum(activeShift.cashSales),
      cardSales: toNum(activeShift.cardSales),
      totalSales: toNum(activeShift.totalSales),
      totalOrders: activeShift.totalOrders,
    } : null,
    todayCogs: round2(todayCogs),
    grossProfit: round2(grossProfit),
    grossMargin: todayRevenue > 0 ? round2((grossProfit / todayRevenue) * 100) : 0,
  }
}

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
