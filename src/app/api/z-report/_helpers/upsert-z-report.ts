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
import { calculateReportStats } from './stats'
import { buildReportData } from './build-report'

export interface UpsertZReportParams {
  /** 'YYYY-MM-DD' — Ljubljanski dan (glej ljubljanaDayBounds) */
  date: string
  /** Rezolvirana tenant lokacija (session ali shift.locationId). OBVEZNA od
   *  R87-4: klicatelj jo fail-closed rezolvira iz seje
   *  (resolveTenantLocationIdOrThrow / resolveWriteLocationId) ali iz podatkov
   *  (shift.locationId) — tip je zaradi legacy klicateljev (`?? undefined`)
   *  tehnično opcionalen, a manjkajoča/prazna lokacija je VEDNO zavrnjena z
   *  'Z_REPORT_NO_LOCATION'. NIČ več internega globalnega prva-lokacija
   *  fallback-a — nikoli žig prve tuje lokacije. */
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

  // FIX QA 2026-09-18 (runda 36 + refaktor runda 37) + FIX R87-4 (LOW preostanek):
  // DB stolpec ZReport.locationId je NOT NULL (schema drift). Prej je helper sam
  // klical resolveLocationId(params.locationId, employeeId) — za super-admina
  // (POST /api/z-report oz. end-of-day brez izrecne lokacije) je to padlo na
  // GLOBALNI prva-lokacija fallback → Z-poročilo (finančni promet!) je bilo
  // izračunano in ZAPISANO na prvo lokacijo KATEREGA KOLI tenanta.
  // Zdaj je locationId OBVEZEN parameter — klicatelj ga fail-closed rezolvira;
  // manjka → 'Z_REPORT_NO_LOCATION' (klicatelj preslika v 400 / pusti draft).
  const locationId = params.locationId
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

  // BUG-HUNT FIX 2026-09-19 (totalStorno): storno naročila so bila izključena že
  // v osnovnem query-ju (paymentStatus in ['paid','partial']) → storno filter v
  // calculateReportStats se NI NIKOLI ujemale → totalStorno VEDNO 0 (fiskalno
  // poročilo brez storno vrstic = napačen promet). Pridobi storno naročila
  // posebej (obdržijo paidAt iz dneva izdaje računa).
  const stornoOrders = await db.order.findMany({
    where: {
      paidAt: { gte: dayStart, lt: dayEnd },
      paymentStatus: 'storno',
      locationId,
    },
  })

  const stats = await calculateReportStats(paidOrders, stornoOrders, dayStart, dayEnd, locationId)

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
