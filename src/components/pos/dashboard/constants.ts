// Skupne konstante in tipi za nadzorno ploščo

// Barve za tortni diagram po kategorijah
export const PIE_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

// Slovenski dnevi za toplotno karto
export const DAY_NAMES = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'] as const

// Status oznake — barve
export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

// Status oznake — slovenščina
export const STATUS_LABELS: Record<string, string> = {
  pending: 'Čakajoče',
  'in-progress': 'V obdelavi',
  ready: 'Pripravljeno',
  completed: 'Zaključeno',
  cancelled: 'Preklicano',
}

// Vrste naročil — slovenščina
export const TYPE_LABELS: Record<string, string> = {
  'dine-in': 'Na mestu',
  takeout: 'Za s seboj',
  delivery: 'Dostava',
}

// ═══════════════════════════════════════════════════════════
// Tipi za API odziv nadzorne plošče
// ═══════════════════════════════════════════════════════════

export interface WowChanges {
  revenue: number
  orders: number
  avgOrder: number
}

export interface WowWeekSummary {
  revenue: number
  orders: number
  avgOrder: number
}

export interface WowDailyData {
  date: string
  revenue: number
  orders: number
}

export interface WowComparison {
  changes: WowChanges
  thisWeek: WowWeekSummary
  lastWeek: WowWeekSummary
  thisWeekDaily: WowDailyData[]
  lastWeekDaily: WowDailyData[]
}

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
  wowComparison: WowComparison
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

// ═══════════════════════════════════════════════════════════
// Izračunane vrednosti (iz useMemo v nadzorni plošči)
// ═══════════════════════════════════════════════════════════

export interface WowChartDataPoint {
  day: string
  'Ta teden': number
  'Prejšnji teden': number
}

export interface ComputedValues {
  statusColors: Record<string, string>
  statusLabels: Record<string, string>
  typeLabels: Record<string, string>
  wow: WowComparison | undefined
  heatmapData: HeatmapCell[]
  guestAnalytics: GuestAnalytics | undefined
  heatmapMax: number
  wowChartData: WowChartDataPoint[]
}

// ═══════════════════════════════════════════════════════════
// Props tipi za podkomponente
// ═══════════════════════════════════════════════════════════

export interface WoWComparisonProps {
  wow: WowComparison | undefined
  wowChartData: WowChartDataPoint[]
}

export interface ShiftFursStatusProps {
  activeShift: ActiveShift | null
  fursStatus: FursStatus
}

export interface ChartsSectionProps {
  dailyRevenue: DailyRevenue[]
  categoryBreakdown: CategoryBreakdown[]
}

export interface HeatmapSectionProps {
  heatmapData: HeatmapCell[]
  heatmapMax: number
}

export interface BreakdownSectionProps {
  hourlyRevenue: HourlyRevenue[]
  orderTypeBreakdown: OrderTypeBreakdown[]
  vatBreakdown: VatBreakdown[]
  typeLabels: Record<string, string>
  todayRevenue: number
}

export interface RecentActivityProps {
  recentOrders: RecentOrder[]
  topSellingItems: TopSellingItem[]
  guestAnalytics: GuestAnalytics | undefined
  statusColors: Record<string, string>
  statusLabels: Record<string, string>
  typeLabels: Record<string, string>
}

export interface StockAndKitchenProps {
  lowStockItems: LowStockItem[]
  recentOrders: RecentOrder[]
  statusColors: Record<string, string>
  statusLabels: Record<string, string>
  typeLabels: Record<string, string>
  onNavigateInventory: () => void
}
