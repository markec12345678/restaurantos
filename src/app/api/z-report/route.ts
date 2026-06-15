// ============================================
// Z-REPORT API — Dnevni zaključek (End of Day)
// Toast POS + Square standard
// Avtomatsko generiranje Z-poročila iz podatkov
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { round2, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, handleRouteError, validateRequest } from '@/lib/api-utils'
import { calculateReportStats, buildReportData } from './_helpers'

const generateZReportSchema = z.object({
  date: z.string().min(1, 'Datum je obvezen').max(30, 'Neveljaven format datuma'),
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
    const existing = await db.zReport.findFirst({
      where: { reportDate: dayStart, ...(locationId ? { locationId } : {}) },
    })
    if (existing && existing.status === 'finalized') {
      return NextResponse.json({ error: 'Z-poročilo za ta dan je že zaključeno' }, { status: 400 })
    }

    // FIX BUG-19 MEDIUM: Preveri, da so vse izmene zaprte
    if (finalize) {
      const openShifts = await db.cashRegisterShift.count({
        where: {
          openedAt: { gte: dayStart, lt: dayEnd },
          status: 'open',
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

    const paidOrders = orders

    // Izračunaj statistike
    const stats = await calculateReportStats(paidOrders, orders, dayStart, dayEnd, locationId)

    // Pridobi cash shifts za buildReportData
    const cashShifts = await db.cashRegisterShift.findMany({
      where: {
        openedAt: { gte: dayStart, lt: dayEnd },
        status: 'closed',
        ...(locationId ? { locationId } : {}),
      },
    })

    const reportData = buildReportData(
      stats, dayStart, dayEnd, actualCash, notes, finalize,
      authResult.session?.employeeId, locationId, cashShifts,
    )
    reportData.totalOrders = paidOrders.length
    reportData.avgOrderValue = paidOrders.length > 0 ? round2(reportData.totalSales / paidOrders.length) : 0

    // FIX BUG-5 MEDIUM: Upsert znotraj transakcije
    const report = await db.$transaction(async (tx) => {
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
      details: { date: d.toLocaleDateString('sl-SI'), totalSales: stats.totalSales, message: `Z-poročilo za ${d.toLocaleDateString('sl-SI')}: €${round2(stats.totalSales)}` },
      userId: authResult.session?.employeeId,
    })

    return NextResponse.json(deepToNumbers(report), { status: report.createdAt ? 200 : 201 })
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/z-report', [
      { match: 'Z_REPORT_FINALIZED', message: 'Z-poročilo za ta dan je že zaključeno', status: 400 },
    ], 'Napaka pri generiranju Z-poročila')
  }
}
