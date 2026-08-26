// Pomožne funkcije za Z-report route — Gradnja podatkov poročila

import { round2, divide, subtract } from '@/lib/decimal'
import type { ZReportStats } from './stats'

// Zgradi podatke za Z-poročilo
export function buildReportData(
  stats: ZReportStats,
  dayStart: Date,
  dayEnd: Date,
  actualCash: number,
  notes: string,
  finalize: boolean,
  employeeId: string | undefined,
  locationId: string | undefined,
  cashShifts: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  const grossProfit = round2(stats.totalNetSales - stats.totalCost)
  const grossMargin = stats.totalNetSales > 0 ? round2(divide(grossProfit * 100, stats.totalNetSales)) : 0

  return {
    reportDate: dayStart,
    openedAt: cashShifts.length > 0 ? cashShifts[0].openedAt : dayStart,
    closedAt: cashShifts.length > 0 ? cashShifts[cashShifts.length - 1].closedAt : dayEnd,
    totalSales: stats.totalSales,
    totalNetSales: stats.totalNetSales,
    totalTax: stats.totalTax,
    cashSales: stats.cashSales,
    cardSales: stats.cardSales,
    mobileSales: stats.mobileSales,
    alternateSales: stats.alternateSales,
    dineInSales: stats.dineInSales,
    takeoutSales: stats.takeoutSales,
    deliverySales: stats.deliverySales,
    vatStandard: stats.vatStandard,
    vatStandardAmount: stats.vatStandardAmount,
    vatReduced: stats.vatReduced,
    vatReducedAmount: stats.vatReducedAmount,
    vatZero: stats.vatZero,
    totalOrders: 0, // will be set by caller
    totalGuests: stats.totalGuests,
    avgOrderValue: 0, // will be set by caller
    totalDiscounts: stats.totalDiscounts,
    totalTips: stats.totalTips,
    totalVoided: stats.totalVoided,
    totalStorno: stats.totalStorno,
    startingCash: stats.startingCash,
    expectedCash: stats.expectedCash,
    actualCash,
    cashDifference: round2(subtract(actualCash, stats.expectedCash)),
    cashDrops: 0,
    totalCost: stats.totalCost,
    grossProfit,
    grossMargin,
    status: finalize ? 'finalized' : 'draft',
    finalizedBy: finalize ? (employeeId || '') : '',
    notes,
    locationId: locationId || null,
  }
}
