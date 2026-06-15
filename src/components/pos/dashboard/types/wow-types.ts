// ============================================
// TIPI: WoW primerjava in povezani tipi
// ============================================

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

export interface WowChartDataPoint {
  day: string
  'Ta teden': number
  'Prejšnji teden': number
}
