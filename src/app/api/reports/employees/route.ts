
// ============================================
// GET /api/reports/employees — Poročilo po zaposlenih
// Prikazuje prodajo, napitnine, št. naročil in povprečja po zaposlenem
// Parametri: startDate, endDate
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { toNum, multiply } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'

export async function GET(req: Request) {
  try {
    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do podatkov o zaposlenih
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // FIX HIGH: Validiraj datumski obseg — prepreči nalaganje celotne zgodovine
    const dateError = validateReportDateRange(startDate, endDate)
    if (dateError) return dateError

    // FIX HIGH: Pravilen filter — status='completed' in paymentStatus='paid' (ne status:'paid')
    const where: Record<string, unknown> = { status: 'completed', paymentStatus: 'paid' }
    // FIX HIGH: uporabi paidAt namesto createdAt za financo porocanje
    if (startDate || endDate) {
      const paidAt: Record<string, Date> = {}
      if (startDate) paidAt.gte = new Date(startDate)
      if (endDate) paidAt.lte = new Date(endDate)
      where.paidAt = paidAt
    }

    // Pridobi vsa naročila s povezanimi zaposlenimi
    const orders = await db.order.findMany({
      where,
      include: {
        orderItems: {
          include: {
            menuItem: { include: { category: { include: { menu: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Pridobi vse zaposlene
    const employees = await db.employee.findMany({
      where: { status: 'active' },
      include: { jobs: { include: { job: true } } },
    })
    const employeeMap = new Map(employees.map(e => [e.id, e]))

    // Agregacija po zaposlenih
    const employeeStats: Record<string, {
      employeeId: string
      employeeName: string
      role: string
      orderCount: number
      totalRevenue: number
      totalSubtotal: number
      totalTax: number
      totalDiscount: number
      totalTips: number
      avgOrderValue: number
      itemsSold: number
      voidedItems: number
      categoryBreakdown: Record<string, { category: string; revenue: number; quantity: number }>
      hourlyBreakdown: Record<string, { hour: string; revenue: number; orders: number }>
      topItems: Record<string, { name: string; quantity: number; revenue: number }>
    }> = {}

    for (const order of orders) {
      const empId = order.employeeId || 'unknown'
      const emp = employeeMap.get(empId)
      const empName = emp?.name || 'Nedoločen'
      const empRole = emp?.jobs?.[0]?.job?.name || emp?.role || ''

      if (!employeeStats[empId]) {
        employeeStats[empId] = {
          employeeId: empId,
          employeeName: empName,
          role: empRole,
          orderCount: 0,
          totalRevenue: 0,
          totalSubtotal: 0,
          totalTax: 0,
          totalDiscount: 0,
          totalTips: 0,
          avgOrderValue: 0,
          itemsSold: 0,
          voidedItems: 0,
          categoryBreakdown: {},
          hourlyBreakdown: {},
          topItems: {},
        }
      }

      const stats = employeeStats[empId]
      stats.orderCount += 1
      stats.totalRevenue += toNum(order.total)
      stats.totalSubtotal += toNum(order.subtotal)
      stats.totalTax += toNum(order.tax)
      stats.totalDiscount += toNum(order.discount)
      stats.totalTips += toNum(order.tip)

      for (const oi of order.orderItems) {
        if (oi.voided) {
          stats.voidedItems += oi.quantity
          continue
        }

        stats.itemsSold += oi.quantity

        // Kategorije
        const cat = oi.menuItem?.category?.name || 'Ostalo'
        if (!stats.categoryBreakdown[cat]) {
          stats.categoryBreakdown[cat] = { category: cat, revenue: 0, quantity: 0 }
        }
        stats.categoryBreakdown[cat].revenue += toNum(multiply(oi.price, oi.quantity))
        stats.categoryBreakdown[cat].quantity += oi.quantity

        // Top artikli
        const itemKey = oi.menuItemId
        if (!stats.topItems[itemKey]) {
          stats.topItems[itemKey] = {
            name: oi.menuItem?.name || 'Neznan',
            quantity: 0,
            revenue: 0,
          }
        }
        stats.topItems[itemKey].quantity += oi.quantity
        stats.topItems[itemKey].revenue += toNum(multiply(oi.price, oi.quantity))

        // Urna porazdelitev
        const hour = String(new Date(order.createdAt).getHours()).padStart(2, '0')
        if (!stats.hourlyBreakdown[hour]) {
          stats.hourlyBreakdown[hour] = { hour: `${hour}:00`, revenue: 0, orders: 0 }
        }
        stats.hourlyBreakdown[hour].revenue += toNum(multiply(oi.price, oi.quantity))
      }

      // Dodaj urno porazdelitev naročil
      const hour = String(new Date(order.createdAt).getHours()).padStart(2, '0')
      if (stats.hourlyBreakdown[hour]) {
        stats.hourlyBreakdown[hour].orders += 1
      }
    }

    // Izračunaj povprečja in zaokroži
    const result = Object.values(employeeStats).map(stats => {
      stats.avgOrderValue = stats.orderCount > 0
        ? Math.round((stats.totalRevenue / stats.orderCount) * 100) / 100
        : 0
      stats.totalRevenue = Math.round(stats.totalRevenue * 100) / 100
      stats.totalSubtotal = Math.round(stats.totalSubtotal * 100) / 100
      stats.totalTax = Math.round(stats.totalTax * 100) / 100
      stats.totalDiscount = Math.round(stats.totalDiscount * 100) / 100
      stats.totalTips = Math.round(stats.totalTips * 100) / 100

      // Pretvori mape v arrayje, sortirane po prihodku
      const categoryBreakdown = Object.values(stats.categoryBreakdown)
        .sort((a, b) => b.revenue - a.revenue)
        .map(c => ({ ...c, revenue: Math.round(c.revenue * 100) / 100 }))

      const hourlyBreakdown = Object.values(stats.hourlyBreakdown)
        .sort((a, b) => a.hour.localeCompare(b.hour))
        .map(h => ({ ...h, revenue: Math.round(h.revenue * 100) / 100 }))

      const topItems = Object.values(stats.topItems)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map(i => ({ ...i, revenue: Math.round(i.revenue * 100) / 100 }))

      return {
        ...stats,
        categoryBreakdown,
        hourlyBreakdown,
        topItems,
      }
    }).sort((a, b) => b.totalRevenue - a.totalRevenue)

    // Skupni seštevek — OPTIMIZACIJA: aggregate() namesto JS reduce() na rezultatih
    // Uporabimo Prisma aggregate za skupne vsote na bazi — ne nalagamo vseh naročil v pomnilnik
    const [orderAggregates, itemCount] = await Promise.all([
      db.order.aggregate({
        where,
        _sum: { total: true, tip: true, discount: true },
        _count: true,
      }),
      db.orderItem.count({
        where: {
          order: where,
          voided: false,
        },
      }),
    ])

    const totals = {
      totalRevenue: toNum(orderAggregates._sum.total),
      totalTips: toNum(orderAggregates._sum.tip),
      totalOrders: orderAggregates._count,
      totalItemsSold: itemCount,
      totalVoidedItems: result.reduce((s, e) => s + e.voidedItems, 0),
      avgOrderValue: orderAggregates._count > 0
        ? Math.round((toNum(orderAggregates._sum.total) / orderAggregates._count) * 100) / 100
        : 0,
      employeeCount: result.length,
    }

    return NextResponse.json({ employees: result, totals })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/employees', 'Napaka pri pridobivanju poročila po zaposlenih')
  }
}
