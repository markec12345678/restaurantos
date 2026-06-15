// Pomožne funkcije za Z-report route
// Izračun statistik in pomožni tipi

import { db } from '@/lib/db'
import { toNum, round2, multiply, divide, subtract } from '@/lib/decimal'
import { getCountryConfig, type CountryCode } from '@/lib/country-config'

// Tip za rezultat izračuna statistik
export interface ZReportStats {
  totalSales: number
  totalNetSales: number
  totalTax: number
  cashSales: number
  cardSales: number
  mobileSales: number
  alternateSales: number
  dineInSales: number
  takeoutSales: number
  deliverySales: number
  vatStandard: number
  vatStandardAmount: number
  vatReduced: number
  vatReducedAmount: number
  vatZero: number
  totalDiscounts: number
  totalTips: number
  totalVoided: number
  totalCost: number
  totalGuests: number
  totalStorno: number
  startingCash: number
  expectedCash: number
}

// Izračunaj vse statistike iz plačanih naročil
export async function calculateReportStats(
  paidOrders: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  allOrders: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  dayStart: Date,
  dayEnd: Date,
  locationId: string | undefined,
): Promise<ZReportStats> {
  let totalSales = 0
  let totalNetSales = 0
  let totalTax = 0
  let cashSales = 0
  let cardSales = 0
  let mobileSales = 0
  let alternateSales = 0
  let dineInSales = 0
  let takeoutSales = 0
  let deliverySales = 0
  let vatStandard = 0
  let vatStandardAmount = 0
  let vatReduced = 0
  let vatReducedAmount = 0
  let vatZero = 0
  let totalDiscounts = 0
  let totalTips = 0
  let totalVoided = 0
  let totalCost = 0
  let totalGuests = 0

  for (const order of paidOrders) {
    totalSales += toNum(order.totalWithTip || order.total)
    totalNetSales += toNum(order.subtotal)
    totalTax += toNum(order.tax)
    totalDiscounts += toNum(order.discount)
    totalTips += toNum(order.tip)
    // FIX HIGH: totalGuests naj NE šteje voided artiklov
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    totalGuests += order.orderItems.filter((oi: any) => !oi.voided).reduce((sum: number, oi: any) => sum + oi.quantity, 0)

    // FIX HIGH: totalSales vsebuje tip, a tipBreakdown ne
    if (order.type === 'dine-in') dineInSales += toNum(order.totalWithTip || order.total)
    else if (order.type === 'takeout') takeoutSales += toNum(order.totalWithTip || order.total)
    else if (order.type === 'delivery') deliverySales += toNum(order.totalWithTip || order.total)

    // DDV razčlenitev
    for (const oi of order.orderItems) {
      if (oi.voided) {
        totalVoided += toNum(multiply(oi.price, oi.quantity)) + toNum(oi.vatAmount)
        continue
      }
      const countryConfig = getCountryConfig((process.env.COUNTRY_CODE || 'SI') as CountryCode)
      const standardThreshold = countryConfig.taxRates.reduced + (countryConfig.taxRates.standard - countryConfig.taxRates.reduced) / 2
      if (toNum(oi.vatRate) >= standardThreshold) {
        vatStandard += round2(multiply(toNum(oi.price), oi.quantity))
        vatStandardAmount += toNum(oi.vatAmount)
      } else if (toNum(oi.vatRate) > 0) {
        vatReduced += round2(multiply(toNum(oi.price), oi.quantity))
        vatReducedAmount += toNum(oi.vatAmount)
      } else {
        vatZero += round2(multiply(toNum(oi.price), oi.quantity))
      }

      // Food cost — FIX BUG-14 MEDIUM: Uporabi recipeItems za dejanski strošek
      if (oi.menuItem) {
        if (oi.menuItem.recipeItems && oi.menuItem.recipeItems.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          totalCost += oi.menuItem.recipeItems.reduce((cost: number, ri: any) => {
            return cost + round2(multiply(multiply(toNum(ri.quantityPerServing), toNum(ri.inventoryItem?.costPerUnit ?? 0)), oi.quantity))
          }, 0)
        } else {
          totalCost += round2(multiply(multiply(toNum(oi.price), oi.quantity), 0.3)) // Fallback: 30%
        }
      }
    }

    // Po načinu plačila iz plačil
    for (const check of order.checks) {
      for (const payment of check.payments) {
        if (payment.status !== 'completed') continue
        switch (payment.type) {
          case 'cash': cashSales += toNum(payment.amount); break
          case 'card': cardSales += toNum(payment.amount); break
          case 'mobile': mobileSales += toNum(payment.amount); break
          default: alternateSales += toNum(payment.amount); break
        }
      }
    }
  }

  // Storno
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stornoOrders = allOrders.filter((o: any) =>
    o.cancelReason && o.cancelReason.length > 0 && o.paymentStatus === 'storno'
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalStorno = stornoOrders.reduce((sum: number, o: any) => sum + Math.abs(toNum(o.total)), 0)

  // Gotovina iz blagajne
  const cashShifts = await db.cashRegisterShift.findMany({
    where: {
      openedAt: { gte: dayStart, lt: dayEnd },
      status: 'closed',
      ...(locationId ? { locationId } : {}),
    },
  })
  const startingCash = cashShifts.reduce((sum, s) => sum + toNum(s.startingCash), 0)
  const expectedCash = cashShifts.reduce((sum, s) => sum + toNum(s.expectedCash), 0)

  return {
    totalSales, totalNetSales, totalTax,
    cashSales, cardSales, mobileSales, alternateSales,
    dineInSales, takeoutSales, deliverySales,
    vatStandard, vatStandardAmount, vatReduced, vatReducedAmount, vatZero,
    totalDiscounts, totalTips, totalVoided, totalCost, totalGuests,
    totalStorno, startingCash, expectedCash,
  }
}

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
