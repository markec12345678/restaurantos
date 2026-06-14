// Pomožne funkcije za finančno poročanje — izračuni in transformacije
// GET /api/reports/financial — pomožni modul za izračune

import { db } from '@/lib/db'
import { toNum, round2, abs, type DecimalLike } from '@/lib/decimal'

// ─── Normalizacija plačilne metode ───
const normalizeMethod = (m: string): string => {
  const map: Record<string, string> = { cash: 'gotovina', card: 'kartica', mobile: 'mobilno', voucher: 'bon', loyalty: 'zvestoba', giftcard: 'darilna kartica', alternate: 'alternativno', valuto: 'kartica' }
  return map[m] || m || 'gotovina'
}

// ─── Časovna porazdelitev ───
interface TimeDistOrder { paidAt: Date | null; createdAt: Date; total: DecimalLike }
export function computeTimeDistribution(
  period: string, refDate: Date,
  completedOrdersLight: TimeDistOrder[], prevPaidOrdersLight: TimeDistOrder[]
) {
  const timeDistribution: Record<string, { period: string; revenue: number; orders: number; prevRevenue: number; prevOrders: number }> = {}

  if (period === 'daily') {
    for (let h = 0; h < 24; h++) {
      timeDistribution[String(h).padStart(2, '0')] = {
        period: `${String(h).padStart(2, '0')}:00`,
        revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0,
      }
    }
    for (const order of completedOrdersLight) {
      const hour = new Date(order.paidAt || order.createdAt).getHours()
      const key = String(hour).padStart(2, '0')
      if (timeDistribution[key]) { timeDistribution[key].revenue += toNum(order.total); timeDistribution[key].orders += 1 }
    }
    for (const order of prevPaidOrdersLight) {
      const hour = new Date(order.paidAt || order.createdAt).getHours()
      const key = String(hour).padStart(2, '0')
      if (timeDistribution[key]) { timeDistribution[key].prevRevenue += toNum(order.total); timeDistribution[key].prevOrders += 1 }
    }
  } else if (period === 'weekly') {
    const dayNames = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']
    for (const d of dayNames) { timeDistribution[d] = { period: d, revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 } }
    for (const order of completedOrdersLight) {
      const dayIdx = (new Date(order.paidAt || order.createdAt).getDay() + 6) % 7
      const key = dayNames[dayIdx]
      if (timeDistribution[key]) { timeDistribution[key].revenue += toNum(order.total); timeDistribution[key].orders += 1 }
    }
    for (const order of prevPaidOrdersLight) {
      const dayIdx = (new Date(order.paidAt || order.createdAt).getDay() + 6) % 7
      const key = dayNames[dayIdx]
      if (timeDistribution[key]) { timeDistribution[key].prevRevenue += toNum(order.total); timeDistribution[key].prevOrders += 1 }
    }
  } else if (period === 'monthly') {
    const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const key = String(d).padStart(2, '0')
      timeDistribution[key] = { period: String(d), revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 }
    }
    for (const order of completedOrdersLight) {
      const day = new Date(order.paidAt || order.createdAt).getDate()
      const key = String(day).padStart(2, '0')
      if (timeDistribution[key]) { timeDistribution[key].revenue += toNum(order.total); timeDistribution[key].orders += 1 }
    }
    for (const order of prevPaidOrdersLight) {
      const day = new Date(order.paidAt || order.createdAt).getDate()
      const key = String(day).padStart(2, '0')
      if (timeDistribution[key]) { timeDistribution[key].prevRevenue += toNum(order.total); timeDistribution[key].prevOrders += 1 }
    }
  } else {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec']
    for (const m of monthNames) { timeDistribution[m] = { period: m, revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 } }
    for (const order of completedOrdersLight) {
      const monthIdx = new Date(order.paidAt || order.createdAt).getMonth()
      const key = monthNames[monthIdx]
      if (timeDistribution[key]) { timeDistribution[key].revenue += toNum(order.total); timeDistribution[key].orders += 1 }
    }
    for (const order of prevPaidOrdersLight) {
      const monthIdx = new Date(order.paidAt || order.createdAt).getMonth()
      const key = monthNames[monthIdx]
      if (timeDistribution[key]) { timeDistribution[key].prevRevenue += toNum(order.total); timeDistribution[key].prevOrders += 1 }
    }
  }
  return timeDistribution
}

// ─── Tipi za plačana naročila ───
interface PaidOrder {
  type?: string; tableId?: string | null; employeeId?: string | null
  total: DecimalLike; tip: DecimalLike
  table?: { number: number; area: string } | null
  checks?: Array<{ payments?: Array<{ type: string; amount: DecimalLike; tipAmount: DecimalLike }> }>
}
interface OrderItemRow {
  menuItemId: string; price: DecimalLike; quantity: number; vatRate: DecimalLike; vatAmount: DecimalLike
  menuItem?: { name?: string; category?: { name?: string } | null } | null
}
interface FinancialAgg {
  _sum: { total: DecimalLike; subtotal: DecimalLike; tax: DecimalLike; discount: DecimalLike; tip: DecimalLike }
  _count: number
}
interface StockCostGroup { type: string; _sum: { totalCost: DecimalLike } }
interface CashRegisterAgg { _sum: { cashSales: DecimalLike; cardSales: DecimalLike; mobileSales: DecimalLike }; _count: number }
interface OrderTypeGroup { type?: string | null; _count: number; _sum: { total: DecimalLike } }

// ─── Izračunaj vse finančne metrike ───
export async function computeFinancialMetrics(
  data: {
    currentStatusGroups: Array<{ status: string; _count: number }>
    currentFinancialAgg: FinancialAgg
    currentPaidOrders: PaidOrder[]
    completedOrdersLight: TimeDistOrder[]
    prevFinancialAgg: FinancialAgg
    prevPaidOrdersLight: TimeDistOrder[]
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
  const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0
  const orderChange = prevCount > 0 ? ((completedCount - prevCount) / prevCount) * 100 : 0

  // === PLAČILNE METODE ===
  const paymentMethods: Record<string, { method: string; count: number; revenue: number; tax: number; tips: number }> = {}
  const allPayments = currentPaidOrders.flatMap(o => o.checks?.flatMap(c => c.payments || []) || [])
  for (const payment of allPayments) {
    const method = normalizeMethod(payment.type)
    if (!paymentMethods[method]) paymentMethods[method] = { method, count: 0, revenue: 0, tax: 0, tips: 0 }
    paymentMethods[method].count += 1
    paymentMethods[method].revenue += toNum(payment.amount)
    paymentMethods[method].tips += toNum(payment.tipAmount)
  }
  if (totalRevenue > 0) {
    const totalPaymentsAmount = allPayments.reduce((s, p) => s + toNum(p.amount), 0)
    for (const pm of Object.values(paymentMethods)) pm.tax = round2((pm.revenue / totalPaymentsAmount) * totalTax)
  }

  // === VRSTE NAROČIL ===
  const orderTypes = orderTypeGroups.map(g => ({
    type: g.type || 'dine-in', count: g._count, revenue: toNum(g._sum.total),
    avgValue: g._count > 0 ? round2(toNum(g._sum.total) / g._count) : 0,
  }))

  // === PO KATEGORIJAH z DDV razčlenitvijo ===
  const categoryBreakdown: Record<string, { category: string; revenue: number; quantity: number; items: number; vat22: number; vat95: number; vat0: number }> = {}
  for (const oi of orderItems) {
    const cat = oi.menuItem?.category?.name || 'Ostalo'
    if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { category: cat, revenue: 0, quantity: 0, items: 0, vat22: 0, vat95: 0, vat0: 0 }
    categoryBreakdown[cat].revenue += toNum(oi.price) * oi.quantity
    categoryBreakdown[cat].quantity += oi.quantity
    categoryBreakdown[cat].items += 1
    if (toNum(oi.vatRate) >= 20) categoryBreakdown[cat].vat22 += toNum(oi.price) * oi.quantity
    else if (toNum(oi.vatRate) > 0) categoryBreakdown[cat].vat95 += toNum(oi.price) * oi.quantity
    else categoryBreakdown[cat].vat0 += toNum(oi.price) * oi.quantity
  }

  // === PO ARTIKLIH (ZA IZPISKE) ===
  const itemBreakdown: Record<string, { name: string; category: string; quantity: number; revenue: number; avgPrice: number; vatRate: number }> = {}
  for (const oi of orderItems) {
    if (!itemBreakdown[oi.menuItemId]) {
      itemBreakdown[oi.menuItemId] = {
        name: oi.menuItem?.name || 'Neznan', category: oi.menuItem?.category?.name || 'Ostalo',
        quantity: 0, revenue: 0, avgPrice: toNum(oi.price), vatRate: toNum(oi.vatRate),
      }
    }
    itemBreakdown[oi.menuItemId].quantity += oi.quantity
    itemBreakdown[oi.menuItemId].revenue += toNum(oi.price) * oi.quantity
  }
  for (const item of Object.values(itemBreakdown)) { if (item.quantity > 0) item.avgPrice = item.revenue / item.quantity }

  // === ČASOVNA RAZDELITEV ===
  const timeDistribution = computeTimeDistribution(period, refDate, completedOrdersLight, prevPaidOrdersLight)

  // === STROŠKI ZALOG ===
  const stockCostByType = new Map(stockCostGroups.map(g => [g.type, g._sum.totalCost]))
  const procurementCost = toNum(stockCostByType.get('procurement') ?? 0)
  const writeOffCost = toNum(abs(stockCostByType.get('write-off') ?? 0)) + toNum(abs(stockCostByType.get('return') ?? 0))
  const cogs = toNum(abs(stockCostByType.get('sale') ?? 0))
  const grossProfit = totalRevenue - cogs
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

  // === NAPITNINE ===
  const totalTips = allPayments.reduce((sum, p) => sum + toNum(p.tipAmount), 0)
  const avgTipPerOrder = currentPaidOrders.length > 0 ? totalTips / currentPaidOrders.length : 0
  const tipPercentage = totalRevenue > 0 ? (totalTips / totalRevenue) * 100 : 0
  const tipsByEmployee: Record<string, { employeeId: string; employeeName: string; tips: number; orderCount: number; avgTip: number }> = {}
  for (const order of currentPaidOrders) {
    const empId = order.employeeId || 'unknown'
    if (!tipsByEmployee[empId]) tipsByEmployee[empId] = { employeeId: empId, employeeName: '', tips: 0, orderCount: 0, avgTip: 0 }
    const orderTips = (order.checks || []).flatMap(c => c.payments || []).reduce((sum, p) => sum + toNum(p.tipAmount), 0)
    tipsByEmployee[empId].tips += orderTips
    tipsByEmployee[empId].orderCount += 1
  }
  // Pridobi imena zaposlenih
  const empIds = Object.keys(tipsByEmployee).filter(id => id !== 'unknown')
  if (empIds.length > 0) {
    const employees = await db.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, name: true } })
    for (const emp of employees) { if (tipsByEmployee[emp.id]) tipsByEmployee[emp.id].employeeName = emp.name }
  }
  if (tipsByEmployee['unknown']) tipsByEmployee['unknown'].employeeName = 'Nedoločen'
  for (const t of Object.values(tipsByEmployee)) { t.avgTip = t.orderCount > 0 ? round2(t.tips / t.orderCount) : 0; t.tips = round2(t.tips) }

  // === PRIHODEK PO MIZAH ===
  const tableRevenue: Record<string, { tableNumber: number; area: string; revenue: number; orderCount: number; avgOrder: number; tips: number; guests: number }> = {}
  for (const order of currentPaidOrders) {
    if (order.type === 'dine-in' && order.tableId) {
      if (!tableRevenue[order.tableId]) {
        tableRevenue[order.tableId] = { tableNumber: order.table?.number || 0, area: order.table?.area || 'main', revenue: 0, orderCount: 0, avgOrder: 0, tips: 0, guests: 0 }
      }
      tableRevenue[order.tableId].revenue += toNum(order.total)
      tableRevenue[order.tableId].orderCount += 1
      tableRevenue[order.tableId].tips += toNum(order.tip)
    }
  }
  for (const t of Object.values(tableRevenue)) { t.avgOrder = t.orderCount > 0 ? round2(t.revenue / t.orderCount) : 0; t.revenue = round2(t.revenue); t.tips = round2(t.tips) }

  // === URNA TOPLOTNA KARTA ===
  const hourlyHeatmap: Array<{ hour: number; label: string; revenue: number; orders: number; intensity: number }> = []
  let maxHourlyRevenue = 0
  const hourlyBuckets: Record<number, { revenue: number; orders: number }> = {}
  for (let h = 0; h < 24; h++) { hourlyBuckets[h] = { revenue: 0, orders: 0 } }
  for (const order of completedOrdersLight) {
    const hour = new Date(order.paidAt || order.createdAt).getHours()
    hourlyBuckets[hour].revenue += toNum(order.total)
    hourlyBuckets[hour].orders += 1
    if (hourlyBuckets[hour].revenue > maxHourlyRevenue) maxHourlyRevenue = hourlyBuckets[hour].revenue
  }
  for (let h = 0; h < 24; h++) {
    const label = h < 6 ? 'Noč' : h < 10 ? 'Jutro' : h < 14 ? 'Kosilo' : h < 17 ? 'Popoldne' : h < 21 ? 'Večerja' : 'Po večerji'
    hourlyHeatmap.push({ hour: h, label, revenue: round2(hourlyBuckets[h].revenue), orders: hourlyBuckets[h].orders, intensity: maxHourlyRevenue > 0 ? Math.round((hourlyBuckets[h].revenue / maxHourlyRevenue) * 100) : 0 })
  }

  // === DDV RAZČLENITEV ===
  const vatBreakdown: Record<string, { rate: number; label: string; code: string; baseAmount: number; vatAmount: number; totalAmount: number }> = {}
  for (const oi of orderItems) {
    const rateKey = String(oi.vatRate)
    if (!vatBreakdown[rateKey]) {
      vatBreakdown[rateKey] = {
        rate: toNum(oi.vatRate),
        label: toNum(oi.vatRate) >= 20 ? 'DDV 22% (Standardna)' : toNum(oi.vatRate) > 0 ? 'DDV 9.5% (Znižana)' : 'DDV 0% (Oproščeno)',
        code: toNum(oi.vatRate) >= 20 ? 'S' : toNum(oi.vatRate) > 0 ? 'R' : 'Z',
        baseAmount: 0, vatAmount: 0, totalAmount: 0,
      }
    }
    const base = toNum(oi.price) * oi.quantity; const vat = toNum(oi.vatAmount)
    vatBreakdown[rateKey].baseAmount += base; vatBreakdown[rateKey].vatAmount += vat; vatBreakdown[rateKey].totalAmount += base + vat
  }
  for (const vr of Object.values(vatBreakdown)) { vr.baseAmount = round2(vr.baseAmount); vr.vatAmount = round2(vr.vatAmount); vr.totalAmount = round2(vr.totalAmount) }

  // === BLAGAJNA IZPISKI ===
  const totalCashSales = toNum(cashRegisterAgg._sum.cashSales)
  const totalCardSales = toNum(cashRegisterAgg._sum.cardSales)
  const totalMobileSales = toNum(cashRegisterAgg._sum.mobileSales)
  const effectiveCashSales = totalCashSales > 0 ? totalCashSales : toNum(paymentMethods['gotovina']?.revenue || 0)
  const effectiveCardSales = totalCardSales > 0 ? totalCardSales : toNum(paymentMethods['kartica']?.revenue || 0)
  const effectiveMobileSales = totalMobileSales > 0 ? totalMobileSales : toNum(paymentMethods['mobilno']?.revenue || 0)

  // === SESTAVEK IZPISKA ZA KNJIŽENJE ===
  const bookingEntry = {
    date: periodLabel, period,
    debit: { '1140 - Potrošniki - Gotovina': round2(effectiveCashSales), '1140 - Potrošniki - Kartice': round2(effectiveCardSales), '1140 - Potrošniki - Mobilno': round2(effectiveMobileSales) },
    credit: { '7600 - Prihodki od prodaje jedi in pijač': round2(totalSubtotal), '2530 - DDV obveznosti': round2(totalTax) },
    totalDebit: round2(effectiveCashSales + effectiveCardSales + effectiveMobileSales), totalCredit: round2(totalSubtotal + totalTax),
  }

  // === PRIMERJAVA OBDOBIJ ===
  const periodComparison = {
    current: { revenue: round2(totalRevenue), subtotal: round2(totalSubtotal), tax: round2(totalTax), discount: round2(totalDiscount), tips: round2(totalTips), orders: completedCount, avgOrderValue: round2(avgOrderValue) },
    previous: { revenue: round2(prevRevenue), subtotal: round2(prevSubtotal), tax: round2(prevTax), discount: round2(prevDiscount), tips: round2(prevTips), orders: prevCount, avgOrderValue: round2(prevAvgOrderValue) },
    changes: {
      revenue: round2(revenueChange), orders: round2(orderChange),
      avgOrderValue: prevAvgOrderValue > 0 ? round2(((avgOrderValue - prevAvgOrderValue) / prevAvgOrderValue) * 100) : 0,
      tips: prevTips > 0 ? round2(((totalTips - prevTips) / prevTips) * 100) : 0,
    },
  }

  return {
    summary: { totalRevenue: round2(totalRevenue), totalSubtotal: round2(totalSubtotal), totalTax: round2(totalTax), totalDiscount: round2(totalDiscount), totalOrdersCount, completedCount, cancelledCount, avgOrderValue: round2(avgOrderValue), prevRevenue: round2(prevRevenue), revenueChange: round2(revenueChange), orderChange: round2(orderChange) },
    paymentMethods: Object.values(paymentMethods), orderTypes,
    categoryBreakdown: Object.values(categoryBreakdown).sort((a, b) => b.revenue - a.revenue),
    itemBreakdown: Object.values(itemBreakdown).sort((a, b) => b.revenue - a.revenue),
    timeDistribution: Object.values(timeDistribution),
    costs: { procurementCost: round2(procurementCost), cogs: round2(cogs), writeOffCost: round2(writeOffCost), grossProfit: round2(grossProfit), grossMargin: round2(grossMargin) },
    totalTips: round2(totalTips), avgTipPerOrder: round2(avgTipPerOrder), tipPercentage: round2(tipPercentage),
    tipsByEmployee: Object.values(tipsByEmployee).sort((a, b) => b.tips - a.tips),
    tableRevenue: Object.values(tableRevenue).sort((a, b) => b.revenue - a.revenue),
    hourlyHeatmap, vatBreakdown: Object.values(vatBreakdown).sort((a, b) => b.rate - a.rate),
    cashRegister: { totalCashSales: round2(effectiveCashSales), totalCardSales: round2(effectiveCardSales), totalMobileSales: round2(effectiveMobileSales), shiftCount: cashRegisterAgg._count },
    bookingEntry, periodComparison,
  }
}
