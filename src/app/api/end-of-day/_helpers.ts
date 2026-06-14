// Pomožne funkcije za End-of-Day API
// Izvlečene iz route.ts za boljšo berljivost in vzdrževanje

import { db, createAuditLog } from '@/lib/db'
import { toNum, sumBy, round2, subtract, add, multiply, type DecimalLike } from '@/lib/decimal'

// ─── Pridobi vse EOD podatke (vzporedno) ────────────────────

export async function fetchEodData(startDate: Date, endDate: Date) {
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

  return {
    orders, cancelledOrdersCount, periodPayments, activeShift,
    fursStats, reservationStats, newGuestsCount, expenseEntries, existingEOD,
  }
}

// ─── Izračunaj vse EOD metrike ──────────────────────────────

export function computeEodMetrics(data: Awaited<ReturnType<typeof fetchEodData>>) {
  const { orders, periodPayments, fursStats, reservationStats, expenseEntries, existingEOD } = data

  // ── Naročila ──────────────────────────────────────────────
  // FIX HIGH: Uporabi paidAt + paymentStatus='paid' za finančna poročila, NE createdAt
  const completedOrders = orders
  const totalRevenue = toNum(sumBy(completedOrders, o => o.total))
  const totalOrders = orders.length
  const avgOrderValue = completedOrders.length > 0 ? round2(totalRevenue / completedOrders.length) : 0

  // ── Plačila po metodi ─────────────────────────────────────
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
  const vatBreakdown: Record<string, { base: number; vat: number }> = {}
  for (const order of completedOrders) {
    for (const oi of order.orderItems) {
      if (oi.voided) continue
      const rate = oi.vatRate?.toString() || '22'
      if (!vatBreakdown[rate]) vatBreakdown[rate] = { base: 0, vat: 0 }
      const itemBase = toNum(oi.price) * (oi.quantity || 1) - toNum(oi.discountAmount)
      vatBreakdown[rate].base += itemBase
      vatBreakdown[rate].vat += toNum(oi.vatAmount)
    }
  }

  // ── FURS status ───────────────────────────────────────────
  const fursVerified = fursStats.find(g => g.action === 'FURS_INVOICE_VERIFIED')?._count?.action ?? 0
  const fursQueued = fursStats.find(g => g.action === 'FURS_INVOICE_QUEUED')?._count?.action ?? 0
  const fursFailed = fursStats.find(g => g.action === 'FURS_INVOICE_FAILED')?._count?.action ?? 0

  // ── Rezervacije ───────────────────────────────────────────
  const totalReservations = reservationStats.reduce((sum, g) => sum + (g._count?.status ?? 0), 0)
  const confirmedReservations = reservationStats
    .filter(g => g.status === 'confirmed' || g.status === 'completed')
    .reduce((sum, g) => sum + (g._count?.status ?? 0), 0)
  const noShowReservations = reservationStats.find(g => g.status === 'no_show')?._count?.status ?? 0

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

  return {
    totalRevenue, totalOrders, avgOrderValue, completedOrders,
    paymentsByMethod, totalTips, vatBreakdown,
    fursVerified, fursQueued, fursFailed,
    totalReservations, confirmedReservations, noShowReservations,
    totalExpenses, netProfit, topItems, eodCompleted,
  }
}

// ─── Zaključi izmeno (POST transakcija) ─────────────────────

export async function closeShift(
  date: string,
  actualCash: number | null | undefined,
  notes: string | null | undefined,
  locationId: string | null | undefined,
  employeeId: string | null | undefined,
) {
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
    return null
  }

  // Zapiši EOD audit log
  await createAuditLog({
    action: 'EOD_COMPLETED',
    entityType: 'EndOfDay',
    details: {
      date,
      actualCash: actualCash ?? 0,
      notes: notes || '',
      closedBy: employeeId,
    } as Record<string, unknown>,
    userId: employeeId ?? undefined,
  })

  return cashDiff
}
