// ============================================
// STAFF PERFORMANCE API — Analitika učinkovitosti zaposlenih
// Toast POS + 7shifts + Square standard
// Napitnine, povprečni čas strežbe, obračun miz, upsell
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

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

    // Pridobi zaposlene
    const employees = await db.employee.findMany({
      where: {
        status: 'active',
        ...(locationId ? { locationId } : {}),
      },
      include: {
        jobs: { include: { job: true } },
      },
    })

    // Pridobi naročila v obdobju
    const orders = await db.order.findMany({
      where: {
        createdAt: { gte: startDate },
        ...(locationId ? { locationId } : {}),
      },
      include: {
        orderItems: true,
        table: true,
      },
    })

    // Pridobi napitnine iz plačil
    const payments = await db.payment.findMany({
      where: {
        createdAt: { gte: startDate },
        ...(locationId ? { locationId } : {}),
      },
    })

    // Pridobi izmene
    const shifts = await db.staffShift.findMany({
      where: {
        shiftDate: { gte: startDate },
        status: { notIn: ['cancelled'] },
        ...(locationId ? { locationId } : {}),
      },
    })

    // Pridobi časovne vnose
    const timeEntries = await db.timeEntry.findMany({
      where: {
        clockIn: { gte: startDate },
      },
    })

    // Analitika po zaposlenem
    const performanceData = employees.map(emp => {
      // Naročila tega zaposlenega
      const empOrders = orders.filter(o => o.employeeId === emp.id)
      const completedOrders = empOrders.filter(o => o.status === 'completed')
      const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0)

      // Napitnine
      const empPayments = payments.filter(p => p.employeeId === emp.id)
      const totalTips = empPayments.reduce((sum, p) => sum + (p.tipAmount || 0), 0)

      // Povprečna vrednost naročila
      const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0

      // Čas strežbe (od created do updatedAt za completed naročila)
      const serviceTimes = completedOrders
        .filter(o => o.updatedAt && o.createdAt)
        .map(o => {
          const created = new Date(o.createdAt).getTime()
          const completed = new Date(o.updatedAt).getTime()
          return (completed - created) / (1000 * 60) // minute
        })
        .filter(t => t > 0 && t < 180) // Razumni časi (do 3 ure)

      const avgServiceTime = serviceTimes.length > 0
        ? serviceTimes.reduce((sum, t) => sum + t, 0) / serviceTimes.length
        : 0

      // Obračun miz (koliko naročil na mizi)
      const tableOrders = new Map<string, number>()
      for (const o of completedOrders) {
        if (o.tableId) {
          tableOrders.set(o.tableId, (tableOrders.get(o.tableId) || 0) + 1)
        }
      }
      const tableTurnover = tableOrders.size > 0
        ? completedOrders.length / tableOrders.size
        : 0

      // Upsell meritev — naročila z dodatki/modifiers
      const ordersWithExtras = empOrders.filter(o =>
        o.orderItems?.some(oi => (oi as { modifiers?: string }).modifiers)
      ).length
      const upsellRate = empOrders.length > 0
        ? (ordersWithExtras / empOrders.length) * 100
        : 0

      // Izmena
      const empShifts = shifts.filter(s => s.employeeId === emp.id)
      const empTimeEntries = timeEntries.filter(t => t.employeeId === emp.id)
      const hoursWorked = empTimeEntries.reduce((sum, te) => {
        if (te.clockIn && te.clockOut) {
          return sum + (new Date(te.clockOut).getTime() - new Date(te.clockIn).getTime()) / (1000 * 60 * 60)
        }
        return sum
      }, 0)

      // Prihodek na uro
      const revenuePerHour = hoursWorked > 0 ? totalRevenue / hoursWorked : 0

      // Stornacije
      const voidedOrders = empOrders.filter(o => o.status === 'cancelled').length
      const voidRate = empOrders.length > 0 ? (voidedOrders / empOrders.length) * 100 : 0

      // Vrste naročil
      const dineIn = completedOrders.filter(o => o.type === 'dine-in').length
      const takeout = completedOrders.filter(o => o.type === 'takeout').length
      const delivery = completedOrders.filter(o => o.type === 'delivery').length

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        role: emp.role,
        jobs: emp.jobs.map(j => j.job.name),
        // Ključni KPI-ji
        totalOrders: completedOrders.length,
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
        shiftsWorked: empShifts.length,
        // Ocenitev
        performanceScore: 0, // Izračunana spodaj
      }
    })

    // Izračunaj performance score (0-100) na podlagi kombinacije KPI-jev
    const maxRevenue = Math.max(...performanceData.map(p => p.totalRevenue), 1)
    const maxTips = Math.max(...performanceData.map(p => p.totalTips), 1)
    const maxAvgOrder = Math.max(...performanceData.map(p => p.avgOrderValue), 1)
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
  } catch (error) {
    console.error('[STAFF-PERFORMANCE GET]', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju analitike' }, { status: 500 })
  }
}
