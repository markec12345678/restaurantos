
// ============================================
// END-OF-DAY (ZOD - Zaključek obratovalnega dneva)
// GET: Pridobi podatke za zaključek dneva
// POST: Zaključi obratovalni dan (zapri blagajno, generiraj izpiske)
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { eodCloseSchema, validateReportDateRange } from '@/lib/validations'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { fetchEodData, computeEodMetrics, computeCategoryBreakdown, enrichEmployeeNames, computeEodCloseData, closeShiftTransaction, logEodClose } from './_helpers'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('reports-eod', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // FIX HIGH: Validiraj datumski format
    const dateError = validateReportDateRange(date, date)
    if (dateError) return dateError

    const dayStart = new Date(date + 'T00:00:00.000Z')
    const dayEnd = new Date(date + 'T23:59:59.999Z')

    // FIX EOD-1 HIGH: Dodaj locationId filter
    const locationId = searchParams.get('locationId')

    // ─── VSE NEODVISNE POIZVEDBE VZPOREDNO ───
    const rawData = await fetchEodData(dayStart, dayEnd, locationId)

    // ─── IZRAČUNI METRIKE ───
    const metrics = computeEodMetrics(rawData)

    // ─── SEKUNDARNE POIZVEDBE (odvisne od rezultatov) ───
    const categoryBreakdown = await computeCategoryBreakdown(
      metrics.categoryData.categoryItemGroups, metrics.menuItemIds
    )
    const employeeBreakdownFinal = await enrichEmployeeNames(
      metrics.employeeBreakdown, metrics.empIds
    )

    return NextResponse.json({
      date,
      summary: metrics.summary,
      vatBreakdown: metrics.vatBreakdown,
      paymentMethods: metrics.paymentMethods,
      categoryBreakdown,
      employeeBreakdown: employeeBreakdownFinal,
      hourlyBreakdown: metrics.hourlyBreakdown,
      costs: metrics.costs,
      voidedItems: metrics.voidedItems,
      activeShift: metrics.activeShift,
      isDayClosed: metrics.isDayClosed,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/eod', 'Napaka pri pridobivanju poročila')
  }
}

// ============================================
// POST — ZAKLJUČI OBRATOVALNI DAN
// ============================================
export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('reports-eod', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX: Zod validacija za zaključek dneva
    const { data, error: validationError } = validateBody(eodCloseSchema, bodyResult.data)
    if (validationError) return validationError

    const { date, closingCash, notes } = data

    const targetDate = date || new Date().toISOString().split('T')[0]
    const dayStart = new Date(targetDate + 'T00:00:00.000Z')
    const dayEnd = new Date(targetDate + 'T23:59:59.999Z')

    // Preveri, da so vsa naročila zaključena ali preklicana
    const { db } = await import('@/lib/db')
    const pendingOrders = await db.order.count({
      where: {
        createdAt: { gte: dayStart, lte: dayEnd },
        status: { in: ['pending', 'in-progress', 'ready'] },
      },
    })

    if (pendingOrders > 0) {
      return NextResponse.json({
        error: `Obstaja ${pendingOrders} odprtih naročil. Najprej zaključite ali prekličite vsa naročila.`,
        pendingCount: pendingOrders,
      }, { status: 400 })
    }

    // Izračunaj zaključne podatke
    const closeData = await computeEodCloseData(dayStart, dayEnd, closingCash, targetDate)

    if (closeData.activeShift === null) {
      // Already handled by the throw in computeEodCloseData
    }

    // Zapri izmeno
    await closeShiftTransaction(closeData.activeShift.id, {
      actualClosingCash: closeData.actualClosingCash,
      expectedCash: closeData.expectedCash,
      cashDifference: closeData.cashDifference,
      cashSales: closeData.cashSales,
      cardSales: closeData.cardSales,
      mobileSales: closeData.mobileSales,
      alternateSales: closeData.alternateSales,
      totalSales: closeData.totalSales,
      completedOrdersCount: closeData.completedOrders.length,
      totalDiscounts: closeData.totalDiscounts,
      totalTips: closeData.totalTips,
      totalVoided: closeData.totalVoided,
      notes: notes || undefined,
    })

    // Revizijski dnevnik
    await logEodClose(
      authResult.session?.employeeId,
      closeData.activeShift.id,
      targetDate,
      {
        totalSales: closeData.totalSales,
        cashSales: closeData.cashSales,
        cardSales: closeData.cardSales,
        mobileSales: closeData.mobileSales,
        cashDifference: closeData.cashDifference,
      },
    )

    return NextResponse.json({
      success: true,
      message: 'Obratovalni dan uspešno zaključen',
      shiftId: closeData.activeShift.id,
      closedAt: new Date().toISOString(),
      summary: {
        totalSales: closeData.totalSales, cashSales: closeData.cashSales, cardSales: closeData.cardSales, mobileSales: closeData.mobileSales,
        totalTips: closeData.totalTips, totalDiscounts: closeData.totalDiscounts,
        startingCash: closeData.startingCash,
        expectedCash: closeData.expectedCash, closingCash: closeData.actualClosingCash, cashDifference: closeData.cashDifference,
      },
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'NO_OPEN_SHIFT') {
      return NextResponse.json({ error: 'Ni odprte blagajniške izmene' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'SHIFT_ALREADY_CLOSED') {
      return NextResponse.json({ error: 'Izmena je že zaprta' }, { status: 409 })
    }
    return handleApiError(error, 'POST /api/reports/eod', 'Napaka pri zaključku dneva')
  }
}
