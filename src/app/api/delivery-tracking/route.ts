// ============================================
// DELIVERY TRACKING API — GPS sledenje voznikom
// Toast + DoorDash standard
// ============================================

import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { handleApiError, handleRouteError, validateRequest } from '@/lib/api-utils'
import {

  deliveryTrackingPostSchema,
  handleGetTrackings,
  handleLocationUpdate,
  handleStatusUpdate,
  handleAssignDriver,
} from './_helpers'

// GET — Pridobi aktivne dostave s sledenjem
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R85-H2: Tenant scope — prej je GET vračal GPS sledenja, naslove in
    // vozniške kontakte VSEH lokacij. Fail-closed za regular uporabnika brez
    // lokacije; null scope (super-admin) = globalni pogled.
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/delivery-tracking',
    })
    if ('error' in scope) return scope.error

    const status = searchParams.get('status')
    const driverName = searchParams.get('driverName')

    return await handleGetTrackings(status, driverName, scope.locationId)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/delivery-tracking', 'Napaka pri pridobivanju sledenja')
  }
}

// POST — Dodeli voznika dostavi / Posodobi GPS / Posodobi status
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R85-H2: Tenant scope za vse tri pisalne poti (GPS/status/assign) —
    // prej je bil cross-tenant WRITE možen na dostavi po znanem deliveryInfoId.
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/delivery-tracking',
    })
    if ('error' in scope) return scope.error
    const locationId = scope.locationId

    const { data, error: validationError } = await validateRequest(req, deliveryTrackingPostSchema)
    if (validationError) return validationError

    // GPS posodobitev
    if ('latitude' in data) {
      return await handleLocationUpdate(data.deliveryInfoId, data.latitude, data.longitude, locationId)
    }

    // Status posodobitev
    if ('status' in data) {
      return await handleStatusUpdate(
        data.deliveryInfoId, data.status, data.customerRating, data.customerFeedback, locationId,
        // R137-b (P1-13): POD opomba + gotovina pobrana (delivered close-out)
        data.podNotes, data.cashCollected,
      )
    }

    // Dodeli voznika
    return await handleAssignDriver(
      data.deliveryInfoId, data.driverName, data.driverPhone, data.vehicleInfo,
      authResult.session?.employeeId, locationId,
    )
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/delivery-tracking', [
      { match: 'DRIVER_ALREADY_ASSIGNED', message: 'Dostava že ima dodeljenega voznika. Kontaktrajte voznika za predajo.', status: 409 },
    ], 'Napaka pri sledenju dostave')
  }
}
