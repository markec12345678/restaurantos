
// ============================================
// END-OF-DAY (ZOD - Zaključek obratovalnega dneva)
// GET: Pridobi podatke za zaključek dneva
// POST: Zaključi obratovalni dan (zapri blagajno, generiraj izpiske)
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationId, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'
import { ljubljanaDayBounds, ljubljanaTodayStr } from '@/lib/timezone-sl'
import { fetchEodData, computeEodMetrics, computeCategoryBreakdown, enrichEmployeeNames } from './_helpers'
import { handleEodPost, handleEodPostError } from './_helpers/post-handler'


export const dynamic = 'force-dynamic'
// FIX NAPAKA 5 (HTTP 503): EOD poročila izvedejo obsežne agregacijske query-je.
export const maxDuration = 45

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('reports-eod', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    // R158-4 (R159-b): privzeti datum = LJ danes (prej UTC)
    const date = searchParams.get('date') || ljubljanaTodayStr()

    // FIX HIGH: Validiraj datumski format
    const dateError = validateReportDateRange(date, date)
    if (dateError) return dateError

    // R158-4 (R159-b): okno po LJ poslovnemu dnevu (prej fiksno UTC okno,
    // ki je hranilo eod-close gotovinske vsote za napačno izmeno). Konzumenti
    // (fetchEodData/computeEodCloseData) uporabljajo lte → zadnja milisekunda
    // LJ dneva (pariteta s starim 23:59:59.999 vključno semantiko).
    const ljBounds = ljubljanaDayBounds(date)
    const dayStart = ljBounds.start
    const dayEnd = new Date(ljBounds.end.getTime() - 1)

    // FIX P0-C2: Centralni tenant scope resolver — fail-closed, no ?locationId bypass
    const scope = resolveTenantLocationId(authResult.session, searchParams, {
      endpoint: 'GET /api/reports/eod',
    })
    if (!scope.ok) return scope.error

    // ─── VSE NEODVISNE POIZVEDBE VZPOREDNO ───
    const rawData = await fetchEodData(dayStart, dayEnd, scope.locationId ?? null)

    // ─── IZRAČUNI METRIKE ───
    const metrics = computeEodMetrics(rawData)

    // ─── SEKUNDARNE POIZVEDBE (odvisne od rezultatov) ───
    const categoryBreakdown = await computeCategoryBreakdown(
      metrics.categoryData.categoryItemGroups, metrics.menuItemIds
    )
    const employeeBreakdownFinal = await enrichEmployeeNames(
      metrics.employeeBreakdown, metrics.empIds
    )

    return NextResponse.json({
      date,
      summary: metrics.summary,
      vatBreakdown: metrics.vatBreakdown,
      paymentMethods: metrics.paymentMethods,
      categoryBreakdown,
      employeeBreakdown: employeeBreakdownFinal,
      hourlyBreakdown: metrics.hourlyBreakdown,
      costs: metrics.costs,
      voidedItems: metrics.voidedItems,
      activeShift: metrics.activeShift,
      isDayClosed: metrics.isDayClosed,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/eod', 'Napaka pri pridobivanju poročila')
  }
}

// ============================================
// POST — ZAKLJUČI OBRATOVALNI DAN
// ============================================
export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('reports-eod', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX R84-1 HIGH (cross-tenant WRITE): prej je EOD close iskal PRVO odprto
    // izmeno BREZ locationId filtra — lokacijski admin je lahko zaprl izmeno
    // TUJE lokacije z združenimi vsi-tenant povzetki. Scope je obvezen: za
    // lokacijskega admina = session lokacija; super-admin (null) lahko poda
    // ?locationId= ali izvede globalno (rounded staro vedenje — platformni admin).
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/reports/eod',
    })
    if ('error' in scope) return scope.error

    return await handleEodPost(
      req,
      authResult as { session?: { employeeId?: string } | null },
      scope.locationId,
    )
  } catch (error: unknown) {
    return handleEodPostError(error)
  }
}
