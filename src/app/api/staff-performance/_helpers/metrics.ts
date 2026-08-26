// Tipi in pomožne funkcije za kadrovsko analitiko

// ─── Tipi ───
export interface EmployeePerformance {
  employeeId: string
  employeeName: string
  role: string
  jobs: string[]
  totalOrders: number
  totalRevenue: number
  totalTips: number
  avgOrderValue: number
  avgServiceTime: number
  tableTurnover: number
  upsellRate: number
  revenuePerHour: number
  hoursWorked: number
  voidRate: number
  orderTypeBreakdown: { dineIn: number; takeout: number; delivery: number }
  shiftsWorked: number
  performanceScore: number
}

export interface PerformanceTotals {
  totalRevenue: number
  totalTips: number
  totalOrders: number
  avgServiceTime: number
  avgPerformanceScore: number
}

// ─── Datumski obseg ───
export function getDateRange(period: string): { startDate: Date; now: Date } {
  const now = new Date()
  let startDate = new Date(now)
  startDate.setHours(0, 0, 0, 0)
  if (period === 'week') {
    startDate = new Date(now)
    startDate.setDate(now.getDate() - 7)
    startDate.setHours(0, 0, 0, 0)
  } else if (period === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }
  return { startDate, now }
}

// ─── Skupna statistika ───
export function computeTotals(performanceData: EmployeePerformance[]): PerformanceTotals {
  const withServiceTime = performanceData.filter(p => p.avgServiceTime > 0)
  return {
    totalRevenue: performanceData.reduce((s, p) => s + p.totalRevenue, 0),
    totalTips: performanceData.reduce((s, p) => s + p.totalTips, 0),
    totalOrders: performanceData.reduce((s, p) => s + p.totalOrders, 0),
    avgServiceTime: withServiceTime.length > 0
      ? withServiceTime.reduce((s, p) => s + p.avgServiceTime, 0) / withServiceTime.length : 0,
    avgPerformanceScore: performanceData.length > 0
      ? performanceData.reduce((s, p) => s + p.performanceScore, 0) / performanceData.length : 0,
  }
}
