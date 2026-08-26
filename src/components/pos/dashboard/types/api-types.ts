// ============================================
// TIPI: API odziv in izračunane vrednosti
// ============================================

export interface HeatmapCell {
  day: number
  hour: number
  revenue: number
  orders: number
}

export interface GuestAnalytics {
  totalGuests: number
  repeatGuests: number
  guestReturnRate: number
}

export interface ActiveShift {
  openedAt: string
  startingCash: number
  cashSales: number
  cardSales: number
  totalSales: number
}

export interface FursStatus {
  todayVerified: number
  todayUnverified: number
  configured: boolean
  environment: string
}

export interface DailyRevenue {
  date: string
  revenue: number
}

export interface CategoryBreakdown {
  name: string
  revenue: number
}

export interface HourlyRevenue {
  hour: number
  label: string
  revenue: number
}

export interface OrderTypeBreakdown {
  type: string
  revenue: number
  count: number
}

export interface VatBreakdown {
  rate: string
  base: number
  vat: number
}

export interface OrderItem {
  id: string
  menuItem: { name: string }
  quantity: number
  status: string
}

export interface RecentOrder {
  id: string
  orderNumber: number
  type: string
  status: string
  total: number
  customerName: string
  createdAt: string
  table?: { number: number }
  orderItems: OrderItem[]
}

export interface TopSellingItem {
  name: string
  quantity: number
  revenue: number
}

export interface LowStockItem {
  id: string
  name: string
  quantity: number
  minQuantity: number
  unit?: string
}

export interface DashboardData {
  todayRevenue: number
  totalOrders: number
  completedOrders: number
  cancelledOrders: number
  pendingOrders: number
  readyOrders: number
  avgOrderValue: number
  todayTips: number
  activeTables: number
  totalTables: number
  grossProfit: number
  grossMargin: number
  wowComparison: import('./wow-types').WowComparison
  heatmapData: HeatmapCell[]
  guestAnalytics: GuestAnalytics
  activeShift: ActiveShift | null
  fursStatus: FursStatus
  dailyRevenue: DailyRevenue[]
  categoryBreakdown: CategoryBreakdown[]
  hourlyRevenue: HourlyRevenue[]
  orderTypeBreakdown: OrderTypeBreakdown[]
  vatBreakdown: VatBreakdown[]
  recentOrders: RecentOrder[]
  topSellingItems: TopSellingItem[]
  lowStockItems: LowStockItem[]
}

export interface ComputedValues {
  statusColors: Record<string, string>
  statusLabels: Record<string, string>
  typeLabels: Record<string, string>
  wow: import('./wow-types').WowComparison | undefined
  heatmapData: HeatmapCell[]
  guestAnalytics: GuestAnalytics | undefined
  heatmapMax: number
  wowChartData: import('./wow-types').WowChartDataPoint[]
}
