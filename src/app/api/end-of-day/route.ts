// ============================================
// END OF DAY API — Celoten proces zaključka dneva
// Toast POS + Restaurant365 standard
// Z-poročilo, FURS zaključek, uskladitev gotovine, dnevni povzetek
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { eodCloseSchema, validateReportDateRange } from '@/lib/validations'
import { toNum } from '@/lib/decimal'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { fetchEodData, computeEodMetrics, closeShift } from './_helpers'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // FIX HIGH: Validiraj datumski format
    const dateError = validateReportDateRange(date, date)
    if (dateError) return dateError

    const startDate = new Date(date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)

    // ── Vse neodvisne poizvedbe vzporedno ────────────────────
    const data = await fetchEodData(startDate, endDate)

    // ── Izračunaj vse metrike ────────────────────────────────
    const metrics = computeEodMetrics(data)

    return NextResponse.json({
      date,
      eodCompleted: metrics.eodCompleted,
      // Naročila
      orders: {
        total: metrics.totalOrders,
        completed: metrics.completedOrders.length,
        cancelled: data.cancelledOrdersCount,
        revenue: metrics.totalRevenue,
        avgOrderValue: metrics.avgOrderValue,
      },
      // Plačila
      payments: {
        byMethod: metrics.paymentsByMethod,
        totalTips: metrics.totalTips,
        totalPayments: data.periodPayments.length,
      },
      // DDV
      vat: metrics.vatBreakdown,
      // FURS
      furs: {
        verified: metrics.fursVerified,
        queued: metrics.fursQueued,
        failed: metrics.fursFailed,
        allVerified: metrics.fursFailed === 0 && metrics.fursQueued === 0,
      },
      // Izmena
      shift: data.activeShift ? {
        id: data.activeShift.id,
        startingCash: toNum(data.activeShift.startingCash),
        cashSales: toNum(data.activeShift.cashSales),
        cardSales: toNum(data.activeShift.cardSales),
        totalSales: toNum(data.activeShift.totalSales),
        cashDiff: toNum(data.activeShift.cashDifference),
        openedAt: data.activeShift.openedAt,
        closedAt: data.activeShift.closedAt,
        isClosed: !!data.activeShift.closedAt,
      } : null,
      // Rezervacije
      reservations: {
        total: metrics.totalReservations,
        confirmed: metrics.confirmedReservations,
        noShow: metrics.noShowReservations,
      },
      // Gosti
      guests: {
        newToday: data.newGuestsCount,
      },
      // Stroški
      expenses: {
        total: metrics.totalExpenses,
        count: data.expenseEntries.length,
      },
      // Neto
      netProfit: metrics.netProfit,
      // Top artikli
      topItems: metrics.topItems,
      // Checklisti
      checklists: {
        opening: 'Preveri kontrolni seznam za odpiranje',
        closing: 'Preveri kontrolni seznam za zapiranje',
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/end-of-day', 'Napaka pri pridobivanju EOD podatkov')
  }
}

// ============================================
// POST — Zaključi dan
// ============================================
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX CRITICAL: Zod validacija za EOD POST — prejšnja koda ni imela nobene validacije
    const { data, error: validationError } = validateBody(eodCloseSchema, bodyResult.data)
    if (validationError) return validationError

    const { date, actualCash, notes, locationId } = data

    const cashDiff = await closeShift(date, actualCash, notes, locationId, authResult.session?.employeeId)

    // FIX CRITICAL: Prejšnja koda je vrnila success tudi ko ni bilo odprte izmene
    if (!cashDiff) {
      return NextResponse.json({ error: 'Ni odprte blagajniške izmene za zaključek' }, { status: 400 })
    }

    // FIX BUG-6 HIGH: Vrni PRAVI cashDifference (ne totalTips, ampak cashTips-only izračun)
    return NextResponse.json({
      success: true,
      message: `Dan ${date} je uspešno zaključen`,
      cashDiff: toNum(cashDiff?.cashDifference) ?? 0,
      shiftId: cashDiff?.shiftId ?? null,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/end-of-day', 'Napaka pri zaključku dneva')
  }
}
