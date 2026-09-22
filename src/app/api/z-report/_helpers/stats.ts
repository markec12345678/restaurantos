// Pomožne funkcije za Z-report route — Tipi in izračun statistik

import { db } from '@/lib/db'
import { toNum, round2, multiply } from '@/lib/decimal'
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
  // FIX R110 (ZR-2): opcionalen tx klient — ko je podan, interni
  // cashRegisterShift.findMany teče ZNOTRAJ klicateljeve Serializable
  // transakcije (tx-fresh snapshot, prej vedno samostojen db read).
  client: Pick<typeof db, 'cashRegisterShift'> = db,
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
    // FIX (QA 2026-09-17, runda 10): Prisma Decimal v JSON/API kontekstu prihaja
    // kot STRING — "0" je TRUTHY, zato je `order.totalWithTip || order.total`
    // za naročila brez napitnika (totalWithTip = "0") vzel "0" in prispeval
    // 0 € v totalSales (zaznano: totalSales 71,07 € vs cashSales 593,02 €).
    // Numeric fallback: primerjaj ŠTEVILKI, ne primitivov.
    const orderGross = toNum(order.totalWithTip) || toNum(order.total)
    totalSales += orderGross
    totalNetSales += toNum(order.subtotal)
    totalTax += toNum(order.tax)
    totalDiscounts += toNum(order.discount)
    totalTips += toNum(order.tip)
    // FIX HIGH: totalGuests naj NE šteje voided artiklov
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    totalGuests += order.orderItems.filter((oi: any) => !oi.voided).reduce((sum: number, oi: any) => sum + oi.quantity, 0)

    // FIX HIGH: totalSales vsebuje tip, a tipBreakdown ne (isti numeric fallback kot zgoraj)
    if (order.type === 'dine-in') dineInSales += orderGross
    else if (order.type === 'takeout') takeoutSales += orderGross
    else if (order.type === 'delivery') deliverySales += orderGross

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
        // BUG-HUNT FIX 2026-09-19 (refund netting): neto znesek = amount −
        // refundAmount (isti vzorec kot netPaymentAmount pri zaprtju blagajniške
        // izmene) — sicer delni povračila napihnejo prodajo po načinih plačila.
        const netAmount = Math.max(0, toNum(payment.amount) - toNum(payment.refundAmount))
        switch (payment.type) {
          case 'cash': cashSales += netAmount; break
          case 'card': cardSales += netAmount; break
          case 'mobile': mobileSales += netAmount; break
          default: alternateSales += netAmount; break
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
  const cashShifts = await client.cashRegisterShift.findMany({
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
