// Pomožne funkcije za zaključek obratovalnega dneva (ZOD)
// GET/POST /api/reports/eod — pomožni modul za poizvedbe in izračune

import { db } from '@/lib/db'
import { toNum, round2, abs, deepToNumbers, type DecimalLike } from '@/lib/decimal'

// ─── Poizvedbe za ZOD poročilo (vzporedne) ───
export async function fetchEodData(dayStart: Date, dayEnd: Date, locationId: string | null) {
  // FIX EOD-1 HIGH: Dodaj locationId filter — brez tega se prikažejo naročila iz VSEH lokacij
  const paidOrderWhere = {
    paidAt: { gte: dayStart, lte: dayEnd },
    paymentStatus: 'paid' as const,
    ...(locationId ? { locationId } : {}),
  }
  const statusOrderWhere = {
    createdAt: { gte: dayStart, lte: dayEnd },
  }

  // FIX EOD-1 HIGH: Dodaj locationId filter za blagajno
  const shiftWhere: Record<string, unknown> = { status: 'open' }
  if (locationId) shiftWhere.locationId = locationId

  const [
    statusCounts,
    revenueAgg,
    cancelledAgg,
    pendingCount,
    vatGroups,
    paymentGroups,
    categoryItemGroups,
    employeeGroups,
    hourlyOrders,
    stockCostGroups,
    activeShift,
    voidedItemsData,
  ] = await Promise.all([
    // 1. Status counts — groupBy po statusu
    db.order.groupBy({ by: ['status'], where: statusOrderWhere, _count: true }),
    // 2. Za finančne podatke uporabimo paidAt
    db.order.aggregate({ where: paidOrderWhere, _sum: { total: true, subtotal: true, tax: true, discount: true, tip: true, totalWithTip: true }, _count: true }),
    // 3. Preklicana naročila
    db.order.aggregate({ where: { ...statusOrderWhere, status: 'cancelled' }, _sum: { total: true }, _count: true }),
    // 4. Odprta naročila
    db.order.count({ where: { ...statusOrderWhere, status: { in: ['pending', 'in-progress', 'ready'] } } }),
    // 5. DDV RAZČLENITEV — groupBy po vatRate
    db.orderItem.groupBy({ by: ['vatRate'], where: { voided: false, order: paidOrderWhere }, _sum: { vatAmount: true } }),
    // 6. PLAČILNE METODE — groupBy po type
    db.payment.groupBy({ by: ['type'], where: { check: { order: paidOrderWhere } }, _sum: { amount: true, tipAmount: true }, _count: true }),
    // 7. PO KATEGORIJAH
    db.orderItem.groupBy({ by: ['menuItemId', 'price'], where: { voided: false, order: paidOrderWhere }, _sum: { quantity: true } }),
    // 8. PO ZAPOSLENIH
    db.order.groupBy({ by: ['employeeId'], where: paidOrderWhere, _sum: { total: true, tip: true }, _count: true }),
    // 9. PO URAH
    db.order.findMany({ where: paidOrderWhere, select: { paidAt: true, createdAt: true, total: true } }),
    // 10. STROŠKI
    db.stockTransaction.groupBy({ by: ['type'], where: { createdAt: { gte: dayStart, lte: dayEnd } }, _sum: { totalCost: true } }),
    // 11. BLAGAJNA
    db.cashRegisterShift.findFirst({ where: shiftWhere, orderBy: { openedAt: 'desc' } }),
    // 12. VOIDANI ARTIKLI
    db.orderItem.findMany({
      where: { voided: true, order: statusOrderWhere },
      select: { menuItem: { select: { name: true } }, quantity: true, price: true },
    }),
  ])

  return {
    statusCounts, revenueAgg, cancelledAgg, pendingCount, vatGroups,
    paymentGroups, categoryItemGroups, employeeGroups, hourlyOrders,
    stockCostGroups, activeShift, voidedItemsData,
  }
}

// ─── Tipi za EOD metrike ───
interface VatGroup { vatRate: DecimalLike; _sum: { vatAmount: DecimalLike } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PaymentGroup { type: string; _count: any; _sum: { amount: DecimalLike; tipAmount: DecimalLike } }
interface CategoryItemGroup { menuItemId: string; price: DecimalLike; _sum: { quantity: number | null } }
interface EmployeeGroup { employeeId: string | null; _count: number; _sum: { total: DecimalLike; tip: DecimalLike } }
interface HourlyOrder { paidAt: Date | null; createdAt: Date; total: DecimalLike }
interface StockCostGroup { type: string; _sum: { totalCost: DecimalLike } }
interface VoidedItem { menuItem: { name: string }; quantity: number; price: DecimalLike }

// ─── Izračunaj ZOD metrike ───
export function computeEodMetrics(raw: {
  statusCounts: Array<{ status: string; _count: number }>
  revenueAgg: { _sum: { total: DecimalLike; subtotal: DecimalLike; tax: DecimalLike; discount: DecimalLike; tip: DecimalLike; totalWithTip: DecimalLike }; _count: number }
  cancelledAgg: { _sum: { total: DecimalLike }; _count: number }
  pendingCount: number
  vatGroups: VatGroup[]
  paymentGroups: PaymentGroup[]
  categoryItemGroups: CategoryItemGroup[]
  employeeGroups: EmployeeGroup[]
  hourlyOrders: HourlyOrder[]
  stockCostGroups: StockCostGroup[]
  activeShift: unknown
  voidedItemsData: VoidedItem[]
}) {
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

  // ─── PO KATEGORIJAH (asinhrono — vrne podatke za sekundarno poizvedbo) ───
  const categoryData = { categoryItemGroups }
  const menuItemIds: string[] = [...new Set(categoryItemGroups.map(g => g.menuItemId))]

  // Note: categoryBreakdown se izračuna v computeCategoryBreakdown() s sekundarno poizvedbo

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

// ─── Izračunaj kategorije s sekundarno poizvedbo ───
export async function computeCategoryBreakdown(
  categoryItemGroups: CategoryItemGroup[],
  menuItemIds: string[]
) {
  const categoryBreakdown: Record<string, { category: string; quantity: number; revenue: number; menu: string }> = {}
  if (menuItemIds.length > 0) {
    const menuItemsWithCategories = await db.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, category: { select: { name: true, menu: { select: { name: true } } } } },
    })
    const menuItemMap = new Map(menuItemsWithCategories.map(m => [m.id, m]))
    for (const g of categoryItemGroups) {
      const catInfo = menuItemMap.get(g.menuItemId)
      const cat = catInfo?.category?.name || 'Ostalo'
      const menu = catInfo?.category?.menu?.name || ''
      const key = `${menu}::${cat}`
      const revenue = toNum(g.price) * (g._sum.quantity || 0)
      if (!categoryBreakdown[key]) categoryBreakdown[key] = { category: cat, quantity: 0, revenue: 0, menu }
      categoryBreakdown[key].quantity += g._sum.quantity || 0
      categoryBreakdown[key].revenue += revenue
    }
  }
  return Object.values(categoryBreakdown).sort((a, b) => b.revenue - a.revenue)
}

// ─── Izračunaj imena zaposlenih ───
export async function enrichEmployeeNames(
  employeeBreakdown: Record<string, { employeeId: string; orderCount: number; revenue: number; tips: number; employeeName?: string }>,
  empIds: string[]
) {
  if (empIds.length > 0) {
    const employees = await db.employee.findMany({
      where: { id: { in: empIds } }, select: { id: true, name: true },
    })
    for (const emp of employees) {
      if (employeeBreakdown[emp.id]) {
        (employeeBreakdown[emp.id] as Record<string, unknown>).employeeName = emp.name
      }
    }
  }
  return Object.values(employeeBreakdown).sort((a, b) => b.revenue - a.revenue)
}
