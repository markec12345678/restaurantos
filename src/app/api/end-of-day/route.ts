// ============================================
// END OF DAY API — Celoten proces zaključka dneva
// Toast POS + Restaurant365 standard
// Z-poročilo, FURS zaključek, uskladitev gotovine, dnevni povzetek
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { eodCloseSchema, validateReportDateRange } from '@/lib/validations'
import { toNum, sumBy, round2, subtract, add, multiply, divide, type DecimalLike } from '@/lib/decimal'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
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

    // ── Vse neodvisne poizvedbe vzporedno (Promise.all) ───────
    const [
      orders,
      cancelledOrdersCount,
      periodPayments,
      activeShift,
      fursStats,
      reservationStats,
      newGuestsCount,
      expenseEntries,
      existingEOD,
    ] = await Promise.all([
      // Naročila — select samo potrebna polja
      db.order.findMany({
        where: { paidAt: { gte: startDate, lte: endDate }, paymentStatus: { in: ['paid', 'partial'] } },
        select: {
          total: true,
          orderItems: {
            select: {
              price: true,
              quantity: true,
              vatRate: true,
              vatAmount: true,
              voided: true,
              discountAmount: true,
              menuItemName: true,
            },
          },
        },
      }),
      // Preklicana naročila — samo število (count namesto findMany)
      db.order.count({
        where: { cancelledAt: { gte: startDate, lte: endDate }, status: 'cancelled' },
      }),
      // Plačila — paidAt filter v DB where clause namesto JS .filter()
      db.payment.findMany({
        where: {
          status: 'completed',
          check: {
            order: {
              paidAt: { gte: startDate, lte: endDate },
            },
          },
        },
        select: {
          type: true,
          amount: true,
          tipAmount: true,
        },
      }),
      // Izmena (cash register shift) — select samo potrebna polja
      db.cashRegisterShift.findFirst({
        where: { openedAt: { gte: startDate, lte: endDate } },
        orderBy: { openedAt: 'desc' },
        select: {
          id: true,
          startingCash: true,
          cashSales: true,
          cardSales: true,
          totalSales: true,
          cashDifference: true,
          openedAt: true,
          closedAt: true,
        },
      }),
      // FURS status — groupBy namesto findMany + JS .filter()
      db.auditLog.groupBy({
        by: ['action'],
        where: {
          action: { in: ['FURS_INVOICE_VERIFIED', 'FURS_INVOICE_QUEUED', 'FURS_INVOICE_FAILED'] },
          timestamp: { gte: startDate, lte: endDate },
        },
        _count: { action: true },
      }),
      // Rezervacije — groupBy namesto findMany + JS .filter()
      db.reservation.groupBy({
        by: ['status'],
        where: { dateTime: { gte: startDate, lte: endDate } },
        _count: { status: true },
      }),
      // Gosti — count() namesto findMany (rabimo samo število)
      db.guest.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      // Stroški — select samo potrebna polja
      db.auditLog.findMany({
        where: {
          entityType: 'Expense',
          timestamp: { gte: startDate, lte: endDate },
        },
        select: {
          details: true,
        },
      }),
      // Preveri ali je EOD že zaključen — select samo id
      db.auditLog.findFirst({
        where: {
          entityType: 'EndOfDay',
          action: 'EOD_COMPLETED',
          timestamp: { gte: startDate, lte: endDate },
        },
        select: { id: true },
      }),
    ])

    // ── Naročila ──────────────────────────────────────────────
    // FIX HIGH: Uporabi paidAt + paymentStatus='paid' za finančna poročila, NE createdAt
    // Naročilo ustvarjeno ob 23:50 a plačano ob 00:10 sodi v DANES za finančna poročila
    const completedOrders = orders // Že filtrirano z paidAt + paymentStatus
    const totalRevenue = toNum(sumBy(completedOrders, o => o.total))
    const totalOrders = orders.length
    const avgOrderValue = completedOrders.length > 0 ? round2(divide(totalRevenue, completedOrders.length)) : 0

    // ── Plačila po metodi ─────────────────────────────────────
    // FIX HIGH: Uporabi completed plačila iz paidAt obdobja, ne createdAt
    // FIX C-10: Plačila morajo uporabljati isti časovni filter kot naročila (paidAt)
    const paymentsByMethod: Record<string, { count: number; total: number; tips: number }> = {}
    for (const p of periodPayments) {
      const method = p.type || 'unknown'
      if (!paymentsByMethod[method]) paymentsByMethod[method] = { count: 0, total: 0, tips: 0 }
      paymentsByMethod[method].count++
      paymentsByMethod[method].total += toNum(p.amount)
      paymentsByMethod[method].tips += toNum(p.tipAmount)
    }

    const totalTips = toNum(sumBy(periodPayments, p => p.tipAmount))

    // ── DDV po stopnjah ───────────────────────────────────────
    // FIX: vatAmount is already the total VAT for the line item (includes quantity factor)
    // Base = price * quantity - discountAmount (not price * quantity - vatAmount * quantity)
    const vatBreakdown: Record<string, { base: number; vat: number }> = {}
    for (const order of completedOrders) {
      for (const oi of order.orderItems) {
        if (oi.voided) continue // Skip voided items
        const rate = oi.vatRate?.toString() || '22'
        if (!vatBreakdown[rate]) vatBreakdown[rate] = { base: 0, vat: 0 }
        // Base = item total minus discount (what VAT was calculated on)
        const itemBase = toNum(oi.price) * (oi.quantity || 1) - toNum(oi.discountAmount)
        vatBreakdown[rate].base += itemBase
        vatBreakdown[rate].vat += toNum(oi.vatAmount)
      }
    }

    // ── FURS status ───────────────────────────────────────────
    const fursVerified = fursStats.find(g => g.action === 'FURS_INVOICE_VERIFIED')?._count.action ?? 0
    const fursQueued = fursStats.find(g => g.action === 'FURS_INVOICE_QUEUED')?._count.action ?? 0
    const fursFailed = fursStats.find(g => g.action === 'FURS_INVOICE_FAILED')?._count.action ?? 0

    // ── Rezervacije ───────────────────────────────────────────
    const totalReservations = reservationStats.reduce((sum, g) => sum + g._count.status, 0)
    const confirmedReservations = reservationStats
      .filter(g => g.status === 'confirmed' || g.status === 'completed')
      .reduce((sum, g) => sum + g._count.status, 0)
    const noShowReservations = reservationStats.find(g => g.status === 'no_show')?._count.status ?? 0

    // ── Stroški ───────────────────────────────────────────────
    const parseDetails = (d: unknown): Record<string, unknown> => {
      if (typeof d === 'string') { try { return JSON.parse(d) } catch { return {} } }
      return (d as Record<string, unknown>) || {}
    }

    const totalExpenses = expenseEntries.reduce((sum, e) => {
      const details = parseDetails(e.details)
      return sum + toNum(details.amount as DecimalLike)
    }, 0)

    // ── Neto dobiček ──────────────────────────────────────────
    const netProfit = round2(subtract(totalRevenue, totalExpenses))

    // ── Najbolj prodajani artikli ─────────────────────────────
    const itemSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {}
    for (const order of completedOrders) {
      for (const oi of order.orderItems) {
        const name = oi.menuItemName || 'Artikel'
        if (!itemSalesMap[name]) itemSalesMap[name] = { name, quantity: 0, revenue: 0 }
        itemSalesMap[name].quantity += oi.quantity || 1
        itemSalesMap[name].revenue += round2(multiply(oi.price || 0, oi.quantity || 1))
      }
    }
    const topItems = Object.values(itemSalesMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

    const eodCompleted = !!existingEOD

    return NextResponse.json({
      date,
      eodCompleted,
      // Naročila
      orders: {
        total: totalOrders,
        completed: completedOrders.length,
        cancelled: cancelledOrdersCount,
        revenue: totalRevenue,
        avgOrderValue,
      },
      // Plačila
      payments: {
        byMethod: paymentsByMethod,
        totalTips,
        totalPayments: periodPayments.length,
      },
      // DDV
      vat: vatBreakdown,
      // FURS
      furs: {
        verified: fursVerified,
        queued: fursQueued,
        failed: fursFailed,
        allVerified: fursFailed === 0 && fursQueued === 0,
      },
      // Izmena
      shift: activeShift ? {
        id: activeShift.id,
        startingCash: toNum(activeShift.startingCash),
        cashSales: toNum(activeShift.cashSales),
        cardSales: toNum(activeShift.cardSales),
        totalSales: toNum(activeShift.totalSales),
        cashDiff: toNum(activeShift.cashDifference),
        openedAt: activeShift.openedAt,
        closedAt: activeShift.closedAt,
        isClosed: !!activeShift.closedAt,
      } : null,
      // Rezervacije
      reservations: {
        total: totalReservations,
        confirmed: confirmedReservations,
        noShow: noShowReservations,
      },
      // Gosti
      guests: {
        newToday: newGuestsCount,
      },
      // Stroški
      expenses: {
        total: totalExpenses,
        count: expenseEntries.length,
      },
      // Neto
      netProfit,
      // Top artikli
      topItems,
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

    // FIX BUG-3 CRITICAL: Zaključi izmeno ZNOTRAJ transakcije — prepreči double-close race condition
    const cashDiff = await db.$transaction(async (tx) => {
      // FIX CRITICAL: Dodaj locationId filter — brez tega več lokacij povzroči napačne izračune
      const shiftWhere: Record<string, unknown> = { status: 'open' }
      if (locationId) shiftWhere.locationId = locationId
      const activeShift = await tx.cashRegisterShift.findFirst({
        where: shiftWhere,
        orderBy: { openedAt: 'desc' },
      })

      if (!activeShift) return null

      // FIX BUG-5 CRITICAL: Izračunaj cashSales iz ACTUAL plačil, NE shift.cashSales (=0 za odprto izmeno)
      // FIX CRITICAL: Dodaj locationId filter na naročila — prepreči cross-location kontaminacijo
      const paidOrdersInShift = await tx.order.findMany({
        where: {
          paymentStatus: 'paid',
          paidAt: { gte: activeShift.openedAt },
          ...(activeShift.locationId ? { locationId: activeShift.locationId } : {}),
        },
        select: {
          discount: true,
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

      const allPayments = paidOrdersInShift.flatMap(o => o.checks.flatMap(c => c.payments))
      const cashSales = toNum(sumBy(allPayments.filter(p => p.type === 'cash'), p => p.amount))
      const cardSales = toNum(sumBy(allPayments.filter(p => p.type === 'card'), p => p.amount))
      const mobileSales = toNum(sumBy(allPayments.filter(p => p.type === 'mobile'), p => p.amount))
      const alternateSales = toNum(sumBy(allPayments.filter(p => ['voucher', 'loyalty', 'giftcard', 'alternate'].includes(p.type)), p => p.amount))
      const totalSales = toNum(sumBy(allPayments, p => p.amount))
      const totalDiscounts = toNum(sumBy(paidOrdersInShift, o => o.discount))
      const totalTips = toNum(sumBy(allPayments, p => p.tipAmount))
      const totalOrders = paidOrdersInShift.length
      const cashTips = toNum(sumBy(allPayments.filter(p => p.type === 'cash'), p => p.tipAmount))
      const expectedCash = round2(add(add(activeShift.startingCash, cashSales), cashTips))

      // FIX BUG-2 HIGH: Storno naročila za totalVoided
      const stornoOrdersInShift = await tx.order.findMany({
        where: {
          paymentStatus: 'storno',
          cancelledAt: { gte: activeShift.openedAt },
          ...(activeShift.locationId ? { locationId: activeShift.locationId } : {}),
        },
        select: { id: true, total: true },
      })
      const totalVoided = toNum(sumBy(stornoOrdersInShift, o => o.total))

      const closingCash = actualCash ?? expectedCash
      const cashDifference = round2(subtract(closingCash, expectedCash))

      await tx.cashRegisterShift.update({
        where: { id: activeShift.id },
        data: {
          closedAt: new Date(),
          closingCash,
          expectedCash,
          cashDifference,
          cashSales,
          cardSales,
          mobileSales,
          alternateSales,
          totalSales,
          totalOrders,
          totalDiscounts,
          totalTips,
          totalVoided,
          notes: notes || '',
          status: 'closed',
        },
      })

      return { cashDifference, shiftId: activeShift.id }
    })

    // FIX CRITICAL: Prejšnja koda je vrnila success tudi ko ni bilo odprte izmene
    if (!cashDiff) {
      return NextResponse.json({ error: 'Ni odprte blagajniške izmene za zaključek' }, { status: 400 })
    }

    // Zapiši EOD audit log
    await createAuditLog({
      action: 'EOD_COMPLETED',
      entityType: 'EndOfDay',
      details: {
        date,
        actualCash: actualCash ?? 0,
        notes: notes || '',
        closedBy: authResult.session?.employeeId,
      } as Record<string, unknown>,
      userId: authResult.session?.employeeId,
    })

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
