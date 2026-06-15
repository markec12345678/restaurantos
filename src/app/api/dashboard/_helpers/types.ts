// Pomožne funkcije za Dashboard API — Tipi

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
  recentOrders: Awaited<ReturnType<typeof import('@/lib/db').db.order.findMany>>
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
