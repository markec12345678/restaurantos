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
//   - { error: 'Z_REPORT_CONFLICT', status: 409 } — P2034 Serializable
//     konflikt (R110, strukturiran objekt — ruta preslika v 409)

import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { round2 } from '@/lib/decimal'
import { ljubljanaDayBounds } from '@/lib/timezone-sl'
import { calculateReportStats } from './stats'
import { buildReportData } from './build-report'

// FIX R110 (ZR-1/ZR-2 — TOCTOU finalize + stale-stats razred iz R100–R109):
// buildAndUpsert je prej izvajal VSA branja (odprte izmene gate, plačana
// naročila, storno, blagajniške izmene) IZVEN transakcije, upsert tx pa je
// bil READ COMMITTED s samo re-check varovalko:
//   (ZR-1) dva sočasna finalize-a (EOD POST ∥ POST /api/z-report finalize)
//     → OBADVA prebereta draft (re-check pod READ COMMITTED NE ščiti — oba
//     prebita do update-a) → last-writer-wins na FINALIZIRANEM finančnem
//     poročilu (fiskalni žig brez zaščite) + create∥create na isti
//     dan+lokacija = P2002 → 500.
//   (ZR-2) statistike izven tx = STALE SNAPSHOT: med branjem orderjev in
//     upsertom pride do plačil/odpustov → finalizirano poročilo z ZASTARELO
//     prodajo/DDV (fiskalna napaka); open-shifts gate pravkar izven tx.
// KANON: vsa branja + izračun + upsert v ENI Serializable transakciji z
// advisory lock-om 'z-report:{locationId}:{date}' (serializira vse upserte
// istega poročila čez rute: EOD, POST z-report, auto-draft ob zaprtju
// izmene) + pogojni CAS updateMany { status: { not: 'finalized' } } kot
// dvorno varovalo (count 0 → Z_REPORT_FINALIZED) + P2034 → strukturirana
// 409 Z_REPORT_CONFLICT.

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

  // Preveri, če že obstaja (HITER IZHOD ob že finaliziranem poročilu —
  // prihrani težka poizvedba; AVTORITATIVNA preverba je ZNOTRAJ tx spodaj)
  const existing = await db.zReport.findFirst({
    where: { reportDate: dayStart, locationId },
  })
  if (existing && existing.status === 'finalized') {
    throw new Error('Z_REPORT_FINALIZED')
  }

  // FIX R110 (ZR-2): VSA branja + izračun + upsert v ENI Serializable tx —
  // statistike so izračunane iz konsistentnega snapshot-a (prej stale reads
  // izven tx), open-shifts gate je tx-fresh (prej branje izven tx = gate
  // razveljavljen med branjem in žigom).
  const result = await db.$transaction(async (tx) => {
    // FIX R110 (ZR-1): advisory lock — serializira vse upserte ISTEGA
    // poročila (dan+lokacija) čez vse klicatelje (EOD, POST z-report,
    // auto-draft). Re-check pod READ COMMITTED NE ščiti dveh vzporednih
    // finalize-ov; ključavnica naredi re-check AVTORITATIVEN.
    const lockKey = `z-report:${locationId}:${date}`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`

    const txExisting = await tx.zReport.findFirst({
      where: { reportDate: dayStart, locationId },
    })
    if (txExisting && txExisting.status === 'finalized') {
      throw new Error('Z_REPORT_FINALIZED')
    }

    // Pri finalizaciji morajo biti vse izmene zaprte (FIX BUG-19) — tx-fresh
    if (finalize) {
      const openShifts = await tx.cashRegisterShift.count({
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
    const orders = await tx.order.findMany({
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
    const stornoOrders = await tx.order.findMany({
      where: {
        paidAt: { gte: dayStart, lt: dayEnd },
        paymentStatus: 'storno',
        locationId,
      },
    })

    // FIX R110 (ZR-2): stats teče na ISTEM tx klientu (njegov interni
    // cashRegisterShift.findMany je pravkar tx-fresh)
    const stats = await calculateReportStats(paidOrders, stornoOrders, dayStart, dayEnd, locationId, tx)

    const cashShifts = await tx.cashRegisterShift.findMany({
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

    // Upsert (FIX BUG-5) — FIX R110 (ZR-1): CAS varovalka namesto nepogojenega
    // update-a: draft, ki med ključavnico postane finalized (obrambni globini
    // — ključavnica to že preprečuje), dobi count 0 → Z_REPORT_FINALIZED.
    if (txExisting) {
      const casUpdate = await tx.zReport.updateMany({
        where: { id: txExisting.id, status: { not: 'finalized' } },
        data: reportData,
      })
      if (casUpdate.count === 0) {
        throw new Error('Z_REPORT_FINALIZED')
      }
      // Združi z obstoječo vrstico (id/createdAt/updatedAt) — enaka oblika kot
      // prejšnji update() povratne vrednosti (brez dodatnega re-reada)
      return { report: { ...txExisting, ...reportData, id: txExisting.id }, stats, paidOrdersCount: paidOrders.length }
    }
    const created = await tx.zReport.create({ data: reportData })
    return { report: created, stats, paidOrdersCount: paidOrders.length }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })

  return result
}

export async function upsertZReportForDay(params: UpsertZReportParams): Promise<UpsertZReportResult> {
  let result: Awaited<ReturnType<typeof buildAndUpsert>>
  try {
    result = await buildAndUpsert(params)
  } catch (error: unknown) {
    // FIX R110: Serializable konflikt (P2034) → strukturirana poslovna napaka
    // 409 (canonical structuredErrorResponse kontrakt iz R103) — klicatelji:
    //   POST /api/z-report → 409 Z_REPORT_CONFLICT (retry po client strani),
    //   EOD finalizeReport → non-blocking warn (draft ostane),
    //   postShiftCloseActions → non-blocking error log (zaprtje izmene ostane).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw { error: 'Z_REPORT_CONFLICT', status: 409 }
    }
    throw error
  }
  const { report, stats, paidOrdersCount } = result
  return { report, stats, paidOrdersCount }
}
