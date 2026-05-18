// ============================================
// Z-REPORT API — Dnevni zaključek (End of Day)
// Toast POS + Square standard
// Avtomatsko generiranje Z-poročila iz podatkov
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

const generateZReportSchema = z.object({
  date: z.string().min(1),           // ISO date string
  locationId: z.string().optional(),
  actualCash: z.number().min(0).default(0),
  notes: z.string().max(1000).default(''),
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

    return NextResponse.json(reports)
  } catch (error: any) {
    console.error('Z-Report GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju Z-poročil' }, { status: 500 })
  }
}

// POST — Generiraj Z-poročilo za dan
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const parsed = generateZReportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki', details: parsed.error.issues }, { status: 400 })
    }

    const { date, locationId, actualCash, notes, finalize } = parsed.data

    // Datumski obseg
    const d = new Date(date)
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86400000)

    // Preveri če že obstaja
    const existing = await db.zReport.findFirst({
      where: { reportDate: dayStart },
    })
    if (existing && existing.status === 'finalized') {
      return NextResponse.json({ error: 'Z-poročilo za ta dan je že zaključeno' }, { status: 400 })
    }

    // Pridobi vse plačane orderje za ta dan
    const orders = await db.order.findMany({
      where: {
        createdAt: { gte: dayStart, lt: dayEnd },
        status: { not: 'cancelled' },
        ...(locationId ? { locationId } : {}),
      },
      include: {
        checks: { include: { payments: true } },
        orderItems: { include: { menuItem: { include: { salesCategory: true } } } },
      },
    })

    const paidOrders = orders.filter(o => o.paymentStatus === 'paid' || o.paymentStatus === 'partial')

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
      totalSales += order.totalWithTip || order.total
      totalNetSales += order.subtotal
      totalTax += order.tax
      totalDiscounts += order.discount
      totalTips += order.tip
      totalGuests += order.orderItems.reduce((sum: number, oi) => sum + oi.quantity, 0)

      // Po vrsti naročila
      if (order.type === 'dine-in') dineInSales += order.total
      else if (order.type === 'takeout') takeoutSales += order.total
      else if (order.type === 'delivery') deliverySales += order.total

      // DDV razčlenitev
      for (const oi of order.orderItems) {
        if (oi.voided) {
          totalVoided += oi.price * oi.quantity + oi.vatAmount
          continue
        }
        if (oi.vatRate >= 20) {
          vatStandard += oi.price * oi.quantity
          vatStandardAmount += oi.vatAmount
        } else if (oi.vatRate > 0) {
          vatReduced += oi.price * oi.quantity
          vatReducedAmount += oi.vatAmount
        } else {
          vatZero += oi.price * oi.quantity
        }

        // Food cost
        if (oi.menuItem) {
          // Približek: strošek je 30% cene, razen če je recipe item
          totalCost += oi.price * oi.quantity * 0.3
        }
      }

      // Po načinu plačila iz plačil
      for (const check of order.checks) {
        for (const payment of check.payments) {
          if (payment.status !== 'completed') continue
          switch (payment.type) {
            case 'cash': cashSales += payment.amount; break
            case 'card': cardSales += payment.amount; break
            case 'mobile': mobileSales += payment.amount; break
            default: alternateSales += payment.amount; break
          }
        }
      }
    }

    // Storno
    const stornoOrders = orders.filter(o => o.cancelReason && o.cancelReason.length > 0)
    const totalStorno = stornoOrders.reduce((sum, o) => sum + o.total, 0)

    // Gotovina iz blagajne
    const cashShifts = await db.cashRegisterShift.findMany({
      where: {
        openedAt: { gte: dayStart, lt: dayEnd },
        status: 'closed',
        ...(locationId ? { locationId } : {}),
      },
    })
    const startingCash = cashShifts.reduce((sum, s) => sum + s.startingCash, 0)
    const expectedCash = cashShifts.reduce((sum, s) => sum + s.expectedCash, 0)

    const grossProfit = totalNetSales - totalCost
    const grossMargin = totalNetSales > 0 ? (grossProfit / totalNetSales) * 100 : 0

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
      avgOrderValue: paidOrders.length > 0 ? totalSales / paidOrders.length : 0,
      totalDiscounts,
      totalTips,
      totalVoided,
      totalStorno,
      startingCash,
      expectedCash,
      actualCash,
      cashDifference: actualCash - expectedCash,
      cashDrops: 0,
      totalCost,
      grossProfit,
      grossMargin,
      status: finalize ? 'finalized' : 'draft',
      finalizedBy: finalize ? (authResult as any).employee?.name || '' : '',
      notes,
      locationId: locationId || null,
    }

    // Upsert Z-poročilo
    const report = existing
      ? await db.zReport.update({ where: { id: existing.id }, data: reportData })
      : await db.zReport.create({ data: reportData })

    // Audit log
    await createAuditLog({
      action: finalize ? 'z_report_finalized' : 'z_report_generated',
      entityType: 'z_report',
      details: { date: d.toLocaleDateString('sl-SI'), totalSales, message: `Z-poročilo za ${d.toLocaleDateString('sl-SI')}: €${totalSales.toFixed(2)}` },
      userId: (authResult as any).employee?.id,
    })

    return NextResponse.json(report, { status: existing ? 200 : 201 })
  } catch (error: any) {
    console.error('Z-Report POST error:', error)
    return NextResponse.json({ error: 'Napaka pri generiranju Z-poročila' }, { status: 500 })
  }
}
