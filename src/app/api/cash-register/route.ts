
import { db } from '@/lib/db'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationId, tenantScopeToWhere, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleRouteError, handleApiError, validateRequest } from '@/lib/api-utils'
import { openShiftSchema, calculateLiveStats, openShift } from './_helpers'


// GET /api/cash-register — Get current and recent shifts
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('cash-register', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    // FIX C-07: Zahtevaj avtentikacijo za blagajno
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    // FIX P0-C2: Centralni tenant scope resolver — fail-closed, no ?locationId bypass
    // Prej: 2× bypass (aktivna izmena + recent izmene)
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationId(authResult.session, searchParams, {
      endpoint: 'GET /api/cash-register',
    })
    if (!scope.ok) return scope.error
    const tenantWhere = tenantScopeToWhere(scope)

    const shiftWhere: Record<string, unknown> = { status: 'open', ...tenantWhere }

    const activeShift = await db.cashRegisterShift.findFirst({
      where: shiftWhere,
      orderBy: { openedAt: 'desc' },
    })

    // If there's an active shift, calculate live stats
    let liveStats: Record<string, number> | null = null
    if (activeShift) {
      liveStats = await calculateLiveStats(activeShift)
    }

    // Get recent closed shifts
    const recentShiftsWhere: Record<string, unknown> = { status: 'closed', ...tenantWhere }
    const recentShifts = await db.cashRegisterShift.findMany({
      where: recentShiftsWhere,
      orderBy: { closedAt: 'desc' },
      take: 10,
    })

    return NextResponse.json(deepToNumbers({ activeShift, liveStats, recentShifts }))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/cash-register', 'Napaka pri pridobivanju blagajne')
  }
}

// POST /api/cash-register — Open a new shift
export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('cash-register', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    // FIX C-07: Zahtevaj avtentikacijo za odpiranje izmene
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    // FIX BUG-09: Preveri in ustvari izmeno v transakciji — prepreči race condition
    // BUG-HUNT FIX 2026-09-19: session scope — lokacija izmena se rešuje iz SESSIONE,
    // ne iz klientovega employeeId (prej je manage_cash uporabnik lahko odprl izmeno
    // na poljubni lokaciji z izbranim zaposlenim)
    // FIX R86-2a (M2 fail-open): centralni resolver namesto raw spread-a — prej je
    // regularna NULL-location seja lahko odprla izmeno na lokaciji POLJUBNEGA
    // zaposlenega (client-podan employeeId) ali na globalni prvi lokaciji.
    // FIX R87-4 (higiena, R86-FINAL-AUDIT LOW #3): resolver PRED body parse.
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/cash-register',
    })
    if ('error' in scope) return scope.error

    // FIX: Validiraj vnos z validateRequest — vključuje 1MB omejitev in sanatizacijo
    const { data, error: validationError } = await validateRequest(req, openShiftSchema)
    if (validationError) return validationError

    const shift = await openShift(data, {
      sessionEmployeeId: authResult.session?.employeeId,
      sessionLocationId: scope.locationId,
    })

    // Webhook: cash_register.opened
    // R83: locationId pass-through (shift.locationId) — tenant isolation v webhook delivery
    emitEvent('cash_register.opened', {
      shiftId: shift.id,
      employeeName: data.employeeName || '',
      startingCash: data.startingCash,
    }, shift.locationId ?? null).catch(err => logger.error('API', '[Webhook] cash_register.opened napaka:', err))

    return NextResponse.json(shift)
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/cash-register', [
      { match: 'ALREADY_OPEN', message: 'Že obstaja odprta izmena. Najprej zaprite trenutno izmeno.', status: 400 },
      { match: 'EMPLOYEE_ID_REQUIRED', message: 'Identifikacija zaposlenega je obvezna za odpiranje izmene.', status: 400 },
      { match: 'CROSS_LOCATION_SHIFT', message: 'Izmeno lahko odprete samo na svoji lokaciji.', status: 403 },
      { match: 'SHIFT_LOCATION_REQUIRED', message: 'Lokacije izmene ni mogoče določiti: seja nima dodeljene lokacije in izbrani zaposleni prav tako ne. Dodelite lokacijo ali se prijavite kot zaposleni z lokacijo.', status: 400 },
      { match: 'STARTING_CASH_MISMATCH', message: 'Začetna gotovina se ne ujema s končnim stanjem prejšnje izmene. Preverite in vnesite pravilen znesek.', status: 409, extra: (parts) => ({ expectedCash: toNum(parts[1] || '0'), actualCash: toNum(parts[2] || '0') }) },
    ], 'Napaka pri odpiranju izmene')
  }
}
