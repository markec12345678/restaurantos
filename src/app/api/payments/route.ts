import { requireAuth } from '@/lib/auth-middleware'
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
    return await handleListPayments(req, authResult.session?.locationId ?? null)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/payments', 'Napaka pri pridobivanju plačil')
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, createPaymentSchema, { maxBodySize: 512 * 1024 })
    if (validationError) return validationError

    // PAYMENT AUDIT 2026-09-09 (cross-tenant): posreduj lokacijo seje —
    // prepreči ustvarjanje plačila na čeku/naročilu DRUGE lokacije
    return await handleCreatePayment(data, authResult.session?.employeeId, authResult.session?.locationId ?? null)
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/payments', 'Napaka pri ustvarjanju plačila')
  }
}
