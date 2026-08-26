// Pomožne funkcije za finančno poročanje — poizvedbe in datumska obdobja
// GET /api/reports/financial — pomožni modul za poizvedbe

import { db } from '@/lib/db'

// ─── Tipi ───
export interface DateRange {
  startDate: Date
  endDate: Date
  prevStartDate: Date
  prevEndDate: Date
  periodLabel: string
}

// ─── Izračunaj obdobje glede na tip ───
export function calcDateRange(refDate: Date, period: string): DateRange {
  let startDate: Date
  let endDate: Date
  let prevStartDate: Date
  let prevEndDate: Date
  let periodLabel: string

  switch (period) {
    case 'daily': {
      startDate = new Date(refDate); startDate.setHours(0, 0, 0, 0)
      endDate = new Date(refDate); endDate.setHours(23, 59, 59, 999)
      prevStartDate = new Date(refDate); prevStartDate.setDate(prevStartDate.getDate() - 1); prevStartDate.setHours(0, 0, 0, 0)
      prevEndDate = new Date(refDate); prevEndDate.setDate(prevEndDate.getDate() - 1); prevEndDate.setHours(23, 59, 59, 999)
      periodLabel = startDate.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })
      break
    }
    case 'weekly': {
      const dayOfWeek = refDate.getDay() || 7 // Ponedeljek = 1
      startDate = new Date(refDate); startDate.setDate(refDate.getDate() - dayOfWeek + 1); startDate.setHours(0, 0, 0, 0)
      endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23, 59, 59, 999)
      prevStartDate = new Date(startDate); prevStartDate.setDate(prevStartDate.getDate() - 7)
      prevEndDate = new Date(endDate); prevEndDate.setDate(prevEndDate.getDate() - 7)
      periodLabel = `${startDate.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit' })} - ${endDate.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
      break
    }
    case 'monthly': {
      startDate = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
      endDate = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59, 999)
      prevStartDate = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1)
      prevEndDate = new Date(refDate.getFullYear(), refDate.getMonth(), 0, 23, 59, 59, 999)
      periodLabel = startDate.toLocaleDateString('sl-SI', { month: 'long', year: 'numeric' })
      break
    }
    case 'yearly': {
      startDate = new Date(refDate.getFullYear(), 0, 1)
      endDate = new Date(refDate.getFullYear(), 11, 31, 23, 59, 59, 999)
      prevStartDate = new Date(refDate.getFullYear() - 1, 0, 1)
      prevEndDate = new Date(refDate.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
      periodLabel = String(refDate.getFullYear())
      break
    }
    default: {
      startDate = new Date(refDate); startDate.setHours(0, 0, 0, 0)
      endDate = new Date(refDate); endDate.setHours(23, 59, 59, 999)
      prevStartDate = new Date(refDate); prevStartDate.setDate(prevStartDate.getDate() - 1); prevStartDate.setHours(0, 0, 0, 0)
      prevEndDate = new Date(refDate); prevEndDate.setDate(prevEndDate.getDate() - 1); prevEndDate.setHours(23, 59, 59, 999)
      periodLabel = startDate.toLocaleDateString('sl-SI')
    }
  }
  return { startDate, endDate, prevStartDate, prevEndDate, periodLabel }
}

// ─── Vzporedne poizvedbe za finančne podatke ───
// FIX CRITICAL: Za finančna poročila uporabimo paidAt (datum plačila) namesto createdAt.
// Naročilo, ustvarjeno včeraj a plačano danes, sodi v današnji dan.
export async function fetchFinancialData(startDate: Date, endDate: Date, prevStartDate: Date, prevEndDate: Date) {
  return Promise.all([
    // 1. Status counts za trenutno obdobje — groupBy namesto JS .filter()
    db.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: startDate, lte: endDate } },
      _count: true,
    }),
    // 2. Finančni agregati za trenutno obdobje — aggregate namesto findMany + reduce
    db.order.aggregate({
      where: { paidAt: { gte: startDate, lte: endDate }, paymentStatus: 'paid' },
      _sum: { total: true, subtotal: true, tax: true, discount: true, tip: true },
      _count: true,
    }),
    // 3. Plačana naročila za podrobnosti (plačilne metode, napitnine, mize)
    db.order.findMany({
      where: { paidAt: { gte: startDate, lte: endDate }, paymentStatus: 'paid' },
      select: {
        type: true, tableId: true, employeeId: true, total: true, tip: true,
        table: { select: { number: true, area: true } },
        checks: {
          select: {
            payments: {
              where: { status: 'completed' },
              select: { type: true, amount: true, tipAmount: true },
            },
          },
        },
      },
      orderBy: { paidAt: 'asc' },
    }),
    // 4. Zaključena naročila za časovno razdelitev — lahka poizvedba s select
    db.order.findMany({
      where: { createdAt: { gte: startDate, lte: endDate }, status: 'completed' },
      select: { paidAt: true, createdAt: true, total: true },
    }),
    // 5. Finančni agregati za prejšnje obdobje
    db.order.aggregate({
      where: { paidAt: { gte: prevStartDate, lte: prevEndDate }, paymentStatus: 'paid' },
      _sum: { total: true, subtotal: true, tax: true, discount: true, tip: true },
      _count: true,
    }),
    // 6. Plačana naročila za prejšnje obdobje časovno razdelitev
    db.order.findMany({
      where: { paidAt: { gte: prevStartDate, lte: prevEndDate }, paymentStatus: 'paid' },
      select: { paidAt: true, createdAt: true, total: true },
    }),
    // 7. Artikli naročil za kategorije/DDV razčlenitev
    db.orderItem.findMany({
      where: { order: { paidAt: { gte: startDate, lte: endDate }, paymentStatus: 'paid' }, voided: false },
      select: {
        menuItemId: true, price: true, quantity: true, vatRate: true, vatAmount: true,
        menuItem: { select: { name: true, category: { select: { name: true } } } },
      },
    }),
    // 8. Stroški zaloga po tipu — groupBy namesto JS .filter()
    db.stockTransaction.groupBy({
      by: ['type'],
      where: { createdAt: { gte: startDate, lte: endDate } },
      _sum: { totalCost: true },
    }),
    // 9. Blagajna izpiski — aggregate namesto findMany + reduce
    db.cashRegisterShift.aggregate({
      where: { openedAt: { gte: startDate, lte: endDate } },
      _sum: { cashSales: true, cardSales: true, mobileSales: true },
      _count: true,
    }),
    // 10. Vrste naročil — groupBy namesto JS forEach
    db.order.groupBy({
      by: ['type'],
      where: { paidAt: { gte: startDate, lte: endDate }, paymentStatus: 'paid' },
      _sum: { total: true },
      _count: true,
    }),
  ])
}
