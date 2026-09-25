import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { createPaymentSchema } from '@/lib/validations'
import { handleApiError, validateRequest } from '@/lib/api-utils'
// FIX R112 (RL-2): rate-limit importi — helper po hišnem kanonu DIREKTNO iz
// rate-limit/response (NE prek barrela; barrel mockajo testi brez helperja).
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleListPayments, handleCreatePayment } from './_helpers'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX SECURITY: GET je prej klical handleListPayments BREZ requireAuth() —
    // vsak nepooblaščen uporabnik je lahko izčrpal celotno tabelo plačil.
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // PAYMENT AUDIT 2026-09-09 (cross-tenant): seznam plačil scoped na lokacijo seje
    // FIX R86-2a (M2 fail-open, R85-FINAL-2 "worst member"): raw
    // `session?.locationId ?? null` je regularno sejo z NULL lokacijo (session-store
    // jo sprejme za KATEROKOLI vlogo) pustil do GLOBALNEGA seznama plačil vseh
    // tenantov — brez potrebe po id znanju (list-payments `if (checkId || locationId)`).
    // Centralni resolver: fail-closed 403; ?locationId bypass ignoriran.
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/payments',
    })
    if ('error' in scope) return scope.error
    return await handleListPayments(req, scope.locationId)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/payments', 'Napaka pri pridobivanju plačil')
  }
}

export async function POST(req: Request) {
  try {
    // R128 (epic #115 P0-5, kanon): plačilo offline NI varno podprto →
    // fail-closed 422 ŠE PRED rate-limit/auth obdelavo (poceni header check).
    // Offline naročila se sinhronizirajo prek /api/device-sync; denarna
    // operacija pa se zaključi IZKLJUČNO ob aktivni povezavi (FURS ZDDV +
    // dvomenska varnost: brez povezave ni validacije čeka/kartice niti
    // storno poti).
    if (req.headers.get('x-offline-sync') === 'true') {
      return NextResponse.json(
        {
          error: 'PAYMENT_OFFLINE_NOT_ALLOWED',
          message: 'Plačilo ni mogoče izvesti offline — plačila se zaključijo samo ob aktivni povezavi.',
        },
        { status: 422 },
      )
    }

    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R112 (RL-2): finančni zapis — AUTHENTICATED_LIMIT kvota takoj za
    // uspešno avtentikacijo, PRED body parse / DB zapisom.
    const rl = await checkRateLimitAsync('authenticated-write', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtev. Poskusite znova čez nekaj časa.')

    // PAYMENT AUDIT 2026-09-09 (cross-tenant): posreduj lokacijo seje —
    // prepreči ustvarjanje plačila na čeku/naročilu DRUGE lokacije
    // FIX R86-2a (M2 fail-open): centralni resolver namesto raw spread-a —
    // regularna NULL-location seja je prej dobila GLOBALNI check lookup
    // (plačilo na tujem čeku).
    // FIX R87-4 (higiena, R86-FINAL-AUDIT LOW #3): resolver PRED body parse.
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/payments',
    })
    if ('error' in scope) return scope.error

    const { data, error: validationError } = await validateRequest(req, createPaymentSchema, { maxBodySize: 512 * 1024 })
    if (validationError) return validationError

    return await handleCreatePayment(data, authResult.session?.employeeId, scope.locationId)
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/payments', 'Napaka pri ustvarjanju plačila')
  }
}
