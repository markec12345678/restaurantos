// Pomožne funkcije za finančno poročanje — Tipi in normalizacija

import type { DecimalLike } from '@/lib/decimal'

// ─── Normalizacija plačilne metode ───
export const normalizeMethod = (m: string): string => {
  const map: Record<string, string> = { cash: 'gotovina', card: 'kartica', mobile: 'mobilno', voucher: 'bon', loyalty: 'zvestoba', giftcard: 'darilna kartica', alternate: 'alternativno', valuto: 'kartica' }
  return map[m] || m || 'gotovina'
}

// ─── Časovna porazdelitev ───
export interface TimeDistOrder { paidAt: Date | null; createdAt: Date; total: DecimalLike }

// ─── Tipi za plačana naročila ───
export interface PaidOrder {
  type?: string; tableId?: string | null; employeeId?: string | null
  total: DecimalLike; tip: DecimalLike
  table?: { number: number; area: string } | null
  checks?: Array<{ payments?: Array<{ type: string; amount: DecimalLike; tipAmount: DecimalLike }> }>
}
export interface OrderItemRow {
  menuItemId: string; price: DecimalLike; quantity: number; vatRate: DecimalLike; vatAmount: DecimalLike
  menuItem?: { name?: string; category?: { name?: string } | null } | null
}
export interface FinancialAgg {
  _sum: { total: DecimalLike; subtotal: DecimalLike; tax: DecimalLike; discount: DecimalLike; tip: DecimalLike }
  _count: number
}
export interface StockCostGroup { type: string; _sum: { totalCost: DecimalLike } }
export interface CashRegisterAgg { _sum: { cashSales: DecimalLike; cardSales: DecimalLike; mobileSales: DecimalLike }; _count: number }
export interface OrderTypeGroup { type?: string | null; _count: number; _sum: { total: DecimalLike } }
