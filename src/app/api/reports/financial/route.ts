// GET /api/reports/financial — Celovito poslovno poročanje z izpiski za knjiženje
// Parametri: period=daily|weekly|monthly|yearly, date=YYYY-MM-DD (referenčni datum)
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
import { calcDateRange, fetchFinancialData } from './_helpers-queries'
import { computeFinancialMetrics } from './_helpers-compute'


export const dynamic = 'force-dynamic'
// FIX NAPAKA 5 (HTTP 503): Finančna poročila izvedejo obsežne agregacijske query-je.
export const maxDuration = 45

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('reports-financial', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do finančnih podatkov
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'daily'
    const refDateStr = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // FIX HIGH: Validiraj datumski format in omeji obdobje
    const dateError = validateReportDateRange(refDateStr, refDateStr)
    if (dateError) return dateError

    // FIX HIGH: Validiraj period parameter
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
      return NextResponse.json({ error: 'Neveljavno obdobje. Dovoljeno: daily, weekly, monthly, yearly' }, { status: 400 })
    }

    const refDate = new Date(refDateStr)
    const { startDate, endDate, prevStartDate, prevEndDate, periodLabel } = calcDateRange(refDate, period)

    // === POIZVEDBE (vzporedno s Promise.all za optimalno hitrost) ===
    const [
      currentStatusGroups,
      currentFinancialAgg,
      currentPaidOrders,
      completedOrdersLight,
      prevFinancialAgg,
      prevPaidOrdersLight,
      orderItems,
      stockCostGroups,
      cashRegisterAgg,
      orderTypeGroups,
    ] = await fetchFinancialData(startDate, endDate, prevStartDate, prevEndDate)

    // === IZRAČUNI ===
    const result = await computeFinancialMetrics(
      {
        currentStatusGroups, currentFinancialAgg, currentPaidOrders,
        completedOrdersLight, prevFinancialAgg, prevPaidOrdersLight,
        orderItems, stockCostGroups, cashRegisterAgg, orderTypeGroups,
      },
      period, refDate, periodLabel,
    )

    return NextResponse.json({
      period,
      periodLabel,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ...result,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/financial', 'Napaka pri pridobivanju poročila')
  }
}
