
// ============================================
// GET /api/reports/vat — DDV razčlenitev za FURS
// Prikazuje prodajo po DDV stopnjah (22%, 9.5%, 0%)
// Parametri: startDate, endDate, period (daily/weekly/monthly/yearly)
// ============================================

import { db } from '@/lib/db'
import { round2 } from '@/lib/decimal'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { endOfDayParam, handleApiError } from '@/lib/api-utils'
import { computeVatBreakdown, computeTimeVatDistribution } from './_helpers'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('reports-vat', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do DDV podatkov (FURS relevantno)
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)

    // FIX R84-1 HIGH: Tenant scope — DDV razčlenitev (FURS relevantno) je prej
    // zajela paid naročila VSEH lokacij. Fail-closed za regular uporabnika brez
    // lokacije. null scope (super-admin) = globalni pogled.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/reports/vat',
    })
    if ('error' in scope) return scope.error

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
    const where: Record<string, unknown> = {
      paymentStatus: 'paid',
      // R84: tenant filter (null scope = PRAZEN filter, nikoli { locationId: null })
      ...(scope.locationId ? { locationId: scope.locationId } : {}),
    }
    if (startDate || endDate) {
      const paidAt: Record<string, Date> = {}
      if (startDate) paidAt.gte = new Date(startDate)
      if (endDate) paidAt.lte = endOfDayParam(endDate) // FIX r35: konec dneva, ne polnoč
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
