
// ============================================
// GET /api/reports/shifts — Poročilo po izmenah (blagajna)
// Prikazuje posamezne izmene s podrobnostmi o odprtju/zaprtju blagajne
// Parametri: startDate, endDate, status (open/closed)
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { toNum, round2, add } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do blagajniških podatkov
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')

    // FIX HIGH: Validiraj datumski obseg
    const dateError = validateReportDateRange(startDate, endDate)
    if (dateError) return dateError

    // FIX HIGH: Validiraj status parameter
    if (status && !['open', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Neveljaven status' }, { status: 400 })
    }

    const where: Record<string, unknown> = {}
    if (startDate || endDate) {
      const openedAt: Record<string, Date> = {}
      if (startDate) openedAt.gte = new Date(startDate)
      if (endDate) openedAt.lte = new Date(endDate)
      where.openedAt = openedAt
    }
    if (status) where.status = status

    const shifts = await db.cashRegisterShift.findMany({
      where,
      orderBy: { openedAt: 'desc' },
    })

    // Obogatitev s podrobnostmi — FIX: Decimal arithmetic
    const enriched = shifts.map(shift => {
      const duration = shift.closedAt
        ? Math.round((new Date(shift.closedAt).getTime() - new Date(shift.openedAt).getTime()) / 60000)
        : Math.round((Date.now() - new Date(shift.openedAt).getTime()) / 60000)

      // FIX: Decimal arithmetic — use toNum() + add() instead of Decimal + Decimal
      const expectedCash = toNum(shift.expectedCash) || toNum(add(add(shift.startingCash, shift.cashSales), shift.totalTips || 0))
      const cashDifference = toNum(shift.closingCash) - expectedCash

      return {
        ...shift,
        durationMinutes: duration,
        startingCash: round2(shift.startingCash),
        closingCash: round2(shift.closingCash),
        splitPayments: round2(shift.splitPayments),
        expectedCash: round2(expectedCash),
        cashDifference: round2(cashDifference),
        totalSales: round2(shift.totalSales),
        cashSales: round2(shift.cashSales),
        cardSales: round2(shift.cardSales),
        mobileSales: round2(shift.mobileSales),
        alternateSales: round2(shift.alternateSales),
        totalDiscounts: round2(shift.totalDiscounts),
        totalTips: round2(shift.totalTips),
        totalVoided: round2(shift.totalVoided),
      }
    })

    // Povzetek vseh izmen — OPTIMIZACIJA: aggregate() namesto JS reduce()
    // Prisma aggregate izračuna vsote na bazi — ne nalaga vseh zapisov v pomnilnik
    const [openCount, closedCount, shiftAggregates] = await Promise.all([
      db.cashRegisterShift.count({ where: { ...where, status: 'open' } }),
      db.cashRegisterShift.count({ where: { ...where, status: 'closed' } }),
      db.cashRegisterShift.aggregate({
        where,
        _sum: {
          totalSales: true,
          cashSales: true,
          cardSales: true,
          mobileSales: true,
          totalTips: true,
          totalDiscounts: true,
          totalVoided: true,
        },
      }),
    ])

    const summary = {
      totalShifts: shifts.length,
      openShifts: openCount,
      closedShifts: closedCount,
      totalSales: round2(shiftAggregates._sum.totalSales),
      totalCashSales: round2(shiftAggregates._sum.cashSales),
      totalCardSales: round2(shiftAggregates._sum.cardSales),
      totalMobileSales: round2(shiftAggregates._sum.mobileSales),
      totalTips: round2(shiftAggregates._sum.totalTips),
      totalDiscounts: round2(shiftAggregates._sum.totalDiscounts),
      totalVoided: round2(shiftAggregates._sum.totalVoided),
      avgDurationMinutes: enriched.length > 0
        ? Math.round(enriched.reduce((s, sh) => s + sh.durationMinutes, 0) / enriched.length)
        : 0,
    }

    return NextResponse.json({ shifts: enriched, summary })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/shifts', 'Napaka pri pridobivanju poročila izmen')
  }
}
