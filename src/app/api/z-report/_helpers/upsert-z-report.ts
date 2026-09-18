// ============================================
// upsert-z-report.ts — skupna logika Z-poročila za dan
// ============================================
// FIX runda 9 (nova funkcionalnost): iz POST /api/z-report izluščena
// jedro (preverjanje, izračun statistik, upsert) v svojo pomožno funkcijo,
// da jo lahko PONOVNO uporabi tudi avtomatski osnutek ob zaprtju
// blagajniške izmene (PUT /api/cash-register/[id] → postShiftCloseActions).
//
// Error kode (klicatelj sam odloči, kako jih javi):
//   - 'Z_REPORT_FINALIZED' — poročilo za ta dan+lokacija je že zaključeno
//   - 'OPEN_SHIFTS:n'      — samo pri finalize=true: n odprtih izmen
//   - 'Z_REPORT_NO_LOCATION' — lokacije ni bilo mogoče resolvti (QA runda 36)

import { db } from '@/lib/db'
import { round2 } from '@/lib/decimal'
import { ljubljanaDayBounds } from '@/lib/timezone-sl'
import { resolveLocationId } from '@/lib/location-fallback'
import { calculateReportStats } from './stats'
import { buildReportData } from './build-report'

export interface UpsertZReportParams {
  /** 'YYYY-MM-DD' — Ljubljanski dan (glej ljubljanaDayBounds) */
  date: string
  /** Rezolvirana tenant lokacija (session ali shift.locationId) */
  locationId?: string
  actualCash?: number
  notes?: string
  employeeId?: string | null
  finalize?: boolean
}

export interface UpsertZReportResult {
  // Prisma ZReport — tukaj brez eksplicitnega tipa (izhaja iz db klicev)
  report: Awaited<ReturnType<typeof buildAndUpsert>>['report']
  stats: Awaited<ReturnType<typeof calculateReportStats>>
  paidOrdersCount: number
}

async function buildAndUpsert(params: UpsertZReportParams) {
  const { date, actualCash = 0, notes = '', employeeId, finalize = false } = params
  const { start: dayStart, end: dayEnd } = ljubljanaDayBounds(date)

  // FIX QA 2026-09-18 (runda 36 + refaktor runda 37): DB stolpec ZReport.locationId
  // je NOT NULL (schema drift). Resolucija zdaj v skupnem helperju (location-fallback):
  //   1. params.locationId → 2. employee.locationId → 3. prva lokacija (cached) →
  //   4. če še vedno nič: 'Z_REPORT_NO_LOCATION' (klicatelj preslika v 400).
  // Pokrije tudi avtomatski osnutek ob zaprtju blagajniške izmene (isti helper).
  const locationId = await resolveLocationId(params.locationId, employeeId)
  if (!locationId) {
    throw new Error('Z_REPORT_NO_LOCATION')
  }

  // Preveri, če že obstaja (hiter izhod ob že finaliziranem poročilu)
  const existing = await db.zReport.findFirst({
    where: { reportDate: dayStart, locationId },
  })
  if (existing && existing.status === 'finalized') {
    throw new Error('Z_REPORT_FINALIZED')
  }

  // Pri finalizaciji morajo biti vse izmene zaprte (FIX BUG-19)
  if (finalize) {
    const openShifts = await db.cashRegisterShift.count({
      where: {
        openedAt: { gte: dayStart, lt: dayEnd },
        status: 'open',
        locationId,
      },
    })
    if (openShifts > 0) {
      throw new Error(`OPEN_SHIFTS:${openShifts}`)
    }
  }

  // Vsa plačana naročila za ta dan (isti filter kot v POST /api/z-report)
  const orders = await db.order.findMany({
    where: {
      paidAt: { gte: dayStart, lt: dayEnd },
      paymentStatus: { in: ['paid', 'partial'] },
      locationId,
    },
    include: {
      checks: { include: { payments: true } },
      orderItems: { include: { menuItem: { include: { salesCategory: true, recipeItems: { include: { inventoryItem: { select: { costPerUnit: true } } } } } } } },
    },
  })
  const paidOrders = orders

  const stats = await calculateReportStats(paidOrders, orders, dayStart, dayEnd, locationId)

  const cashShifts = await db.cashRegisterShift.findMany({
    where: {
      openedAt: { gte: dayStart, lt: dayEnd },
      status: 'closed',
      locationId,
    },
  })

  const reportData = buildReportData(
    stats, dayStart, dayEnd, actualCash, notes, finalize,
    employeeId ?? undefined, locationId, cashShifts,
  )
  reportData.totalOrders = paidOrders.length
  reportData.avgOrderValue = paidOrders.length > 0 ? round2(reportData.totalSales / paidOrders.length) : 0

  // Upsert znotraj transakcije (FIX BUG-5) — re-check po race window
  const report = await db.$transaction(async (tx) => {
    const txExisting = await tx.zReport.findFirst({
      where: { reportDate: dayStart, locationId },
    })
    if (txExisting && txExisting.status === 'finalized') {
      throw new Error('Z_REPORT_FINALIZED')
    }
    if (txExisting) {
      return tx.zReport.update({ where: { id: txExisting.id }, data: reportData })
    }
    return tx.zReport.create({ data: reportData })
  })

  return { report, stats, paidOrdersCount: paidOrders.length }
}

export async function upsertZReportForDay(params: UpsertZReportParams): Promise<UpsertZReportResult> {
  const { report, stats, paidOrdersCount } = await buildAndUpsert(params)
  return { report, stats, paidOrdersCount }
}
