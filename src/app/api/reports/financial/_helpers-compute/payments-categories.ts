// Pomožne funkcije za finančno poročanje — Plačilne metode in kategorije

import { toNum, round2 } from '@/lib/decimal'
import { normalizeMethod } from './types'
import type { PaidOrder, OrderItemRow } from './types'

export function computePaymentMethods(
  currentPaidOrders: PaidOrder[],
  totalTax: number,
  totalRevenue: number,
): Record<string, { method: string; count: number; revenue: number; tax: number; tips: number }> {
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
  return paymentMethods
}

export function computeCategoryItemBreakdown(orderItems: OrderItemRow[]): {
  categoryBreakdown: Record<string, { category: string; revenue: number; quantity: number; items: number; vat22: number; vat95: number; vat0: number }>
  itemBreakdown: Record<string, { name: string; category: string; quantity: number; revenue: number; avgPrice: number; vatRate: number }>
} {
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

  return { categoryBreakdown, itemBreakdown }
}
