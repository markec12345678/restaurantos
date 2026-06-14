
// ============================================
// END-OF-DAY (ZOD - Zaključek obratovalnega dneva)
// GET: Pridobi podatke za zaključek dneva
// POST: Zaključi obratovalni dan (zapri blagajno, generiraj izpiske)
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { eodCloseSchema, validateReportDateRange } from '@/lib/validations'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { fetchEodData, computeEodMetrics, computeCategoryBreakdown, enrichEmployeeNames } from './_helpers'

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

    // Pridobi aktivno izmeno
    const activeShift = await db.cashRegisterShift.findFirst({
      where: { status: 'open' },
      orderBy: { openedAt: 'desc' },
    })

    if (!activeShift) {
      return NextResponse.json({ error: 'Ni odprte blagajniške izmene' }, { status: 400 })
    }

    // Izračunaj zaključne podatke
    // FIX CRITICAL: Uporabi ACTUAL payments iz checkov + paidAt za zaključek dneva
    const completedOrders = await db.order.findMany({
      where: {
        paidAt: { gte: dayStart, lte: dayEnd },
        paymentStatus: 'paid',
      },
      select: {
        id: true, total: true, discount: true, tip: true,
        checks: {
          select: {
            payments: {
              where: { status: 'completed' },
              select: { type: true, amount: true, tipAmount: true },
            },
          },
        },
      },
    })

    // FIX CRITICAL: Izračunaj po ACTUAL plačilih (uporabi payments iz checkov)
    const allPayments = completedOrders.flatMap(o => o.checks.flatMap(c => c.payments))
    const cashSales = allPayments.filter(p => p.type === 'cash').reduce((s, p) => s + toNum(p.amount), 0)
    const cardSales = allPayments.filter(p => p.type === 'card').reduce((s, p) => s + toNum(p.amount), 0)
    const mobileSales = allPayments.filter(p => p.type === 'mobile').reduce((s, p) => s + toNum(p.amount), 0)
    const alternateSales = allPayments.filter(p => ['voucher', 'loyalty', 'giftcard', 'alternate'].includes(p.type)).reduce((s, p) => s + toNum(p.amount), 0)
    const totalSales = allPayments.reduce((s, p) => s + toNum(p.amount), 0)
    const totalTips = allPayments.reduce((s, p) => s + toNum(p.tipAmount), 0)
    // FIX MEDIUM: Gotovinske napitnine se prištejejo k pričakovani gotovini
    const cashTips = allPayments.filter(p => p.type === 'cash').reduce((s, p) => s + toNum(p.tipAmount), 0)
    const totalDiscounts = completedOrders.reduce((s, o) => s + toNum(o.discount), 0)
    const voidedItems = await db.orderItem.aggregate({
      where: { voided: true, order: { createdAt: { gte: dayStart, lte: dayEnd } } },
      _sum: { price: true },
    })

    const expectedCash = toNum(activeShift.startingCash) + cashSales + cashTips
    const actualClosingCash = closingCash ?? expectedCash
    // FIX MEDIUM: cashDifference mora upoštevati tip v gotovinskih plačilih
    const cashDifference = actualClosingCash - expectedCash

    // FIX BUG-4 CRITICAL: Zapri izmeno ZNOTRAJ transakcije — prepreči double-close race condition
    await db.$transaction(async (tx) => {
      const shiftToClose = await tx.cashRegisterShift.findUnique({ where: { id: activeShift.id } })
      if (!shiftToClose) throw new Error('SHIFT_NOT_FOUND')
      if (shiftToClose.status === 'closed') throw new Error('SHIFT_ALREADY_CLOSED')

      await tx.cashRegisterShift.update({
        where: { id: activeShift.id },
        data: {
          status: 'closed', closedAt: new Date(),
          closingCash: actualClosingCash, expectedCash, cashDifference,
          cashSales, cardSales, mobileSales, alternateSales,
          totalSales, totalOrders: completedOrders.length,
          totalDiscounts, totalTips,
          totalVoided: toNum(voidedItems._sum.price),
          notes: notes || shiftToClose.notes,
        },
      })
    })

    // Revizijski dnevnik
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'CLOSE_REGISTER_SHIFT',
      entityType: 'CashRegisterShift',
      entityId: activeShift.id,
      details: { date: targetDate, totalSales, cashSales, cardSales, mobileSales, cashDifference },
    })

    return NextResponse.json({
      success: true,
      message: 'Obratovalni dan uspešno zaključen',
      shiftId: activeShift.id,
      closedAt: new Date().toISOString(),
      summary: {
        totalSales, cashSales, cardSales, mobileSales,
        totalTips, totalDiscounts,
        startingCash: toNum(activeShift.startingCash),
        expectedCash, closingCash: actualClosingCash, cashDifference,
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/reports/eod', 'Napaka pri zaključku dneva')
  }
}
