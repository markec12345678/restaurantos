
// ============================================
// GET /api/reports/employees — Poročilo po zaposlenih
// Prikazuje prodajo, napitnine, št. naročil in povprečja po zaposlenem
// Parametri: startDate, endDate
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { toNum } from '@/lib/decimal'
import { endOfDayParam, handleApiError } from '@/lib/api-utils'
import { createEmptyStats, aggregateOrderItems, finalizeStats, computeEmployeeTotals } from './_helpers'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)

    // FIX R84-1 HIGH: Tenant scope — poročilo po zaposlenih je prej zajemalo
    // naročila IN seznam aktivnih zaposlenih VSEH lokacij (križno-tenant PII:
    // imena, vloga, prihodki tujih zaposlenih). Fail-closed za regular
    // uporabnika brez lokacije. null scope (super-admin) = globalni pogled.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/reports/employees',
    })
    if ('error' in scope) return scope.error

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateError = validateReportDateRange(startDate, endDate)
    if (dateError) return dateError

    const where: Record<string, unknown> = {
      status: 'completed',
      paymentStatus: 'paid',
      // R84: tenant filter (null scope = PRAZEN filter, nikoli { locationId: null })
      ...(scope.locationId ? { locationId: scope.locationId } : {}),
    }
    if (startDate || endDate) {
      const paidAt: Record<string, Date> = {}
      if (startDate) paidAt.gte = new Date(startDate)
      if (endDate) paidAt.lte = endOfDayParam(endDate) // FIX r35: konec dneva, ne polnoč
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
      where: {
        status: 'active',
        // R84: tudi seznam zaposlenih mora biti scoped (PII) — legacy NULL
        // lokacija je za lokacijskega admina nevidna (fail-closed)
        ...(scope.locationId ? { locationId: scope.locationId } : {}),
      },
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
