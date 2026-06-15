// Izračun ZOD metrik

import { toNum, round2, abs, deepToNumbers } from '@/lib/decimal'
import type { EodRawData } from './data-fetch'

export function computeEodMetrics(raw: EodRawData) {
  const {
    statusCounts, revenueAgg, cancelledAgg, pendingCount, vatGroups,
    paymentGroups, categoryItemGroups, employeeGroups, hourlyOrders,
    stockCostGroups, activeShift, voidedItemsData,
  } = raw

  // ─── OSNOVNE STATISTIKE ───
  const totalOrders = statusCounts.reduce((s, g) => s + g._count, 0)
  const completedOrders = revenueAgg._count
  const cancelledOrders = cancelledAgg._count
  const paidOrders = completedOrders

  // ─── PRIHODEK ───
  const totalRevenue = toNum(revenueAgg._sum.total)
  const totalSubtotal = toNum(revenueAgg._sum.subtotal)
  const totalTax = toNum(revenueAgg._sum.tax)
  const totalDiscount = toNum(revenueAgg._sum.discount)
  const totalTips = toNum(revenueAgg._sum.tip)
  const totalWithTips = toNum(revenueAgg._sum.totalWithTip)

  // ─── DDV RAZČLENITEV ───
  const vatBreakdown: Record<string, { base: number; vat: number; rate: number }> = {}
  for (const g of vatGroups) {
    const rate = toNum(g.vatRate)
    const vat = toNum(g._sum.vatAmount)
    const base = rate > 0 ? round2(vat * 100 / rate) : 0
    vatBreakdown[String(g.vatRate)] = { base, vat, rate }
  }

  // ─── PLAČILNE METODE ───
  const paymentMethods: Record<string, { count: number; revenue: number; tips: number }> = {}
  for (const g of paymentGroups) {
    paymentMethods[g.type] = { count: Number(g._count), revenue: toNum(g._sum.amount), tips: toNum(g._sum.tipAmount) }
  }

  // ─── PO KATEGORIJAH ───
  const categoryData = { categoryItemGroups }
  const menuItemIds: string[] = [...new Set(categoryItemGroups.map(g => g.menuItemId))]

  // ─── PO ZAPOSLENIH ───
  const employeeBreakdown: Record<string, { employeeId: string; orderCount: number; revenue: number; tips: number }> = {}
  const empIds: string[] = []
  for (const g of employeeGroups) {
    const empId = g.employeeId || 'unknown'
    employeeBreakdown[empId] = { employeeId: empId, orderCount: g._count, revenue: toNum(g._sum.total), tips: toNum(g._sum.tip) }
    if (empId !== 'unknown') empIds.push(empId)
  }

  // ─── PO URAH ───
  const localOffset = new Date().getTimezoneOffset()
  const hourlyMap: Record<number, { revenue: number; orders: number }> = {}
  for (const o of hourlyOrders) {
    const refDate = o.paidAt || o.createdAt
    const localDate = new Date(refDate.getTime() - localOffset * 60000)
    const h = localDate.getUTCHours()
    if (!hourlyMap[h]) hourlyMap[h] = { revenue: 0, orders: 0 }
    hourlyMap[h].revenue += toNum(o.total)
    hourlyMap[h].orders += 1
  }
  const hourlyBreakdown = Array.from({ length: 24 }, (_, h) => ({
    hour: h, revenue: hourlyMap[h]?.revenue || 0, orders: hourlyMap[h]?.orders || 0,
  }))

  // ─── STROŠKI ───
  const stockCostByType: Record<string, number> = {}
  for (const g of stockCostGroups) { stockCostByType[g.type] = toNum(g._sum.totalCost) }
  const procurementCost = stockCostByType['procurement'] || 0
  const writeOffCost = toNum(abs(stockCostByType['write-off'] || 0))
  const cogs = toNum(abs(stockCostByType['sale'] || 0))
  const grossProfit = totalRevenue - cogs - writeOffCost
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

  // ─── VOIDANI ARTIKLI ───
  const voidedItems = voidedItemsData.map(i => ({
    name: i.menuItem.name, quantity: i.quantity, price: toNum(i.price),
  }))

  // FIX EOD-2 MEDIUM: cancelledRevenue uporabi abs — storno naročila imajo negativen total
  const cancelledRevenue = toNum(abs(cancelledAgg._sum.total))

  return {
    summary: {
      totalOrders, completedOrders, cancelledOrders, pendingOrders: pendingCount,
      paidOrders, totalRevenue, totalSubtotal, totalTax, totalDiscount, totalTips, totalWithTips,
      avgOrderValue: completedOrders > 0 ? totalRevenue / completedOrders : 0,
      cancelledRevenue,
    },
    vatBreakdown: Object.values(vatBreakdown).sort((a: { rate: number }, b: { rate: number }) => b.rate - a.rate),
    paymentMethods: Object.entries(paymentMethods).map(([method, data]) => ({ method, ...data })),
    employeeBreakdown, empIds,
    hourlyBreakdown,
    costs: { procurementCost, writeOffCost, cogs, grossProfit, grossMargin },
    voidedItems,
    activeShift: deepToNumbers(activeShift),
    isDayClosed: !activeShift,
    categoryData, menuItemIds,
  }
}
