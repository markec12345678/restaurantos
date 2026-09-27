// ============================================
// GET /api/analytics/overview — epic #115 #36 Advanced analytics (R149-b)
// ============================================
// Enotni analytics endpoint z eksplicitnim datumskim OKNOM + granularnostjo
// (day|week|month) + prejšnjim primerjalnim oknom — zapira vrzeli dashboarda
// (danes-only) in raztresenih report endpointov (R149-a audit).
//
// Guard red (kanon R146/R147):
//   1. rate limit 'analytics' PRED authom (prosti string bucket — presets.ts
//      NESPREMENJEN, R147 precedent = nič mock-churn),
//   2. requireAuth({ permission: 'view_reports' }) — read-only reporting,
//      isti gate kot dashboard/reports (manager preide, waiter 403),
//   3. MODEL A scope: resolveTenantLocationIdOrThrow (regular brez lokacije →
//      403 fail-closed NO_LOCATION_MESSAGE; lokacijska seja avtoritativna;
//      super-admin brez ?locationId = global, z ?locationId = cross-branch),
//   4. params: start & end (YYYY-MM-DD) obvezna; granularity day|week|month
//      (privzeto 'day', neznana → 400); fail-closed caps
//      ANALYTICS_MAX_WINDOW_DAYS=90 + start ≥ 2020-01-01 + start ≤ end,
//   5. ROW_CAP: order.count() > ANALYTICS_ROW_CAP (50_000) → 400
//      'Okno zajema preveč naročil (N). Zožite obdobje.' (fail-closed),
//   6. agregacije v _helpers.ts (LJ koledar — P2-08, deterministični sorti,
//      fiksno dolge serije, Decimal→number skozi toNum/round2/deepToNumbers).
//
// Cheap-read kanon (R148 GET /api/audit/retention + R147 manifest): BREZ
// audit zapisa na uspeh — §32 veriga '… → authorization → audit' se izpolni
// šele ob morebitnem izvozu (cross-ref #33 Poročila → Izvoz).
// Cache-Control: no-store na VSEH odgovorih (200 + 4xx + 5xx).
// Zero-oracle (R146-b dev 2 / R147 precedent): neobstoječa ?locationId →
// 200 s praznimi sekcijami (brez 404 asimetrije, ki bi razkrivala obstoj).
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
// Resolver DIREKTNO iz '@/lib/tenant-scope' (NI skozi barrel — r82 mock
// topologija, R146-b deviation 7 / R147 precedens).
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'
import { buildAnalyticsOverview, validateAnalyticsParams } from './_helpers'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' }

/** no-store na VSEH odgovorih — tudi na tistih iz kanon helperjev (429/401/403). */
function withNoStore<T extends Response>(res: T): T {
  res.headers.set('Cache-Control', 'no-store')
  return res
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE_HEADERS })
}

export async function GET(req: Request) {
  try {
    // 1) Rate limit PRED authom (R146/R147 kanon; prosti vedro 'analytics')
    const rl = await checkRateLimitAsync('analytics', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return withNoStore(rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov'))

    // 2) Auth — read-only reporting gate (manager preide, waiter 403)
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return withNoStore(authResult.error)
    if (authResult.session === null) {
      // BUG-HUNT kanon (backup route): { session: null, error: null } je javna
      // pot, NE avtorizacija — zahtevamo DEJANSKO sejo.
      return NextResponse.json(
        { error: 'Avtentikacija je obvezna. Pošljite Authorization: Bearer <token>' },
        { status: 401, headers: NO_STORE_HEADERS },
      )
    }

    const { searchParams } = new URL(req.url)

    // 3) MODEL A scope (fail-closed 403 brez lokacije; super-admin global/cross-branch)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/analytics/overview',
    })
    if ('error' in scope) return withNoStore(scope.error)

    // 4) Params + fail-closed okno caps (slovenska sporočila, report-rute kanon)
    const parsed = validateAnalyticsParams(
      searchParams.get('start'),
      searchParams.get('end'),
      searchParams.get('granularity'),
    )
    if ('error' in parsed) return badRequest(parsed.error)

    // 5) + 6) ROW_CAP pre-check → agregacije (LJ koledar, deterministično)
    const result = await buildAnalyticsOverview(scope.locationId, parsed.window)
    if (!result.ok) {
      return badRequest(`Okno zajema preveč naročil (${result.count}). Zožite obdobje.`)
    }

    return NextResponse.json(result.payload, { status: 200, headers: NO_STORE_HEADERS })
  } catch (error: unknown) {
    return withNoStore(handleApiError(error, 'GET /api/analytics/overview', 'Napaka pri izračunu analitike'))
  }
}
