// ============================================
// STAFF PERFORMANCE API — Analitika učinkovitosti zaposlenih
// Toast POS + 7shifts + Square standard
// Napitnine, povprečni čas strežbe, obračun miz, upsell
// ============================================
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum, round2, divide } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'today' // today, week, month
    const locationId = searchParams.get('locationId')
    // Določi datumski obseg
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
    // Pridobi vse podatke vzporedno
    const [
      employees,
      completedOrderStats,
      allOrderStats,
      cancelledOrderStats,
      orderTypeStats,
      uniqueTablesStats,
      paymentStats,
      shiftStats,
      timeEntryStats,
      serviceOrders,
      ordersWithMods,
    ] = await Promise.all([
      // Pridobi zaposlene — samo potrebna polja
      db.employee.findMany({
        where: {
          status: 'active',
          ...(locationId ? { locationId } : {}),
        },
        select: {
          id: true,
          name: true,
          role: true,
          jobs: { select: { job: { select: { name: true } } } },
        },
      }),
      // Zaključena naročila: prihodek + število po zaposlenem
      db.order.groupBy({
        by: ['employeeId'],
        where: {
          status: 'completed',
          createdAt: { gte: startDate },
          employeeId: { not: null },
          ...(locationId ? { locationId } : {}),
        },
        _sum: { total: true },
        _count: true,
      }),
      // Vsa naročila: skupno število po zaposlenem (za void rate in upsell rate)
      db.order.groupBy({
        by: ['employeeId'],
        where: {
          createdAt: { gte: startDate },
          employeeId: { not: null },
          ...(locationId ? { locationId } : {}),
        },
        _count: true,
      }),
      // Preklicana naročila po zaposlenem
      db.order.groupBy({
        by: ['employeeId'],
        where: {
          status: 'cancelled',
          createdAt: { gte: startDate },
          employeeId: { not: null },
          ...(locationId ? { locationId } : {}),
        },
        _count: true,
      }),
      // Vrste naročil po zaposlenem
      db.order.groupBy({
        by: ['employeeId', 'type'],
        where: {
          status: 'completed',
          createdAt: { gte: startDate },
          employeeId: { not: null },
          ...(locationId ? { locationId } : {}),
        },
        _count: true,
      }),
      // Enolične mize po zaposlenem (za tableTurnover)
      db.order.groupBy({
        by: ['employeeId', 'tableId'],
        where: {
          status: 'completed',
          createdAt: { gte: startDate },
          employeeId: { not: null },
          tableId: { not: null },
          ...(locationId ? { locationId } : {}),
        },
      }),
      // Napitnine iz plačil po zaposlenem
      db.payment.groupBy({
        by: ['employeeId'],
        where: {
          createdAt: { gte: startDate },
          employeeId: { not: null },
        },
        _sum: { tipAmount: true },
      }),
      // Izmena: število po zaposlenem
      db.staffShift.groupBy({
        by: ['employeeId'],
        where: {
          shiftDate: { gte: startDate },
          status: { notIn: ['cancelled'] },
          ...(locationId ? { locationId } : {}),
        },
        _count: true,
      }),
      // Časovni vnosi: ure po zaposlenem
      db.timeEntry.groupBy({
        by: ['employeeId'],
        where: {
          clockIn: { gte: startDate },
          clockOut: { not: null },
        },
        _sum: { totalMinutes: true },
      }),
      // Čas strežbe (od created do updatedAt za completed naročila)
      db.order.findMany({
        where: {
          status: 'completed',
          createdAt: { gte: startDate },
          employeeId: { not: null },
          ...(locationId ? { locationId } : {}),
        },
        select: { employeeId: true, createdAt: true, updatedAt: true },
      }),
      // Upsell meritev — naročila z dodatki/modifiers
      db.order.findMany({
        where: {
          createdAt: { gte: startDate },
          employeeId: { not: null },
          orderItems: { some: { modifiersJson: { not: '[]' } } },
          ...(locationId ? { locationId } : {}),
        },
        select: { employeeId: true },
      }),
    ])
    // Zgradi zemljevide za O(1) dostop
    const completedMap = new Map<string, (typeof completedOrderStats)[number]>()
    for (const r of completedOrderStats) {
      if (r.employeeId !== null) completedMap.set(r.employeeId, r)
    }
    const allOrdersMap = new Map<string, (typeof allOrderStats)[number]>()
    for (const r of allOrderStats) {
      if (r.employeeId !== null) allOrdersMap.set(r.employeeId, r)
    }
    const cancelledMap = new Map<string, (typeof cancelledOrderStats)[number]>()
    for (const r of cancelledOrderStats) {
      if (r.employeeId !== null) cancelledMap.set(r.employeeId, r)
    }
    const paymentMap = new Map<string, (typeof paymentStats)[number]>()
    for (const r of paymentStats) {
      if (r.employeeId !== null) paymentMap.set(r.employeeId, r)
    }
    const shiftMap = new Map<string, (typeof shiftStats)[number]>()
    for (const r of shiftStats) {
      if (r.employeeId !== null) shiftMap.set(r.employeeId, r)
    }
    const timeEntryMap = new Map<string, (typeof timeEntryStats)[number]>()
    for (const r of timeEntryStats) {
      if (r.employeeId !== null) timeEntryMap.set(r.employeeId, r)
    }
    // Vrste naročil po zaposlenem
    const orderTypeMap = new Map<string, Map<string, number>>()
    for (const r of orderTypeStats) {
      if (r.employeeId === null) continue
      if (!orderTypeMap.has(r.employeeId)) {
        orderTypeMap.set(r.employeeId, new Map())
      }
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
      if (minutes > 0 && minutes < 180) { // Razumni časi (do 3 ure)
        if (!serviceTimeMap.has(o.employeeId)) {
          serviceTimeMap.set(o.employeeId, [])
        }
        serviceTimeMap.get(o.employeeId)!.push(minutes)
      }
    }
    // Naročila z dodatki po zaposlenem
    const modOrdersMap = new Map<string, number>()
    for (const o of ordersWithMods) {
      if (!o.employeeId) continue
      modOrdersMap.set(o.employeeId, (modOrdersMap.get(o.employeeId) || 0) + 1)
    }
    // Analitika po zaposlenem
    const performanceData = employees.map(emp => {
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
      // Naročila tega zaposlenega
      const completedCount = completed?._count || 0
      const totalOrders = allOrders?._count || 0
      const totalRevenue = toNum(completed?._sum.total)
      // Napitnine
      const totalTips = toNum(payment?._sum.tipAmount)
      // Povprečna vrednost naročila
      const avgOrderValue = completedCount > 0 ? round2(divide(totalRevenue, completedCount)) : 0
      // Povprečni čas strežbe
      const avgServiceTime = serviceTimes.length > 0
        ? serviceTimes.reduce((sum, t) => sum + t, 0) / serviceTimes.length
        : 0
      // Obračun miz
      const tableTurnover = uniqueTables > 0
        ? completedCount / uniqueTables
        : 0
      // Upsell meritev — naročila z dodatki/modifiers
      const upsellRate = totalOrders > 0
        ? (modOrders / totalOrders) * 100
        : 0
      // Ure
      const totalMinutes = toNum(timeEntry?._sum.totalMinutes)
      const hoursWorked = totalMinutes / 60
      // Prihodek na uro
      const revenuePerHour = hoursWorked > 0 ? totalRevenue / hoursWorked : 0
      // Stornacije
      const voidedOrders = cancelled?._count || 0
      const voidRate = totalOrders > 0 ? (voidedOrders / totalOrders) * 100 : 0
      // Vrste naročil
      const dineIn = types?.get('dine-in') || 0
      const takeout = types?.get('takeout') || 0
      const delivery = types?.get('delivery') || 0
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        role: emp.role,
        jobs: emp.jobs.map(j => j.job.name),
        // Ključni KPI-ji
        totalOrders: completedCount,
        totalRevenue,
        totalTips,
        avgOrderValue,
        avgServiceTime: Math.round(avgServiceTime * 10) / 10,
        tableTurnover: Math.round(tableTurnover * 10) / 10,
        upsellRate: Math.round(upsellRate * 10) / 10,
        revenuePerHour: Math.round(revenuePerHour * 100) / 100,
        hoursWorked: Math.round(hoursWorked * 10) / 10,
        voidRate: Math.round(voidRate * 10) / 10,
        // Razdelitev naročil
        orderTypeBreakdown: { dineIn, takeout, delivery },
        // Izmena
        shiftsWorked: shift?._count || 0,
        // Ocenitev
        performanceScore: 0, // Izračunana spodaj
      }
    })
    // Izračunaj performance score (0-100) na podlagi kombinacije KPI-jev
    const maxRevenue = Math.max(...performanceData.map(p => p.totalRevenue), 1)
    const maxTips = Math.max(...performanceData.map(p => p.totalTips), 1)
    const minServiceTime = Math.min(...performanceData.filter(p => p.avgServiceTime > 0).map(p => p.avgServiceTime), 999)
    for (const p of performanceData) {
      const revenueScore = (p.totalRevenue / maxRevenue) * 30
      const tipsScore = (p.totalTips / maxTips) * 20
      const speedScore = p.avgServiceTime > 0
        ? Math.max(0, (1 - (p.avgServiceTime - minServiceTime) / 60) * 20)
        : 10
      const upsellScore = (p.upsellRate / 100) * 15
      const efficiencyScore = p.revenuePerHour > 0 ? Math.min((p.revenuePerHour / (maxRevenue / Math.max(...performanceData.map(pp => pp.hoursWorked), 1))) * 100, 15) : 0
      const lowVoidScore = p.voidRate < 5 ? 0 : Math.max(0, -(p.voidRate - 5))
      p.performanceScore = Math.round(Math.min(100, Math.max(0,
        revenueScore + tipsScore + speedScore + upsellScore + efficiencyScore + lowVoidScore
      )))
    }
    // Razvrsti po performance score
    performanceData.sort((a, b) => b.performanceScore - a.performanceScore)
    // Skupna statistika
    const totals = {
      totalRevenue: performanceData.reduce((s, p) => s + p.totalRevenue, 0),
      totalTips: performanceData.reduce((s, p) => s + p.totalTips, 0),
      totalOrders: performanceData.reduce((s, p) => s + p.totalOrders, 0),
      avgServiceTime: performanceData.filter(p => p.avgServiceTime > 0).length > 0
        ? performanceData.filter(p => p.avgServiceTime > 0).reduce((s, p) => s + p.avgServiceTime, 0) / performanceData.filter(p => p.avgServiceTime > 0).length
        : 0,
      avgPerformanceScore: performanceData.length > 0
        ? performanceData.reduce((s, p) => s + p.performanceScore, 0) / performanceData.length
        : 0,
    }
    return NextResponse.json({
      period,
      startDate,
      endDate: now,
      employees: performanceData,
      totals,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/staff-performance', 'Napaka pri pridobivanju analitike')
  }
}
