// ============================================
// DAILY CLOSE API — Dnevni zaključek / end-of-day reconciliation
// (epic #115 P0-02, R126-a)
// ============================================
// GET  /api/daily-close — scoped seznam zaključkov (filtri date / from / to /
//                         status), orderBy businessDate desc, take 60.
// POST /api/daily-close — nov zaključek dneva (popis gotovine):
//   1. fast-path idempotencija (locationId, idempotencyKey) → replay 200
//   2. Z-poročilo dneva (draft) — upsertZReportForDay(finalize:false) →
//      report.expectedCash = sistemsko pričakovana gotovina
//   3. Serializable tx: idempotency re-check (race-safe) + gate odprtih
//      blagajniških izmen (OPEN_SHIFTS:n) + lokacija/prag + variance =
//      countedCash − expectedCash + upsert DailyClose po (locationId,
//      businessDate):
//        - ne obstaja              → create (snapshot Z-paritete) — 201
//        - status CLOSED           → 409 DAILY_CLOSE_ALREADY_CLOSED
//        - status REOPENED         → re-close (overwrite, reopenCount ostane)
//        - status PENDING_APPROVAL → re-count (overwrite)
//   4. |variance| ≤ prag (Location.dailyCloseVarianceThreshold) → CLOSED +
//      samodejna odobritev (approvedBy = closedBy) + finalize Z-poročila
//      (IZVEN tx, actualCash = countedCash); > prag → PENDING_APPROVAL,
//      Z-poročilo ostane draft do odobritve (approve/reject/reopen rute).
//   5. Audit: DAILY_CLOSE_CREATED | DAILY_CLOSE_RECLOSED | DAILY_CLOSE_RECOUNT
//
// Kanon: fail-closed scope (MODEL A), P2002 → 409 (R116), strukturirane
// poslovne napake { error, status } iz tx teles → passthrough (R103),
// Decimal prek toNum/round2, odgovori deepToNumbers.
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import {
  resolveTenantLocationId,
  isAdminTenantRole,
  tenantScopeToWhere,
} from '@/lib/tenant-scope'
import { toNum, round2, deepToNumbers } from '@/lib/decimal'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleRouteError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { ljubljanaDayBounds } from '@/lib/timezone-sl'
import { upsertZReportForDay } from '@/app/api/z-report/_helpers'

export const dynamic = 'force-dynamic'

// Samodejna odobritev znotraj praga — samo-dokumentirana (approvedBy = closedBy)
const AUTO_APPROVAL_NOTE = 'Samodejno: razlika znotraj praga'

const dailyCloseSchema = z.object({
  date: z.string().min(1, 'Datum je obvezen').max(10)
    .refine(val => /^\d{4}-\d{2}-\d{2}$/.test(val), 'Datum mora biti v formatu YYYY-MM-DD'),
  countedCash: z.number().min(0, 'Popisana gotovina ne more biti negativna').max(9999999, 'Znesek je previsok'),
  notes: z.string().max(1000, 'Opombe ne smejo preseči 1000 znakov').default(''),
  // R116 kanon: klient generira stabilen ključ — retry/duplicate POST vrne ISTO
  // vrstico (replay) brez ponovnega izračuna.
  idempotencyKey: z.string().min(8, 'Idempotency ključ mora imeti vsaj 8 znakov').max(100, 'Idempotency ključ je predolg'),
  locationId: z.string().max(100, 'ID lokacije je predolg').optional(),
})

/** Strukturirana poslovna napaka iz tx telesa ({ error, status } — R103 kontrakt). */
function asStructuredError(
  error: unknown,
): { error: string; status: number } | null {
  if (
    error &&
    typeof error === 'object' &&
    'error' in error &&
    'status' in error &&
    typeof (error as { error: unknown }).error === 'string' &&
    typeof (error as { status: unknown }).status === 'number'
  ) {
    return error as { error: string; status: number }
  }
  return null
}

// GET — Scoped seznam dnevnih zaključkov
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const status = searchParams.get('status')

    // P0-C2: Centralni tenant scope resolver — fail-closed, no ?locationId bypass
    const scope = resolveTenantLocationId(authResult.session, searchParams, {
      endpoint: 'GET /api/daily-close',
    })
    if (!scope.ok) return scope.error

    let businessDate: Prisma.DateTimeFilter | undefined
    if (date) {
      // Posamezen poslovni dan — meje ljubljanskega dne na businessDate (day-start)
      const { start, end } = ljubljanaDayBounds(date)
      businessDate = { gte: start, lt: end }
    } else if (from || to) {
      // Razpon poslovnih dni — businessDate je VEDNO day-start, zato `to`
      // pokrije celoten zadnji dan (lte = polnoč dneva `to`)
      businessDate = {}
      if (from) businessDate.gte = ljubljanaDayBounds(from).start
      if (to) businessDate.lte = ljubljanaDayBounds(to).start
    }

    const where: Prisma.DailyCloseWhereInput = {
      ...tenantScopeToWhere(scope),
      ...(status ? { status } : {}),
      ...(businessDate ? { businessDate } : {}),
    }

    const closes = await db.dailyClose.findMany({
      where,
      orderBy: { businessDate: 'desc' },
      take: 60,
    })

    return NextResponse.json(deepToNumbers({ closes, total: closes.length }))
  } catch (error: unknown) {
    return handleRouteError(error, 'GET /api/daily-close', [], 'Napaka pri pridobivanju dnevnih zaključkov')
  }
}

// POST — Zaključi poslovni dan (popis gotovine + reconciliation)
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    // FIX R112 (RL-2): finančni zapis (dnevni zaključek) — AUTHENTICATED_LIMIT
    // kvota takoj za uspešno avtentikacijo, PRED body parse.
    const rl = await checkRateLimitAsync('authenticated-write', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtev. Poskusite znova čez nekaj časa.')

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(dailyCloseSchema, bodyResult.data)
    if (validationError) return validationError

    const { date, countedCash, notes, idempotencyKey } = data

    // FIX R82-F vzorec (MODEL A, fail-closed): 403 gate NEPOGOJEN na body —
    // staff/manager BREZ dodeljene lokacije ne sme zaključiti dneva niti prek
    // body.locationId (isti gate kot POST /api/end-of-day).
    const sessionLocId = authResult.session?.locationId ?? null
    if (!sessionLocId && !isAdminTenantRole(authResult.session?.role)) {
      return NextResponse.json(
        { error: 'Dnevni zaključek zahteva dodeljeno lokacijo.' },
        { status: 403 },
      )
    }

    // Lokacija: seja avtoritativna; super-admin (brez session lokacije) sme
    // podati izrecen body.locationId; brez obeh → 400 (fail-closed, NIČ
    // globalnega prva-lokacija fallback-a).
    const isAdmin = isAdminTenantRole(authResult.session?.role)
    const effectiveLocationId = sessionLocId ?? (isAdmin ? data.locationId ?? null : null)
    if (!effectiveLocationId) {
      return NextResponse.json(
        { error: 'Ni mogoče določiti lokacije za dnevni zaključek.' },
        { status: 400 },
      )
    }
    const locationId = effectiveLocationId

    const employeeId = authResult.session?.employeeId ?? null

    // Idempotencija fast-path (R116 kanon): replay vrne obstoječo vrstico BREZ
    // ponovnega izračuna (brez Z-report draft upserta, brez audita, brez tx).
    const replayed = await db.dailyClose.findUnique({
      where: { locationId_idempotencyKey: { locationId, idempotencyKey } },
    })
    if (replayed) {
      return NextResponse.json(
        deepToNumbers({
          close: replayed,
          variance: toNum(replayed.cashVariance),
          threshold: toNum(replayed.varianceThreshold),
          requiresApproval: false,
          zReportFinalized: replayed.status === 'CLOSED',
          replay: true,
        }),
        { status: 200 },
      )
    }

    // ZGODNJI 409 (R126-d E2E najdba): CLOSED dan mora vrniti
    // DAILY_CLOSE_ALREADY_CLOSED (409), NE Z_REPORT_FINALIZED (400) — prej je
    // bil Z-draft upsert (spodaj) prvi, ki je naletel na finalizirano
    // Z-poročilo, in je zakril pravi poslovni vzrok. Early check je advisory
    // (tx znotraj še vedno avtoritativno uveljavlja 409); pokriva tudi replays
    // z RAZLIČNIM idempotencyKey na CLOSED dan.
    const earlyExisting = await db.dailyClose.findUnique({
      where: { locationId_businessDate: { locationId, businessDate: ljubljanaDayBounds(date).start } },
    })
    if (earlyExisting?.status === 'CLOSED') {
      return NextResponse.json(
        { error: 'DAILY_CLOSE_ALREADY_CLOSED' },
        { status: 409 },
      )
    }

    // Snapshot imena akterja (preživi brisanje zaposlenega) — lookup IZVEN tx
    const employee = employeeId
      ? await db.employee.findUnique({ where: { id: employeeId }, select: { name: true } })
      : null
    const closedByName = employee?.name ?? ''

    // (c) Z-poročilo dneva (draft) — helper ima lastno Serializable tx z
    // advisory lock-om; report.expectedCash = sistemsko pričakovana gotovina.
    // Strukturne napake (Z_REPORT_CONFLICT) → passthrough 409 (catch spodaj).
    const { report, stats, paidOrdersCount } = await upsertZReportForDay({
      date,
      locationId,
      actualCash: 0,
      notes: '',
      finalize: false,
      employeeId,
    })

    // Snapshot Z-paritete (report/stats) — Decimal prek toNum. totalRefunds:
    // Z-report/stats polja trenutno ne izpostavljajo refund agregata (vračila
    // živijo per izmena); snapshot je varen 0, dokler vir polja ne izpostavi.
    const reportBag = report as unknown as Record<string, unknown>
    const statsBag = stats as unknown as Record<string, unknown>
    const expectedCash = toNum(report.expectedCash)
    const snapshot = {
      totalSales: toNum(report.totalSales),
      cashSales: toNum(report.cashSales),
      cardSales: toNum(report.cardSales),
      mobileSales: toNum(report.mobileSales),
      alternateSales: toNum(report.alternateSales),
      totalOrders: paidOrdersCount,
      totalDiscounts: toNum(report.totalDiscounts),
      totalTips: toNum(report.totalTips),
      totalVoided: toNum(report.totalVoided),
      totalRefunds: toNum(Number(reportBag.totalRefunds ?? statsBag.totalRefunds ?? 0)),
    }

    // (d)–(g): gate + prag + variance + upsert — VSE znotraj ENI Serializable tx
    const txResult = await db.$transaction(async (tx) => {
      // (b) idempotency re-check — race-safe (tx-fresh; fast-path je bil izven tx)
      const replayExisting = await tx.dailyClose.findUnique({
        where: { locationId_idempotencyKey: { locationId, idempotencyKey } },
      })
      if (replayExisting) {
        return { kind: 'replay' as const, close: replayExisting }
      }

      // (a) canonical day-start ključ — enoličen per (locationId, businessDate)
      const businessDate = ljubljanaDayBounds(date).start

      // (d) Pogoj za zaključek dneva: brez odprtih blagajniških izmen, ki
      // SEKAJO poslovni dan (odprte prek polnoči štejejo — isti razred kot
      // Z finalize gate, a širši okvir openedAt < dayEnd).
      const dayEnd = ljubljanaDayBounds(date).end
      const openShifts = await tx.cashRegisterShift.count({
        where: {
          locationId,
          status: 'open',
          openedAt: { lt: dayEnd },
          OR: [{ closedAt: { gte: businessDate } }, { closedAt: null }],
        },
      })
      if (openShifts > 0) {
        throw new Error(`OPEN_SHIFTS:${openShifts}`)
      }

      // (e) prag iz lokacije (read znotraj tx)
      const location = await tx.location.findUnique({ where: { id: locationId } })
      if (!location) {
        throw { error: 'LOCATION_NOT_FOUND', status: 404 }
      }
      const threshold = toNum(location.dailyCloseVarianceThreshold)

      // variance = counted − expected (round2 — valutna natančnost)
      const variance = round2(countedCash - expectedCash)
      const withinThreshold = Math.abs(variance) <= threshold
      const status = withinThreshold ? 'CLOSED' : 'PENDING_APPROVAL'
      const now = new Date()

      // (f) Samodejna odobritev znotraj praga (samo-dokumentirana)
      const reconciliation = {
        expectedCash,
        countedCash,
        cashVariance: variance,
        varianceThreshold: threshold,
        ...snapshot,
        notes,
        closedById: employeeId,
        closedByName,
        closedAt: now,
        zReportId: report.id,
        status,
        ...(withinThreshold
          ? {
              approvedById: employeeId,
              approvedByName: closedByName,
              approvedAt: now,
              approvalNote: AUTO_APPROVAL_NOTE,
            }
          : { approvedById: null, approvedByName: '', approvedAt: null, approvalNote: '' }),
      }

      // (g) Upsert po (locationId, businessDate)
      const existing = await tx.dailyClose.findUnique({
        where: { locationId_businessDate: { locationId, businessDate } },
      })
      if (!existing) {
        const created = await tx.dailyClose.create({
          data: { locationId, businessDate, idempotencyKey, ...reconciliation },
        })
        return { kind: 'created' as const, close: created, threshold, variance }
      }
      if (existing.status === 'CLOSED') {
        // Z-report draft je bil zgoraj že osvežen — to je OK (najnovejši stalež).
        throw { error: 'DAILY_CLOSE_ALREADY_CLOSED', status: 409 }
      }
      // REOPENED → re-close; PENDING_APPROVAL → re-count: isti overwrite
      // (reconciliation + snapshot + closedBy/at zdaj); reopenCount in
      // reopen/reject metadata ostanejo nespremenjeni (audit sled).
      const updated = await tx.dailyClose.update({
        where: { id: existing.id },
        data: reconciliation,
      })
      return {
        kind: existing.status === 'REOPENED' ? ('reclosed' as const) : ('recount' as const),
        close: updated,
        threshold,
        variance,
      }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    // (b) replay iz tx (sočasen POST z istim ključem) — brez finalize/audita
    if (txResult.kind === 'replay') {
      return NextResponse.json(
        deepToNumbers({
          close: txResult.close,
          variance: toNum(txResult.close.cashVariance),
          threshold: toNum(txResult.close.varianceThreshold),
          requiresApproval: false,
          zReportFinalized: txResult.close.status === 'CLOSED',
          replay: true,
        }),
        { status: 200 },
      )
    }

    let { close, threshold, variance } = txResult

    // (h) Z-report finalize — IZVEN glavne transakcije (po njej), samo če je
    // dan zaključen (CLOSED). Z_REPORT_FINALIZED = idempotentno OK.
    let zReportFinalized = false
    if (close.status === 'CLOSED') {
      try {
        const finalized = await upsertZReportForDay({
          date,
          locationId,
          actualCash: countedCash,
          notes,
          finalize: true,
          employeeId,
        })
        zReportFinalized = true
        // Zapiši zReportId, če se je spremenil (finalize lahko ustvari poročilo)
        if (close.zReportId !== finalized.report.id) {
          const refreshed = await db.dailyClose.update({
            where: { id: close.id },
            data: { zReportId: finalized.report.id },
          })
          close = refreshed
        }
      } catch (zErr) {
        const structured = asStructuredError(zErr)
        if (structured) throw structured // Z_REPORT_CONFLICT → 409 passthrough
        const msg = zErr instanceof Error ? zErr.message : String(zErr)
        if (msg !== 'Z_REPORT_FINALIZED') throw zErr
        zReportFinalized = true // že finalizirano — idempotentno OK
      }
    }

    // (i) Audit (PCI DSS) — po zaključku vseh sprememb
    await createAuditLog({
      action:
        txResult.kind === 'created'
          ? 'DAILY_CLOSE_CREATED'
          : txResult.kind === 'reclosed'
            ? 'DAILY_CLOSE_RECLOSED'
            : 'DAILY_CLOSE_RECOUNT',
      entityType: 'daily_close',
      entityId: close.id,
      details: { date, countedCash, variance, status: close.status, threshold },
      userId: employeeId ?? undefined,
    })

    return NextResponse.json(
      deepToNumbers({
        close,
        variance,
        threshold,
        requiresApproval: close.status === 'PENDING_APPROVAL',
        zReportFinalized,
        replay: false,
      }),
      { status: txResult.kind === 'created' ? 201 : 200 },
    )
  } catch (error: unknown) {
    // Strukturirane poslovne napake iz tx teles ({ error, status } — Z_REPORT_
    // CONFLICT, LOCATION_NOT_FOUND, DAILY_CLOSE_ALREADY_CLOSED) — passthrough
    // PRED pattern-matchingom (canonical structuredErrorResponse kontrakt iz R103).
    const structured = asStructuredError(error)
    if (structured) {
      return NextResponse.json({ error: structured.error }, { status: structured.status })
    }
    // Idempotency race na (locationId, businessDate): dva vzporedna POST-a z
    // RAZLIČNIMA ključema → unique constraint → 409 (R116 kanon).
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Dnevni zaključek že obstaja (sočasen dostop) — ponovite zahtevek z istim idempotencyKey' },
        { status: 409 },
      )
    }
    return handleRouteError(error, 'POST /api/daily-close', [
      { match: 'OPEN_SHIFTS', message: 'Obstajajo odprte blagajniške izmene. Zaprite vse izmene pred dnevnim zaključkom.', status: 400, extra: (parts) => ({ openShifts: parseInt(parts[1]) || 0 }) },
      { match: 'Z_REPORT_FINALIZED', message: 'Z-poročilo za ta dan je že zaključeno', status: 400 },
      { match: 'Z_REPORT_NO_LOCATION', message: 'Ni mogoče določiti lokacije za dnevni zaključek.', status: 400 },
    ], 'Napaka pri dnevnem zaključku')
  }
}
