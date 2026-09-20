// Pomožne funkcije za End-of-Day API — Pridobi vse EOD podatke (vzporedno)

import { db } from '@/lib/db'

// ─── Pridobi vse EOD podatke (vzporedno) ────────────────────

// FIX R82-F (LEAK-HIGH): locationId scope — prej so bili VSI agregati
// globalni (vsi tenanti). Pogojni spread (nikoli { locationId: null }):
// lokacijsko vezana seja → samo svoja vrstica; super-admin (null) → global.
// Guest count NIMA locationId stolpca (census R82-E) → ostaja globalen
// (dokumentirano; shematski predlog Guest.locationId = R83).
export async function fetchEodData(startDate: Date, endDate: Date, locationId?: string | null) {
  const loc = locationId ?? null
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
      where: {
        paidAt: { gte: startDate, lte: endDate },
        paymentStatus: { in: ['paid', 'partial'] },
        ...(loc ? { locationId: loc } : {}),
      },
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
      where: {
        cancelledAt: { gte: startDate, lte: endDate },
        status: 'cancelled',
        ...(loc ? { locationId: loc } : {}),
      },
    }),
    // Plačila — paidAt filter v DB where clause namesto JS .filter()
    db.payment.findMany({
      where: {
        status: 'completed',
        check: {
          order: {
            paidAt: { gte: startDate, lte: endDate },
            ...(loc ? { locationId: loc } : {}),
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
      where: {
        openedAt: { gte: startDate, lte: endDate },
        ...(loc ? { locationId: loc } : {}),
      },
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
        ...(loc ? { locationId: loc } : {}),
      },
      _count: { action: true },
    }),
    // Rezervacije — groupBy namesto findMany + JS .filter()
    db.reservation.groupBy({
      by: ['status'],
      where: {
        dateTime: { gte: startDate, lte: endDate },
        ...(loc ? { locationId: loc } : {}),
      },
      _count: { status: true },
    }),
    // Gosti — count() namesto findMany (rabimo samo število)
    // BY-DESIGN (R82-E): Guest NIMA locationId stolpca — globalni pool
    db.guest.count({
      where: { createdAt: { gte: startDate, lte: endDate } },
    }),
    // Stroški — select samo potrebna polja
    db.auditLog.findMany({
      where: {
        entityType: 'Expense',
        timestamp: { gte: startDate, lte: endDate },
        ...(loc ? { locationId: loc } : {}),
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
        ...(loc ? { locationId: loc } : {}),
      },
      select: { id: true },
    }),
  ])

  return {
    orders, cancelledOrdersCount, periodPayments, activeShift,
    fursStats, reservationStats, newGuestsCount, expenseEntries, existingEOD,
  }
}
