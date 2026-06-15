// Pomožne funkcije za finančno poročanje — Blagajna, knjiženje, primerjava obdobij

import { toNum, round2 } from '@/lib/decimal'
import type { CashRegisterAgg, OrderTypeGroup } from './types'

export function computeCashRegister(
  cashRegisterAgg: CashRegisterAgg,
  paymentMethods: Record<string, { method: string; revenue: number }>,
) {
  const totalCashSales = toNum(cashRegisterAgg._sum.cashSales)
  const totalCardSales = toNum(cashRegisterAgg._sum.cardSales)
  const totalMobileSales = toNum(cashRegisterAgg._sum.mobileSales)
  const effectiveCashSales = totalCashSales > 0 ? totalCashSales : toNum(paymentMethods['gotovina']?.revenue || 0)
  const effectiveCardSales = totalCardSales > 0 ? totalCardSales : toNum(paymentMethods['kartica']?.revenue || 0)
  const effectiveMobileSales = totalMobileSales > 0 ? totalMobileSales : toNum(paymentMethods['mobilno']?.revenue || 0)
  return { totalCashSales: effectiveCashSales, totalCardSales: effectiveCardSales, totalMobileSales: effectiveMobileSales, shiftCount: cashRegisterAgg._count }
}

export function computeBookingEntry(
  periodLabel: string,
  period: string,
  totalSubtotal: number,
  totalTax: number,
  effectiveCashSales: number,
  effectiveCardSales: number,
  effectiveMobileSales: number,
) {
  return {
    date: periodLabel, period,
    debit: { '1140 - Potrošniki - Gotovina': round2(effectiveCashSales), '1140 - Potrošniki - Kartice': round2(effectiveCardSales), '1140 - Potrošniki - Mobilno': round2(effectiveMobileSales) },
    credit: { '7600 - Prihodki od prodaje jedi in pijač': round2(totalSubtotal), '2530 - DDV obveznosti': round2(totalTax) },
    totalDebit: round2(effectiveCashSales + effectiveCardSales + effectiveMobileSales), totalCredit: round2(totalSubtotal + totalTax),
  }
}

export function computePeriodComparison(
  totalRevenue: number,
  totalSubtotal: number,
  totalTax: number,
  totalDiscount: number,
  totalTips: number,
  completedCount: number,
  avgOrderValue: number,
  prevRevenue: number,
  prevSubtotal: number,
  prevTax: number,
  prevDiscount: number,
  prevTips: number,
  prevCount: number,
  prevAvgOrderValue: number,
) {
  const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0
  const orderChange = prevCount > 0 ? ((completedCount - prevCount) / prevCount) * 100 : 0

  return {
    current: { revenue: round2(totalRevenue), subtotal: round2(totalSubtotal), tax: round2(totalTax), discount: round2(totalDiscount), tips: round2(totalTips), orders: completedCount, avgOrderValue: round2(avgOrderValue) },
    previous: { revenue: round2(prevRevenue), subtotal: round2(prevSubtotal), tax: round2(prevTax), discount: round2(prevDiscount), tips: round2(prevTips), orders: prevCount, avgOrderValue: round2(prevAvgOrderValue) },
    changes: {
      revenue: round2(revenueChange), orders: round2(orderChange),
      avgOrderValue: prevAvgOrderValue > 0 ? round2(((avgOrderValue - prevAvgOrderValue) / prevAvgOrderValue) * 100) : 0,
      tips: prevTips > 0 ? round2(((totalTips - prevTips) / prevTips) * 100) : 0,
    },
  }
}

export function computeOrderTypes(orderTypeGroups: OrderTypeGroup[]) {
  return orderTypeGroups.map(g => ({
    type: g.type || 'dine-in', count: g._count, revenue: toNum(g._sum.total),
    avgValue: g._count > 0 ? round2(toNum(g._sum.total) / g._count) : 0,
  }))
}
