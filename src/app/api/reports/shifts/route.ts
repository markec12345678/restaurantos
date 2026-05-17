import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// ============================================
// GET /api/reports/shifts — Poročilo po izmenah (blagajna)
// Prikazuje posamezne izmene s podrobnostmi o odprtju/zaprtju blagajne
// Parametri: startDate, endDate, status (open/closed)
// ============================================

export async function GET(req: Request) {
  try {
    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do blagajniških podatkov
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')

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

    // Obogatitev s podrobnostmi
    const enriched = shifts.map(shift => {
      const duration = shift.closedAt
        ? Math.round((new Date(shift.closedAt).getTime() - new Date(shift.openedAt).getTime()) / 60000)
        : Math.round((Date.now() - new Date(shift.openedAt).getTime()) / 60000)

      const expectedCash = shift.startingCash + shift.cashSales
      const cashDifference = shift.closingCash - expectedCash

      return {
        ...shift,
        durationMinutes: duration,
        expectedCash: Math.round(expectedCash * 100) / 100,
        cashDifference: Math.round(cashDifference * 100) / 100,
        totalSales: Math.round(shift.totalSales * 100) / 100,
        cashSales: Math.round(shift.cashSales * 100) / 100,
        cardSales: Math.round(shift.cardSales * 100) / 100,
        mobileSales: Math.round(shift.mobileSales * 100) / 100,
        alternateSales: Math.round(shift.alternateSales * 100) / 100,
        totalDiscounts: Math.round(shift.totalDiscounts * 100) / 100,
        totalTips: Math.round(shift.totalTips * 100) / 100,
        totalVoided: Math.round(shift.totalVoided * 100) / 100,
      }
    })

    // Povzetek vseh izmen
    const summary = {
      totalShifts: shifts.length,
      openShifts: shifts.filter(s => s.status === 'open').length,
      closedShifts: shifts.filter(s => s.status === 'closed').length,
      totalSales: Math.round(shifts.reduce((s, sh) => s + sh.totalSales, 0) * 100) / 100,
      totalCashSales: Math.round(shifts.reduce((s, sh) => s + sh.cashSales, 0) * 100) / 100,
      totalCardSales: Math.round(shifts.reduce((s, sh) => s + sh.cardSales, 0) * 100) / 100,
      totalMobileSales: Math.round(shifts.reduce((s, sh) => s + sh.mobileSales, 0) * 100) / 100,
      totalTips: Math.round(shifts.reduce((s, sh) => s + sh.totalTips, 0) * 100) / 100,
      totalDiscounts: Math.round(shifts.reduce((s, sh) => s + sh.totalDiscounts, 0) * 100) / 100,
      totalVoided: Math.round(shifts.reduce((s, sh) => s + sh.totalVoided, 0) * 100) / 100,
      avgDurationMinutes: shifts.length > 0
        ? Math.round(enriched.reduce((s, sh) => s + sh.durationMinutes, 0) / shifts.length)
        : 0,
    }

    return NextResponse.json({ shifts: enriched, summary })
  } catch (error) {
    console.error('Shifts report error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju poročila izmen' }, { status: 500 })
  }
}
