// Skupne konstante za nadzorno ploščo
// Tipi so premaknjeni v ./types.ts

// Re-export tipov za združljivost
export type {
  WowChanges, WowWeekSummary, WowDailyData, WowComparison,
  HeatmapCell, GuestAnalytics, ActiveShift, FursStatus,
  DailyRevenue, CategoryBreakdown, HourlyRevenue, OrderTypeBreakdown,
  VatBreakdown, OrderItem, RecentOrder, TopSellingItem, LowStockItem,
  DashboardData, WowChartDataPoint, ComputedValues,
  WoWComparisonProps, ShiftFursStatusProps, ChartsSectionProps,
  HeatmapSectionProps, BreakdownSectionProps, RecentActivityProps,
  StockAndKitchenProps,
} from './types'

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
