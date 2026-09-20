import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { createPaymentSchema } from '@/lib/validations'
import { handleApiError, validateRequest } from '@/lib/api-utils'
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
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

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
