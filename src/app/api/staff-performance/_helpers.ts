// STAFF PERFORMANCE HELPERS — Pomožne funkcije za analitiko (Toast POS + 7shifts + Square)
import { db } from '@/lib/db'
import { toNum, round2, divide } from '@/lib/decimal'

// Types
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
type RawPerformanceData = Awaited<ReturnType<typeof fetchPerformanceData>>

// Date Range
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

// Data Fetching (vzporedno)
export async function fetchPerformanceData(startDate: Date, locationId: string | null) {
  const loc = locationId ? { locationId } : {}
  return Promise.all([
    db.employee.findMany({
      where: { status: 'active', ...loc },
      select: { id: true, name: true, role: true, jobs: { select: { job: { select: { name: true } } } } },
    }),
    db.order.groupBy({
      by: ['employeeId'],
      where: { status: 'completed', createdAt: { gte: startDate }, employeeId: { not: null }, ...loc },
      _sum: { total: true }, _count: true,
    }),
    db.order.groupBy({
      by: ['employeeId'],
      where: { createdAt: { gte: startDate }, employeeId: { not: null }, ...loc },
      _count: true,
    }),
    db.order.groupBy({
      by: ['employeeId'],
      where: { status: 'cancelled', createdAt: { gte: startDate }, employeeId: { not: null }, ...loc },
      _count: true,
    }),
    db.order.groupBy({
      by: ['employeeId', 'type'],
      where: { status: 'completed', createdAt: { gte: startDate }, employeeId: { not: null }, ...loc },
      _count: true,
    }),
    db.order.groupBy({
      by: ['employeeId', 'tableId'],
      where: { status: 'completed', createdAt: { gte: startDate }, employeeId: { not: null }, tableId: { not: null }, ...loc },
    }),
    db.payment.groupBy({
      by: ['employeeId'],
      where: { createdAt: { gte: startDate }, employeeId: { not: null } },
      _sum: { tipAmount: true },
    }),
    db.staffShift.groupBy({
      by: ['employeeId'],
      where: { shiftDate: { gte: startDate }, status: { notIn: ['cancelled'] }, ...loc },
      _count: true,
    }),
    db.timeEntry.groupBy({
      by: ['employeeId'],
      where: { clockIn: { gte: startDate }, clockOut: { not: null } },
      _sum: { totalMinutes: true },
    }),
    db.order.findMany({
      where: { status: 'completed', createdAt: { gte: startDate }, employeeId: { not: null }, ...loc },
      select: { employeeId: true, createdAt: true, updatedAt: true },
    }),
    db.order.findMany({
      where: { createdAt: { gte: startDate }, employeeId: { not: null }, orderItems: { some: { modifiersJson: { not: '[]' } } }, ...loc },
      select: { employeeId: true },
    }),
  ])
}

// Map Building + Employee Metrics
function toMap<T extends { employeeId: string | null }>(items: T[]): Map<string, T> {
  const m = new Map<string, T>()
  for (const r of items) {
    if (r.employeeId !== null) m.set(r.employeeId, r)
  }
  return m
}

export function computeEmployeePerformance(data: RawPerformanceData): EmployeePerformance[] {
  const [employees, completedOrderStats, allOrderStats, cancelledOrderStats,
    orderTypeStats, uniqueTablesStats, paymentStats, shiftStats,
    timeEntryStats, serviceOrders, ordersWithMods] = data

  const completedMap = toMap(completedOrderStats)
  const allOrdersMap = toMap(allOrderStats)
  const cancelledMap = toMap(cancelledOrderStats)
  const paymentMap = toMap(paymentStats)
  const shiftMap = toMap(shiftStats)
  const timeEntryMap = toMap(timeEntryStats)

  // Vrste naročil po zaposlenem
  const orderTypeMap = new Map<string, Map<string, number>>()
  for (const r of orderTypeStats) {
    if (r.employeeId === null) continue
    if (!orderTypeMap.has(r.employeeId)) orderTypeMap.set(r.employeeId, new Map())
    orderTypeMap.get(r.employeeId)!.set(r.type, r._count)
  }

  // Enolične mize po zaposlenem
  const uniqueTablesMap = new Map<string, number>()
  for (const r of uniqueTablesStats) {
    if (r.employeeId === null) continue
    uniqueTablesMap.set(r.employeeId, (uniqueTablesMap.get(r.employeeId) || 0) + 1)
  }

  // Čas strežbe po zaposlenem
  const serviceTimeMap = new Map<string, number[]>()
  for (const o of serviceOrders) {
    if (!o.employeeId) continue
    const created = new Date(o.createdAt).getTime()
    const completed = new Date(o.updatedAt).getTime()
    const minutes = (completed - created) / (1000 * 60)
    if (minutes > 0 && minutes < 180) {
      if (!serviceTimeMap.has(o.employeeId)) serviceTimeMap.set(o.employeeId, [])
      serviceTimeMap.get(o.employeeId)!.push(minutes)
    }
  }

  // Naročila z dodatki po zaposlenem
  const modOrdersMap = new Map<string, number>()
  for (const o of ordersWithMods) {
    if (!o.employeeId) continue
    modOrdersMap.set(o.employeeId, (modOrdersMap.get(o.employeeId) || 0) + 1)
  }

  return employees.map(emp => {
    const completed = completedMap.get(emp.id)
    const allOrders = allOrdersMap.get(emp.id)
    const cancelled = cancelledMap.get(emp.id)
    const payment = paymentMap.get(emp.id)
    const shift = shiftMap.get(emp.id)
    const timeEntry = timeEntryMap.get(emp.id)
    const types = orderTypeMap.get(emp.id)
    const uniqueTables = uniqueTablesMap.get(emp.id) || 0
    const serviceTimes = serviceTimeMap.get(emp.id) || []
    const modOrders = modOrdersMap.get(emp.id) || 0

    const completedCount = completed?._count || 0
    const totalOrders = allOrders?._count || 0
    const totalRevenue = toNum(completed?._sum.total)
    const totalTips = toNum(payment?._sum.tipAmount)
    const avgOrderValue = completedCount > 0 ? round2(divide(totalRevenue, completedCount)) : 0
    const avgServiceTime = serviceTimes.length > 0
      ? serviceTimes.reduce((s, t) => s + t, 0) / serviceTimes.length : 0
    const tableTurnover = uniqueTables > 0 ? completedCount / uniqueTables : 0
    const upsellRate = totalOrders > 0 ? (modOrders / totalOrders) * 100 : 0
    const totalMinutes = toNum(timeEntry?._sum.totalMinutes)
    const hoursWorked = totalMinutes / 60
    const revenuePerHour = hoursWorked > 0 ? totalRevenue / hoursWorked : 0
    const voidedOrders = cancelled?._count || 0
    const voidRate = totalOrders > 0 ? (voidedOrders / totalOrders) * 100 : 0

    return {
      employeeId: emp.id, employeeName: emp.name, role: emp.role,
      jobs: emp.jobs.map(j => j.job.name),
      totalOrders: completedCount, totalRevenue, totalTips, avgOrderValue,
      avgServiceTime: Math.round(avgServiceTime * 10) / 10,
      tableTurnover: Math.round(tableTurnover * 10) / 10,
      upsellRate: Math.round(upsellRate * 10) / 10,
      revenuePerHour: Math.round(revenuePerHour * 100) / 100,
      hoursWorked: Math.round(hoursWorked * 10) / 10,
      voidRate: Math.round(voidRate * 10) / 10,
      orderTypeBreakdown: {
        dineIn: types?.get('dine-in') || 0,
        takeout: types?.get('takeout') || 0,
        delivery: types?.get('delivery') || 0,
      },
      shiftsWorked: shift?._count || 0,
      performanceScore: 0,
    }
  })
}

// Performance Score (0-100)
export function calculatePerformanceScores(performanceData: EmployeePerformance[]): void {
  const maxRevenue = Math.max(...performanceData.map(p => p.totalRevenue), 1)
  const maxTips = Math.max(...performanceData.map(p => p.totalTips), 1)
  const minServiceTime = Math.min(
    ...performanceData.filter(p => p.avgServiceTime > 0).map(p => p.avgServiceTime), 999
  )
  for (const p of performanceData) {
    const revenueScore = (p.totalRevenue / maxRevenue) * 30
    const tipsScore = (p.totalTips / maxTips) * 20
    const speedScore = p.avgServiceTime > 0
      ? Math.max(0, (1 - (p.avgServiceTime - minServiceTime) / 60) * 20) : 10
    const upsellScore = (p.upsellRate / 100) * 15
    const efficiencyScore = p.revenuePerHour > 0
      ? Math.min((p.revenuePerHour / (maxRevenue / Math.max(...performanceData.map(pp => pp.hoursWorked), 1))) * 100, 15) : 0
    const lowVoidScore = p.voidRate < 5 ? 0 : Math.max(0, -(p.voidRate - 5))
    p.performanceScore = Math.round(Math.min(100, Math.max(0,
      revenueScore + tipsScore + speedScore + upsellScore + efficiencyScore + lowVoidScore
    )))
  }
}

// Skupna statistika
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
