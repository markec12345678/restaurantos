// Pomožne funkcije za finančno poročanje — Gradnja povzetka

import { round2 } from '@/lib/decimal'

// ─── Zgradi povzetek finančnega poročila ───

export function buildFinancialSummary(opts: {
  totalRevenue: number
  totalSubtotal: number
  totalTax: number
  totalDiscount: number
  totalOrdersCount: number
  completedCount: number
  cancelledCount: number
  avgOrderValue: number
  prevRevenue: number
  revenueChange: number
  orderChange: number
}) {
  return {
    totalRevenue: round2(opts.totalRevenue),
    totalSubtotal: round2(opts.totalSubtotal),
    totalTax: round2(opts.totalTax),
    totalDiscount: round2(opts.totalDiscount),
    totalOrdersCount: opts.totalOrdersCount,
    completedCount: opts.completedCount,
    cancelledCount: opts.cancelledCount,
    avgOrderValue: round2(opts.avgOrderValue),
    prevRevenue: round2(opts.prevRevenue),
    revenueChange: round2(opts.revenueChange),
    orderChange: round2(opts.orderChange),
  }
}
