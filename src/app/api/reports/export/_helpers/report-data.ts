// ============================================
// SKUPNI DATA FETCHER za izvoz poročil
// Vrne strukturirane podatke, ki jih potem PDF/Excel/XML/CSV generatorji formatirajo
// ============================================

import { db } from '@/lib/db'
import { toNum, multiply, round2 } from '@/lib/decimal'

export interface OrderRow {
  orderNumber: number
  date: string
  type: string
  tableNumber: number | string
  customerName: string
  status: string
  paymentStatus: string
  paymentMethod: string
  subtotal: number
  tax: number
  discount: number
  total: number
  tip: number
  totalWithTip: number
  items: string
}

export interface VatBreakdownRow {
  rate: number
  code: string
  label: string
  baseAmount: number
  vatAmount: number
  totalAmount: number
}

export interface ReportData {
  orders: OrderRow[]
  vatBreakdown: VatBreakdownRow[]
  summary: {
    totalRevenue: number
    totalTax: number
    totalDiscount: number
    totalTip: number
    totalOrders: number
    paymentMethodBreakdown: Record<string, number>
  }
  startDate: string | null
  endDate: string | null
  generatedAt: string
}

/** Pridobi vse plačane naročila v datumskem obsegu */
export async function fetchReportData(dateFilter: Record<string, Date>): Promise<ReportData> {
  const orders = await db.order.findMany({
    where: {
      paymentStatus: 'paid',
      ...(Object.keys(dateFilter).length > 0 ? { paidAt: dateFilter } : {}),
    },
    include: {
      table: true,
      orderItems: { include: { menuItem: true } },
    },
    orderBy: { paidAt: 'desc' },
  })

  const orderRows: OrderRow[] = orders.map(o => ({
    orderNumber: o.orderNumber,
    date: new Date(o.createdAt).toLocaleString('sl-SI'),
    type: o.type,
    tableNumber: o.table?.number || '',
    customerName: o.customerName || '',
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    subtotal: toNum(o.subtotal),
    tax: toNum(o.tax),
    discount: toNum(o.discount),
    total: toNum(o.total),
    tip: toNum(o.tip),
    totalWithTip: toNum(o.totalWithTip),
    items: o.orderItems.map(oi => `${oi.quantity}x ${oi.menuItem?.name || '?'}`).join(', '),
  }))

  // DDV razčlenitev po stopnjah
  const vatMap: Record<string, { rate: number; code: string; base: number; vat: number }> = {}
  for (const o of orders) {
    for (const oi of o.orderItems) {
      if (oi.voided) continue
      const rate = toNum(oi.vatRate)
      const code = rate >= 22 ? 'S' : rate > 0 ? 'R' : 'Z'
      const key = `${rate}_${code}`
      if (!vatMap[key]) vatMap[key] = { rate, code, base: 0, vat: 0 }
      const lineTotal = toNum(multiply(oi.price, oi.quantity))
      vatMap[key].base += round2(lineTotal / (1 + rate / 100))
      vatMap[key].vat += toNum(oi.vatAmount)
    }
  }

  const vatBreakdown: VatBreakdownRow[] = Object.values(vatMap).map(v => ({
    rate: v.rate,
    code: v.code,
    label: v.rate >= 22 ? `DDV ${v.rate}% (Standard)` : v.rate > 0 ? `DDV ${v.rate}% (Znižana)` : `DDV 0% (Oproščeno)`,
    baseAmount: round2(v.base),
    vatAmount: round2(v.vat),
    totalAmount: round2(v.base + v.vat),
  }))

  const paymentMethodBreakdown: Record<string, number> = {}
  let totalRevenue = 0, totalTax = 0, totalDiscount = 0, totalTip = 0
  for (const o of orders) {
    totalRevenue += toNum(o.total)
    totalTax += toNum(o.tax)
    totalDiscount += toNum(o.discount)
    totalTip += toNum(o.tip)
    const pm = o.paymentMethod || 'unknown'
    paymentMethodBreakdown[pm] = (paymentMethodBreakdown[pm] || 0) + toNum(o.total)
  }

  return {
    orders: orderRows,
    vatBreakdown,
    summary: {
      totalRevenue: round2(totalRevenue),
      totalTax: round2(totalTax),
      totalDiscount: round2(totalDiscount),
      totalTip: round2(totalTip),
      totalOrders: orders.length,
      paymentMethodBreakdown,
    },
    startDate: dateFilter.gte ? dateFilter.gte.toISOString().split('T')[0] : null,
    endDate: dateFilter.lte ? dateFilter.lte.toISOString().split('T')[0] : null,
    generatedAt: new Date().toISOString(),
  }
}
