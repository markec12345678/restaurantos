// Poizvedbe za ZOD poročilo (vzporedne)

import { db } from '@/lib/db'
import type { DecimalLike } from '@/lib/decimal'

// ─── Tipi za EOD metrike ───
export interface VatGroup { vatRate: DecimalLike; _sum: { vatAmount: DecimalLike } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PaymentGroup { type: string; _count: any; _sum: { amount: DecimalLike; tipAmount: DecimalLike } }
export interface CategoryItemGroup { menuItemId: string; price: DecimalLike; _sum: { quantity: number | null } }
export interface EmployeeGroup { employeeId: string | null; _count: number; _sum: { total: DecimalLike; tip: DecimalLike } }
export interface HourlyOrder { paidAt: Date | null; createdAt: Date; total: DecimalLike }
export interface StockCostGroup { type: string; _sum: { totalCost: DecimalLike } }
export interface VoidedItem { menuItem: { name: string }; quantity: number; price: DecimalLike }

export interface EodRawData {
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
}

// ─── Poizvedbe za ZOD poročilo (vzporedne) ───
export async function fetchEodData(dayStart: Date, dayEnd: Date, locationId: string | null): Promise<EodRawData> {
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
