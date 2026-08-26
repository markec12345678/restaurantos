// ============================================
// TIPI: Props za podkomponente
// ============================================

import type { WowComparison, WowChartDataPoint } from './wow-types'
import type { HeatmapCell, ActiveShift, FursStatus, DailyRevenue, CategoryBreakdown, HourlyRevenue, OrderTypeBreakdown, VatBreakdown, RecentOrder, TopSellingItem, LowStockItem, GuestAnalytics } from './api-types'

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
