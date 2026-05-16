import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ============================================
// GET /api/reports/employees — Poročilo po zaposlenih
// Prikazuje prodajo, napitnine, št. naročil in povprečja po zaposlenem
// Parametri: startDate, endDate
// ============================================

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Record<string, unknown> = { status: { in: ['completed', 'paid'] } }
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {}
      if (startDate) createdAt.gte = new Date(startDate)
      if (endDate) createdAt.lte = new Date(endDate)
      where.createdAt = createdAt
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
      stats.totalRevenue += order.total
      stats.totalSubtotal += order.subtotal
      stats.totalTax += order.tax
      stats.totalDiscount += order.discount
      stats.totalTips += (order.tip || 0)

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
        stats.categoryBreakdown[cat].revenue += oi.price * oi.quantity
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
        stats.topItems[itemKey].revenue += oi.price * oi.quantity

        // Urna porazdelitev
        const hour = String(new Date(order.createdAt).getHours()).padStart(2, '0')
        if (!stats.hourlyBreakdown[hour]) {
          stats.hourlyBreakdown[hour] = { hour: `${hour}:00`, revenue: 0, orders: 0 }
        }
        stats.hourlyBreakdown[hour].revenue += oi.price * oi.quantity
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

    // Skupni seštevek
    const totals = {
      totalRevenue: Math.round(result.reduce((s, e) => s + e.totalRevenue, 0) * 100) / 100,
      totalTips: Math.round(result.reduce((s, e) => s + e.totalTips, 0) * 100) / 100,
      totalOrders: result.reduce((s, e) => s + e.orderCount, 0),
      totalItemsSold: result.reduce((s, e) => s + e.itemsSold, 0),
      totalVoidedItems: result.reduce((s, e) => s + e.voidedItems, 0),
      avgOrderValue: result.length > 0
        ? Math.round((result.reduce((s, e) => s + e.totalRevenue, 0) / result.reduce((s, e) => s + e.orderCount, 0)) * 100) / 100
        : 0,
      employeeCount: result.length,
    }

    return NextResponse.json({ employees: result, totals })
  } catch (error) {
    console.error('Employee report error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju poročila po zaposlenih' }, { status: 500 })
  }
}
