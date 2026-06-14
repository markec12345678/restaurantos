// ============================================
// Z-REPORT API — Dnevni zaključek (End of Day)
// Toast POS + Square standard
// Avtomatsko generiranje Z-poročila iz podatkov
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { toNum, round2, subtract, multiply, divide, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, handleRouteError, validateRequest } from '@/lib/api-utils'
import { getCountryConfig, type CountryCode } from '@/lib/country-config'
const generateZReportSchema = z.object({
  date: z.string().min(1, 'Datum je obvezen').max(30, 'Neveljaven format datuma'),           // ISO date string
  locationId: z.string().max(100, 'ID lokacije je predolg').optional(),
  actualCash: z.number().min(0, 'Znesek ne more biti negativen').max(9999999, 'Znesek je previsok').default(0),
  notes: z.string().max(1000, 'Opombe ne smejo preseči 1000 znakov').default(''),
  finalize: z.boolean().default(false),
})

// GET — Pridobi Z-poročila
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const status = searchParams.get('status')
    const locationId = searchParams.get('locationId')

    const where: Record<string, unknown> = {}
    if (date) {
      const d = new Date(date)
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const end = new Date(start.getTime() + 86400000)
      where.reportDate = { gte: start, lt: end }
    }
    if (status) where.status = status
    if (locationId) where.locationId = locationId

    const reports = await db.zReport.findMany({
      where,
      orderBy: { reportDate: 'desc' },
      take: 30,
    })

    return NextResponse.json(deepToNumbers(reports))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/z-report', 'Napaka pri pridobivanju Z-poročil')
  }
}

// POST — Generiraj Z-poročilo za dan
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, generateZReportSchema)
    if (validationError) return validationError

    const { date, locationId, actualCash, notes, finalize } = data

    // Datumski obseg
    const d = new Date(date)
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86400000)

    // Preveri če že obstaja
    // FIX CRITICAL: Dodaj locationId filter — brez tega Lokacija B ne more generirati Z-poročila
    // če ga ima že Lokacija A za isti dan
    const existing = await db.zReport.findFirst({
      where: { reportDate: dayStart, ...(locationId ? { locationId } : {}) },
    })
    if (existing && existing.status === 'finalized') {
      return NextResponse.json({ error: 'Z-poročilo za ta dan je že zaključeno' }, { status: 400 })
    }

    // FIX BUG-19 MEDIUM: Preveri, da so vse izmene zaprte preden se Z-report finalizira
    if (finalize) {
      const openShifts = await db.cashRegisterShift.count({
        where: {
          openedAt: { gte: dayStart, lt: dayEnd },
          status: 'open',
          // FIX BUG-4 HIGH: Dodaj locationId filter — brez tega odprta izmena na Lokaciji B
          // blokira finalizacijo Z-poročila za Lokacijo A
          ...(locationId ? { locationId } : {}),
        },
      })
      if (openShifts > 0) {
        return NextResponse.json({
          error: `Obstaja ${openShifts} odprtih blagajniških izmen. Zaprite vse izmene preden finalizirate Z-poročilo.`,
          openShifts,
        }, { status: 400 })
      }
    }

    // Pridobi vse plačane orderje za ta dan
    // FIX BUG-13 HIGH: Uporabi paidAt za finančna poročila, NE createdAt
    // Naročilo ustvarjeno ob 23:50 a plačano ob 00:10 sodi v DANES za finančna poročila
    const orders = await db.order.findMany({
      where: {
        paidAt: { gte: dayStart, lt: dayEnd },
        paymentStatus: { in: ['paid', 'partial'] },
        ...(locationId ? { locationId } : {}),
      },
      include: {
        checks: { include: { payments: true } },
        orderItems: { include: { menuItem: { include: { salesCategory: true, recipeItems: { include: { inventoryItem: { select: { costPerUnit: true } } } } } } } },
      },
    })

    const paidOrders = orders // Sedaj ko uporabljamo paidAt + paymentStatus filter, so vsa naročila že plačana

    // Izračunaj statistike
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
      // FIX HIGH: totalGuests naj NE šteje voided artiklov — prejšnja koda je povečala številko gostov
      totalGuests += order.orderItems.filter(oi => !oi.voided).reduce((sum: number, oi) => sum + oi.quantity, 0)

      // FIX HIGH: totalSales vsebuje tip, a tipBreakdown ne — konsistentno uporabi totalWithTip ali total
      if (order.type === 'dine-in') dineInSales += toNum(order.totalWithTip || order.total)
      else if (order.type === 'takeout') takeoutSales += toNum(order.totalWithTip || order.total)
      else if (order.type === 'delivery') deliverySales += toNum(order.totalWithTip || order.total)

      // DDV razčlenitev
      for (const oi of order.orderItems) {
        if (oi.voided) {
          totalVoided += toNum(multiply(oi.price, oi.quantity)) + toNum(oi.vatAmount)
          continue
        }
        // DDV klasifikacija po country config — pravilna prag za vsako državo
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

        // Food cost — FIX BUG-14 MEDIUM: Uporabi recipeItems za dejanski strošek, ne 30% približka
        // Če meni artikel ima recipeItems, izračunaj dejanski COGS; sicer uporabi 30% približek
        if (oi.menuItem) {
          if (oi.menuItem.recipeItems && oi.menuItem.recipeItems.length > 0) {
            totalCost += oi.menuItem.recipeItems.reduce((cost: number, ri) => {
              return cost + round2(multiply(multiply(toNum(ri.quantityPerServing), toNum(ri.inventoryItem?.costPerUnit ?? 0)), oi.quantity))
            }, 0)
          } else {
            totalCost += round2(multiply(multiply(toNum(oi.price), oi.quantity), 0.3)) // Fallback: 30% približek
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

    // Storno — FIX: Only include PAID orders that were cancelled (stornoed)
    // Unpaid cancelled orders were never fulfilled and don't represent actual returns
    const stornoOrders = orders.filter(o =>
      o.cancelReason && o.cancelReason.length > 0 && o.paymentStatus === 'storno'
    )
    const totalStorno = stornoOrders.reduce((sum, o) => sum + Math.abs(toNum(o.total)), 0)

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

    const grossProfit = round2(totalNetSales - totalCost)
    const grossMargin = totalNetSales > 0 ? round2(divide(grossProfit * 100, totalNetSales)) : 0

    const reportData = {
      reportDate: dayStart,
      openedAt: cashShifts.length > 0 ? cashShifts[0].openedAt : dayStart,
      closedAt: cashShifts.length > 0 ? cashShifts[cashShifts.length - 1].closedAt : dayEnd,
      totalSales,
      totalNetSales,
      totalTax,
      cashSales,
      cardSales,
      mobileSales,
      alternateSales,
      dineInSales,
      takeoutSales,
      deliverySales,
      vatStandard,
      vatStandardAmount,
      vatReduced,
      vatReducedAmount,
      vatZero,
      totalOrders: paidOrders.length,
      totalGuests,
      avgOrderValue: paidOrders.length > 0 ? round2(divide(totalSales, paidOrders.length)) : 0,
      totalDiscounts,
      totalTips,
      totalVoided,
      totalStorno,
      startingCash,
      expectedCash,
      actualCash,
      cashDifference: round2(subtract(actualCash, expectedCash)),
      cashDrops: 0,
      totalCost,
      grossProfit,
      grossMargin,
      status: finalize ? 'finalized' : 'draft',
      finalizedBy: finalize ? (authResult.session?.employeeId || '') : '',
      notes,
      locationId: locationId || null,
    }

    // FIX BUG-5 MEDIUM: Upsert znotraj transakcije — prepreči race condition
    // Prejšnja koda: findFirst + create/update izven transakcije — dve sočasni zahtevi
    // bi lahko obe ustvarili Z-poročilo za isti dan
    const report = await db.$transaction(async (tx) => {
      // Re-check inside transaction
      const txExisting = await tx.zReport.findFirst({
        where: { reportDate: dayStart, ...(locationId ? { locationId } : {}) },
      })

      if (txExisting && txExisting.status === 'finalized') {
        throw new Error('Z_REPORT_FINALIZED')
      }

      if (txExisting) {
        return tx.zReport.update({ where: { id: txExisting.id }, data: reportData })
      } else {
        return tx.zReport.create({ data: reportData })
      }
    })

    // Audit log
    await createAuditLog({
      action: finalize ? 'z_report_finalized' : 'z_report_generated',
      entityType: 'z_report',
      details: { date: d.toLocaleDateString('sl-SI'), totalSales, message: `Z-poročilo za ${d.toLocaleDateString('sl-SI')}: €${round2(totalSales)}` },
      userId: authResult.session?.employeeId,
    })

    return NextResponse.json(deepToNumbers(report), { status: report.createdAt ? 200 : 201 })
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/z-report', [
      { match: 'Z_REPORT_FINALIZED', message: 'Z-poročilo za ta dan je že zaključeno', status: 400 },
    ], 'Napaka pri generiranju Z-poročila')
  }
}
