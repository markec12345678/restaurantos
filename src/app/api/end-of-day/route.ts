// ============================================
// END OF DAY API — Celoten proces zaključka dneva
// Toast POS + Restaurant365 standard
// Z-poročilo, FURS zaključek, uskladitev gotovine, dnevni povzetek
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
// FIX R112 (RL-2): rate-limit importi — helper po hišnem kanonu DIREKTNO iz
// rate-limit/response (NE prek barrela; barrel mockajo testi brez helperja).
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { isAdminTenantRole } from '@/lib/tenant-scope'
import { eodCloseSchema, validateReportDateRange } from '@/lib/validations'
import { toNum } from '@/lib/decimal'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { ljubljanaDayBounds, ljubljanaTodayStr } from '@/lib/timezone-sl'
import { fetchEodData, computeEodMetrics, closeShift } from './_helpers'
import { upsertZReportForDay } from '@/app/api/z-report/_helpers'
import { logger } from '@/lib/logger'


export const dynamic = 'force-dynamic'
// FIX NAPAKA 5 (HTTP 503): EOD izvede obsežne agregacijske query-je;
// povečamo timeout da preprečimo 503 na Vercelu.
export const maxDuration = 45

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    // P2-UX FIX (timezone): "danes" po ljubljanskem času — ne UTC
    // (na UTC strežniku je UTC-datum do 01:00/02:00 ŠE prejšnji dan)
    const date = searchParams.get('date') || ljubljanaTodayStr()

    // FIX R82-F (LEAK-HIGH): EOD agregati so prej bili GLOBALNI (vsi tenanti) —
    // zdaj scoped na session lokacijo; super-admin (brez lokacije) = global;
    // staff/manager BREZ lokacije → 403 fail-closed (MODEL A vzorec).
    const sessionLocId = authResult.session?.locationId ?? null
    if (!sessionLocId && !isAdminTenantRole(authResult.session?.role)) {
      return NextResponse.json({ error: 'EOD zahteva dodeljeno lokacijo.' }, { status: 403 })
    }

    // FIX HIGH: Validiraj datumski format
    const dateError = validateReportDateRange(date, date)
    if (dateError) return dateError

    // P2-UX FIX (timezone): meje [00:00, 24:00) LJUBLJANSKEGA dne v UTC —
    // prej new Date(date)+setHours(0) = meje po strežniškem TZ
    const { start: startDate, end: endDate } = ljubljanaDayBounds(date)

    // ── Vse neodvisne poizvedbe vzporedno ────────────────────
    const data = await fetchEodData(startDate, endDate, sessionLocId)

    // ── Izračunaj vse metrike ────────────────────────────────
    const metrics = computeEodMetrics(data)

    return NextResponse.json({
      date,
      eodCompleted: metrics.eodCompleted,
      // Naročila
      orders: {
        total: metrics.totalOrders,
        completed: metrics.completedOrders.length,
        cancelled: data.cancelledOrdersCount,
        revenue: metrics.totalRevenue,
        avgOrderValue: metrics.avgOrderValue,
      },
      // Plačila
      payments: {
        byMethod: metrics.paymentsByMethod,
        totalTips: metrics.totalTips,
        totalPayments: data.periodPayments.length,
      },
      // DDV
      vat: metrics.vatBreakdown,
      // FURS
      furs: {
        verified: metrics.fursVerified,
        queued: metrics.fursQueued,
        failed: metrics.fursFailed,
        allVerified: metrics.fursFailed === 0 && metrics.fursQueued === 0,
      },
      // Izmena
      shift: data.activeShift ? {
        id: data.activeShift.id,
        startingCash: toNum(data.activeShift.startingCash),
        cashSales: toNum(data.activeShift.cashSales),
        cardSales: toNum(data.activeShift.cardSales),
        totalSales: toNum(data.activeShift.totalSales),
        cashDiff: toNum(data.activeShift.cashDifference),
        openedAt: data.activeShift.openedAt,
        closedAt: data.activeShift.closedAt,
        isClosed: !!data.activeShift.closedAt,
      } : null,
      // Rezervacije
      reservations: {
        total: metrics.totalReservations,
        confirmed: metrics.confirmedReservations,
        noShow: metrics.noShowReservations,
      },
      // Gosti
      guests: {
        newToday: data.newGuestsCount,
      },
      // Stroški
      expenses: {
        total: metrics.totalExpenses,
        count: data.expenseEntries.length,
      },
      // Neto
      netProfit: metrics.netProfit,
      // Top artikli
      topItems: metrics.topItems,
      // Checklisti
      checklists: {
        opening: 'Preveri kontrolni seznam za odpiranje',
        closing: 'Preveri kontrolni seznam za zapiranje',
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/end-of-day', 'Napaka pri pridobivanju EOD podatkov')
  }
}

// ============================================
// POST — Zaključi dan
// ============================================
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX R112 (RL-2): finančni zapis (zaključek dneva / izmene) —
    // AUTHENTICATED_LIMIT kvota takoj za uspešno avtentikacijo, PRED body parse.
    const rl = await checkRateLimitAsync('authenticated-write', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtev. Poskusite znova čez nekaj časa.')

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX CRITICAL: Zod validacija za EOD POST — prejšnja koda ni imela nobene validacije
    const { data, error: validationError } = validateBody(eodCloseSchema, bodyResult.data)
    if (validationError) return validationError

    const { date, actualCash, notes, locationId } = data

    // FIX R82-F (LEAK-HIGH): body.locationId je bil raw (body.locationId =
    // poljuben locationId → lokacijsko vezan admin je zaprl TUJO izmeno z
    // izračunom cashDiff čez tuja plačila). Zdaj: lokacijsko vezana seja je
    // VEDNO pripeta na svojo lokacijo (body strip); super-admin sme izrecen
    // body.locationId; brez obeh → null (legacy single-tenant vedenje v
    // closeShift).
    // FIX R82-FINAL-1 (F3): mirror GET 403 gate — staff/manager BREZ lokacije
    // ne sme niti prek body.locationId sprožiti zaključka tuje izmene.
    // FIX R86-2a (M2 fail-open): prej je bil 403 POGOJEN na `locationId` v bodyju
    // — staff/manager brez lokacije BREZ body.locationId je prešel naprej z
    // effectiveLocationId=null → closeShift je zaprl PRVO ODPRTO izmeno GLOBALLY
    // (cross-tenant WRITE) + upsertZReportForDay globalni fallback. Zdaj: 403
    // NEPOGOJENO (isti gate kot GET zgoraj).
    const sessionLocId = authResult.session?.locationId ?? null
    if (!sessionLocId && !isAdminTenantRole(authResult.session?.role)) {
      return NextResponse.json({ error: 'EOD zahteva dodeljeno lokacijo.' }, { status: 403 })
    }
    const effectiveLocationId = sessionLocId || locationId || null

    const cashDiff = await closeShift(date, actualCash, notes, effectiveLocationId, authResult.session?.employeeId)

    // FIX QA runda 37 (UX/state machine): EOD checklist zahteva "Izmena zaprta", a je
    // endpoint VRAČAL 400, če izmena ni bila odprta (zapreta prek Blagajne) → UI tok
    // je bil nemogoče dokončati. Sedaj je EOD IDEMPOTENTEN in v obeh stanjih zaključi
    // tudi Z-poročilo (prej je ostalo draft — finalizacija je bila samo na Z-Poročilo strani):
    const finalizeReport = async (extraNote: string) => {
      try {
        await upsertZReportForDay({
          date,
          // FIX R86-2a: Z-poročilo dobí rezolvirano lokacijo (session/body) namesto
          // internega employee→prva-globalna-lokacija fallback-a (R85-FINAL-1 nota).
          // FIX R87-4: helper NIMA več globalnega fallback-a — super-admin brez
          // obeh → 'Z_REPORT_NO_LOCATION' → draft ostane (fail-closed, ne žig
          // prve tuje lokacije).
          locationId: effectiveLocationId ?? undefined,
          actualCash: actualCash ?? 0,
          notes: [notes, extraNote].filter(Boolean).join(' — '),
          employeeId: authResult.session?.employeeId ?? null,
          finalize: true,
        })
        return true
      } catch (zErr) {
        // Že finalizirano = idempotentno OK; OPEN_SHIFTS ne bi smel (izmena je zaprta zgoraj);
        // Z_REPORT_NO_LOCATION → pusti draft (ne podre EOD odgovora)
        const msg = zErr instanceof Error ? zErr.message : String(zErr)
        if (msg === 'Z_REPORT_FINALIZED' || msg.startsWith('OPEN_SHIFTS')) return true
        logger.warn('EOD', `Z-poročilo ni bilo finalizirano: ${msg}`)
        return false
      }
    }

    if (!cashDiff) {
      // Ni odprte izmene (že zaprta prek Blagajne) — vseeno finaliziraj Z-poročilo dneva
      const reportFinalized = await finalizeReport('EOD: izmena že zaprta')
      return NextResponse.json({
        success: true,
        message: reportFinalized
          ? `Dan ${date} je uspešno zaključen (izmena že zaprta, Z-poročilo finalizirano)`
          : `Dan ${date} je zaključen (izmena že zaprta; Z-poročilo ostaja draft)`,
        cashDiff: 0,
        shiftId: null,
      })
    }

    // Z-poročilo za ta dan finaliziraj kot del EOD
    const reportFinalized = await finalizeReport('EOD zaključek dneva')

    // FIX BUG-6 HIGH: Vrni PRAVI cashDifference (ne totalTips, ampak cashTips-only izračun)
    return NextResponse.json({
      success: true,
      message: reportFinalized
        ? `Dan ${date} je uspešno zaključen (Z-poročilo finalizirano)`
        : `Dan ${date} je uspešno zaključen`,
      cashDiff: toNum(cashDiff?.cashDifference) ?? 0,
      shiftId: cashDiff?.shiftId ?? null,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/end-of-day', 'Napaka pri zaključku dneva')
  }
}
