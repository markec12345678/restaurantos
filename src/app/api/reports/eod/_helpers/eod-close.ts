// EOD POST — Pomožne funkcije za zaključek obratovalnega dneva

import { db, createAuditLog } from '@/lib/db'
import { toNum } from '@/lib/decimal'

export interface EodCloseResult {
  totalSales: number
  cashSales: number
  cardSales: number
  mobileSales: number
  totalTips: number
  totalDiscounts: number
  startingCash: number
  expectedCash: number
  closingCash: number
  cashDifference: number
}

export async function computeEodCloseData(
  dayStart: Date,
  dayEnd: Date,
  closingCash: number | undefined,
  targetDate: string,
) {
  // Pridobi aktivno izmeno
  const activeShift = await db.cashRegisterShift.findFirst({
    where: { status: 'open' },
    orderBy: { openedAt: 'desc' },
  })

  if (!activeShift) {
    throw new Error('NO_OPEN_SHIFT')
  }

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

  return {
    activeShift,
    completedOrders,
    totalSales, cashSales, cardSales, mobileSales, alternateSales,
    totalTips, totalDiscounts,
    totalVoided: toNum(voidedItems._sum.price),
    startingCash: toNum(activeShift.startingCash),
    expectedCash, actualClosingCash, cashDifference,
    targetDate,
  }
}

export async function closeShiftTransaction(
  activeShiftId: string,
  data: {
    actualClosingCash: number
    expectedCash: number
    cashDifference: number
    cashSales: number
    cardSales: number
    mobileSales: number
    alternateSales: number
    totalSales: number
    completedOrdersCount: number
    totalDiscounts: number
    totalTips: number
    totalVoided: number
    notes?: string
  },
) {
  // FIX BUG-4 CRITICAL: Zapri izmeno ZNOTRAJ transakcije — prepreči double-close race condition
  await db.$transaction(async (tx) => {
    const shiftToClose = await tx.cashRegisterShift.findUnique({ where: { id: activeShiftId } })
    if (!shiftToClose) throw new Error('SHIFT_NOT_FOUND')
    if (shiftToClose.status === 'closed') throw new Error('SHIFT_ALREADY_CLOSED')

    await tx.cashRegisterShift.update({
      where: { id: activeShiftId },
      data: {
        status: 'closed', closedAt: new Date(),
        closingCash: data.actualClosingCash, expectedCash: data.expectedCash, cashDifference: data.cashDifference,
        cashSales: data.cashSales, cardSales: data.cardSales, mobileSales: data.mobileSales, alternateSales: data.alternateSales,
        totalSales: data.totalSales, totalOrders: data.completedOrdersCount,
        totalDiscounts: data.totalDiscounts, totalTips: data.totalTips,
        totalVoided: data.totalVoided,
        notes: data.notes || undefined,
      },
    })
  })
}

export async function logEodClose(
  employeeId: string | undefined,
  activeShiftId: string,
  targetDate: string,
  data: { totalSales: number; cashSales: number; cardSales: number; mobileSales: number; cashDifference: number },
) {
  await createAuditLog({
    userId: employeeId,
    action: 'CLOSE_REGISTER_SHIFT',
    entityType: 'CashRegisterShift',
    entityId: activeShiftId,
    details: { date: targetDate, ...data },
  })
}
