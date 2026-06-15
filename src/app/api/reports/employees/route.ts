
// ============================================
// GET /api/reports/employees — Poročilo po zaposlenih
// Prikazuje prodajo, napitnine, št. naročil in povprečja po zaposlenem
// Parametri: startDate, endDate
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { toNum } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'
import { createEmptyStats, aggregateOrderItems, finalizeStats, computeEmployeeTotals } from './_helpers'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateError = validateReportDateRange(startDate, endDate)
    if (dateError) return dateError

    const where: Record<string, unknown> = { status: 'completed', paymentStatus: 'paid' }
    if (startDate || endDate) {
      const paidAt: Record<string, Date> = {}
      if (startDate) paidAt.gte = new Date(startDate)
      if (endDate) paidAt.lte = new Date(endDate)
      where.paidAt = paidAt
    }

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

    const employees = await db.employee.findMany({
      where: { status: 'active' },
      include: { jobs: { include: { job: true } } },
    })
    const employeeMap = new Map(employees.map(e => [e.id, e]))

    // Agregacija po zaposlenih
    const employeeStats: Record<string, ReturnType<typeof createEmptyStats>> = {}

    for (const order of orders) {
      const empId = order.employeeId || 'unknown'
      const emp = employeeMap.get(empId)
      const empName = emp?.name || 'Nedoločen'
      const empRole = emp?.jobs?.[0]?.job?.name || emp?.role || ''

      if (!employeeStats[empId]) {
        employeeStats[empId] = createEmptyStats(empId, empName, empRole)
      }

      const stats = employeeStats[empId]
      stats.orderCount += 1
      stats.totalRevenue += toNum(order.total)
      stats.totalSubtotal += toNum(order.subtotal)
      stats.totalTax += toNum(order.tax)
      stats.totalDiscount += toNum(order.discount)
      stats.totalTips += toNum(order.tip)

      aggregateOrderItems(stats, order)
    }

    const result = Object.values(employeeStats).map(stats => finalizeStats(stats)).sort((a, b) => b.totalRevenue - a.totalRevenue)

    // Skupni seštevek — uporabi izluščeno pomožno funkcijo
    const totals = await computeEmployeeTotals(where, result)

    return NextResponse.json({ employees: result, totals })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/employees', 'Napaka pri pridobivanju poročila po zaposlenih')
  }
}
