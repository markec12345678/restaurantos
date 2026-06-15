// Izračun metrik zaposlenega in performance score

import { toNum, round2, divide } from '@/lib/decimal'
import type { EmployeePerformance } from './metrics'

// ─── Pomožna: Map building ───
function toMap<T extends { employeeId: string | null }>(items: T[]): Map<string, T> {
  const m = new Map<string, T>()
  for (const r of items) {
    if (r.employeeId !== null) m.set(r.employeeId, r)
  }
  return m
}

// ─── Izračunaj metrike zaposlenega ───
export function computeEmployeePerformance(data: Awaited<ReturnType<typeof import('./data-fetch').fetchPerformanceData>>): EmployeePerformance[] {
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

// ─── Performance Score (0-100) ───
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
