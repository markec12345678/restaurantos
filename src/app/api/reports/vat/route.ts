
// ============================================
// GET /api/reports/vat — DDV razčlenitev za FURS
// Prikazuje prodajo po DDV stopnjah (22%, 9.5%, 0%)
// Parametri: startDate, endDate, period (daily/weekly/monthly/yearly)
// ============================================

import { db } from '@/lib/db'
import { round2 } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
import { computeVatBreakdown, computeTimeVatDistribution } from './_helpers'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('reports-vat', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do DDV podatkov (FURS relevantno)
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const period = searchParams.get('period') || 'monthly'

    // FIX HIGH: Validiraj datumski obseg in period parameter
    const dateError = validateReportDateRange(startDate, endDate)
    if (dateError) return dateError
    if (period && !['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
      return NextResponse.json({ error: 'Neveljavno obdobje' }, { status: 400 })
    }

    // Obdobje
    // FIX CRITICAL: Za DDV poročilo uporabimo paymentStatus='paid' — neplačana naročila NE sodijo v DDV poročilo
    const where: Record<string, unknown> = { paymentStatus: 'paid' }
    if (startDate || endDate) {
      const paidAt: Record<string, Date> = {}
      if (startDate) paidAt.gte = new Date(startDate)
      if (endDate) paidAt.lte = new Date(endDate)
      // FIX CRITICAL: Uporabi paidAt za finančno/DDV poročilo namesto createdAt
      where.paidAt = paidAt
    }

    const orders = await db.order.findMany({
      where,
      include: {
        orderItems: {
          include: { menuItem: { include: { category: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // === DDV RAZČLENITEV PO STOPNJAH ===
    const vatRates = computeVatBreakdown(orders)

    // === ČASOVNA RAZDELITEV PO DDV STOPNJAH ===
    const timeVatDistribution = computeTimeVatDistribution(orders, period)

    // === SKUPAJ ===
    const totalBase = Object.values(vatRates).reduce((sum, vr) => sum + vr.baseAmount, 0)
    const totalVat = Object.values(vatRates).reduce((sum, vr) => sum + vr.vatAmount, 0)

    return NextResponse.json({
      period,
      startDate: startDate || null,
      endDate: endDate || null,
      vatBreakdown: Object.values(vatRates),
      timeDistribution: timeVatDistribution,
      summary: {
        totalBase: round2(totalBase),
        totalVat: round2(totalVat),
        totalWithVat: round2(totalBase + totalVat),
        completedOrders: orders.length,
      },
      // FURS format za davčno overjanje
      fursFormat: Object.values(vatRates).map(vr => ({
        taxRate: vr.rate,
        taxBase: vr.baseAmount,
        taxAmount: vr.vatAmount,
        code: vr.code,
      })),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/vat', 'Napaka pri pridobivanju DDV poročila')
  }
}
