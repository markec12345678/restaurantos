
import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('reports-sales', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do prodajnih podatkov
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // FIX HIGH: Validiraj datumski obseg — prepreči nalaganje prevelikega obdobja
    const dateError = validateReportDateRange(startDate, endDate)
    if (dateError) return dateError

    const where: Record<string, unknown> = {
      status: 'completed',
      paymentStatus: 'paid',
    }
    // FIX CRITICAL: Uporabi paidAt namesto createdAt za financo porocanje
    // Naročila, ki so bila plačana v tem obdobju (ne ustvarjena!)
    if (startDate || endDate) {
      const paidAt: Record<string, Date> = {}
      if (startDate) paidAt.gte = new Date(startDate)
      if (endDate) paidAt.lte = new Date(endDate)
      where.paidAt = paidAt
    }

    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        checks: {
          include: {
            payments: {
              where: { status: 'completed' },
            },
          },
        },
      },
    })

    const totalRevenue = orders.reduce((sum, o) => sum + toNum(o.total), 0)
    const totalOrders = orders.length
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    const dailyRevenue: Record<string, { date: string; revenue: number; orders: number }> = {}
    orders.forEach(order => {
      const dateKey = new Date(order.paidAt || order.createdAt).toISOString().split('T')[0]
      if (!dailyRevenue[dateKey]) {
        dailyRevenue[dateKey] = { date: dateKey, revenue: 0, orders: 0 }
      }
      dailyRevenue[dateKey].revenue += toNum(order.total)
      dailyRevenue[dateKey].orders += 1
    })

    const typeBreakdown: Record<string, { type: string; revenue: number; count: number }> = {}
    orders.forEach(order => {
      if (!typeBreakdown[order.type]) {
        typeBreakdown[order.type] = { type: order.type, revenue: 0, count: 0 }
      }
      typeBreakdown[order.type].revenue += toNum(order.total)
      typeBreakdown[order.type].count += 1
    })

    // FIX HIGH: Payment method breakdown iz Check/Payment podatkov (ne order.paymentMethod, ki je lahko prazen)
    const paymentMethodBreakdown: Record<string, { method: string; revenue: number; tips: number; count: number }> = {}
    for (const order of orders) {
      const checks = order.checks || []
      if (checks.length > 0) {
        for (const check of checks) {
          for (const payment of (check.payments || [])) {
            const method = payment.type || 'unknown'
            if (!paymentMethodBreakdown[method]) {
              paymentMethodBreakdown[method] = { method, revenue: 0, tips: 0, count: 0 }
            }
            paymentMethodBreakdown[method].revenue += toNum(payment.amount)
            paymentMethodBreakdown[method].tips += toNum(payment.tipAmount)
            paymentMethodBreakdown[method].count += 1
          }
        }
      } else if (order.paymentMethod) {
        // Fallback za stare naročila brez checks
        const method = order.paymentMethod
        if (!paymentMethodBreakdown[method]) {
          paymentMethodBreakdown[method] = { method, revenue: 0, tips: 0, count: 0 }
        }
        paymentMethodBreakdown[method].revenue += toNum(order.total)
        paymentMethodBreakdown[method].tips += toNum(order.tip)
        paymentMethodBreakdown[method].count += 1
      }
    }

    return NextResponse.json({
      totalRevenue: round2(totalRevenue),
      totalOrders,
      avgOrderValue: round2(avgOrderValue),
      dailyRevenue: Object.values(dailyRevenue),
      typeBreakdown: Object.values(typeBreakdown),
      paymentMethodBreakdown: Object.values(paymentMethodBreakdown),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/sales', 'Napaka pri pridobivanju prodajnega poročila')
  }
}
