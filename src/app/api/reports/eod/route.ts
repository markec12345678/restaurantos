
// ============================================
// END-OF-DAY (ZOD - Zaključek obratovalnega dneva)
// GET: Pridobi podatke za zaključek dneva
// POST: Zaključi obratovalni dan (zapri blagajno, generiraj izpiske)
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationId } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
import { fetchEodData, computeEodMetrics, computeCategoryBreakdown, enrichEmployeeNames } from './_helpers'
import { handleEodPost, handleEodPostError } from './_helpers/post-handler'


export const dynamic = 'force-dynamic'
// FIX NAPAKA 5 (HTTP 503): EOD poročila izvedejo obsežne agregacijske query-je.
export const maxDuration = 45

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('reports-eod', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // FIX HIGH: Validiraj datumski format
    const dateError = validateReportDateRange(date, date)
    if (dateError) return dateError

    const dayStart = new Date(date + 'T00:00:00.000Z')
    const dayEnd = new Date(date + 'T23:59:59.999Z')

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
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    return await handleEodPost(req, authResult as { session?: { employeeId?: string } | null })
  } catch (error: unknown) {
    return handleEodPostError(error)
  }
}
