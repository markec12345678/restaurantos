// Pomožne funkcije za finančno poročanje — Izračunaj vse finančne metrike

import { toNum, round2 } from '@/lib/decimal'
import type { PaidOrder, OrderItemRow, FinancialAgg, StockCostGroup, CashRegisterAgg, OrderTypeGroup } from './types'
import { computeTimeDistribution } from './time-distribution'
import { computePaymentMethods, computeCategoryItemBreakdown } from './payments-categories'
import { computeTips, computeTableRevenue, computeHourlyHeatmap, computeVatBreakdown, computeStockCosts } from './tips-tables-heatmap'
import { computeCashRegister, computeBookingEntry, computePeriodComparison, computeOrderTypes } from './cash-register-booking'
import { buildFinancialSummary } from './build-summary'

// ─── Izračunaj vse finančne metrike ───
export async function computeFinancialMetrics(
  data: {
    currentStatusGroups: Array<{ status: string; _count: number }>
    currentFinancialAgg: FinancialAgg
    currentPaidOrders: PaidOrder[]
    completedOrdersLight: import('./types').TimeDistOrder[]
    prevFinancialAgg: FinancialAgg
    prevPaidOrdersLight: import('./types').TimeDistOrder[]
    orderItems: OrderItemRow[]
    stockCostGroups: StockCostGroup[]
    cashRegisterAgg: CashRegisterAgg
    orderTypeGroups: OrderTypeGroup[]
  },
  period: string, refDate: Date, periodLabel: string
) {
  const {
    currentStatusGroups, currentFinancialAgg, currentPaidOrders,
    completedOrdersLight, prevFinancialAgg, prevPaidOrdersLight,
    orderItems, stockCostGroups, cashRegisterAgg, orderTypeGroups,
  } = data

  // === OSNOVNI KAZALCI ===
  const totalOrdersCount = currentStatusGroups.reduce((s, g) => s + g._count, 0)
  const cancelledCount = currentStatusGroups.find(g => g.status === 'cancelled')?._count ?? 0
  const totalRevenue = toNum(currentFinancialAgg._sum.total)
  const totalSubtotal = toNum(currentFinancialAgg._sum.subtotal)
  const totalTax = toNum(currentFinancialAgg._sum.tax)
  const totalDiscount = toNum(currentFinancialAgg._sum.discount)
  const completedCount = currentFinancialAgg._count
  const avgOrderValue = completedCount > 0 ? totalRevenue / completedCount : 0

  const prevRevenue = toNum(prevFinancialAgg._sum.total)
  const prevSubtotal = toNum(prevFinancialAgg._sum.subtotal)
  const prevTax = toNum(prevFinancialAgg._sum.tax)
  const prevDiscount = toNum(prevFinancialAgg._sum.discount)
  const prevCount = prevFinancialAgg._count
  const prevAvgOrderValue = prevCount > 0 ? prevRevenue / prevCount : 0
  const prevTips = toNum(prevFinancialAgg._sum.tip)

  // === PODRAZDELITVE ===
  const paymentMethodsMap = computePaymentMethods(currentPaidOrders, totalTax, totalRevenue)
  const orderTypes = computeOrderTypes(orderTypeGroups)
  const { categoryBreakdown, itemBreakdown } = computeCategoryItemBreakdown(orderItems)
  const timeDistribution = computeTimeDistribution(period, refDate, completedOrdersLight, prevPaidOrdersLight)
  const { procurementCost, writeOffCost, cogs, grossProfit, grossMargin } = computeStockCosts(stockCostGroups, totalRevenue)
  const { totalTips, avgTipPerOrder, tipPercentage, tipsByEmployee } = await computeTips(currentPaidOrders, totalRevenue)
  const tableRevenue = computeTableRevenue(currentPaidOrders)
  const hourlyHeatmap = computeHourlyHeatmap(completedOrdersLight)
  const vatBreakdown = computeVatBreakdown(orderItems)
  const cashRegister = computeCashRegister(cashRegisterAgg, paymentMethodsMap)
  const bookingEntry = computeBookingEntry(periodLabel, period, totalSubtotal, totalTax, cashRegister.totalCashSales, cashRegister.totalCardSales, cashRegister.totalMobileSales)
  const periodComparison = computePeriodComparison(
    totalRevenue, totalSubtotal, totalTax, totalDiscount, totalTips, completedCount, avgOrderValue,
    prevRevenue, prevSubtotal, prevTax, prevDiscount, prevTips, prevCount, prevAvgOrderValue,
  )

  return {
    summary: buildFinancialSummary({
      totalRevenue, totalSubtotal, totalTax, totalDiscount,
      totalOrdersCount, completedCount, cancelledCount, avgOrderValue,
      prevRevenue,
      revenueChange: periodComparison.changes.revenue,
      orderChange: periodComparison.changes.orders,
    }),
    paymentMethods: Object.values(paymentMethodsMap), orderTypes,
    categoryBreakdown: Object.values(categoryBreakdown).sort((a, b) => b.revenue - a.revenue),
    itemBreakdown: Object.values(itemBreakdown).sort((a, b) => b.revenue - a.revenue),
    timeDistribution: Object.values(timeDistribution),
    costs: { procurementCost: round2(procurementCost), writeOffCost: round2(writeOffCost), cogs: round2(cogs), grossProfit: round2(grossProfit), grossMargin: round2(grossMargin) },
    totalTips: round2(totalTips), avgTipPerOrder: round2(avgTipPerOrder), tipPercentage: round2(tipPercentage),
    tipsByEmployee,
    tableRevenue,
    hourlyHeatmap, vatBreakdown,
    cashRegister,
    bookingEntry, periodComparison,
  }
}
