// ============================================
// REZERVACIJSKI SISTEM — Profesionalna implementacija
// Uporablja Reservation model iz Prisma sheme
// Toast POS + TouchBistro standard
// Avtentikacija + Zod validacija
// ============================================

// ============================================
// GET - Pridobi rezervacije
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { createReservationSchema } from '@/lib/validations'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { handleGetReservations, handleCreateReservation } from './_helpers'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo za vpogled v rezervacije
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R85-4a M2: Tenant scope — prej je handleGetReservations izvajal
    // findMany + count + groupBy + aggregate GLOBALNO (rezervacije vseh
    // tenantov: imena, telefoni, časi). Fail-closed za regularnega
    // uporabnika brez lokacije; null scope (super-admin) = globalni pogled.
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/reservations',
    })
    if ('error' in scope) return scope.error

    return await handleGetReservations(req, scope.locationId)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reservations', 'Napaka pri pridobivanju rezervacij')
  }
}

// ============================================
// POST - Ustvari rezervacijo
// ============================================

export async function POST(req: Request) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo za ustvarjanje rezervacije
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createReservationSchema)
    if (validationError) return validationError

    // FIX R85-4a M2: Tenant scope za WRITE — scope podan handlerju, ki:
    //  (a) validira data.tableId proti session lokaciji (prej je bilo mogoče
    //      rezervirati TUJO mizo čez tenant-e),
    //  (b) žiga locationId (data-derived table.locationId, sicer scope;
    //      super-admin brez lokacije in brez mize → 400 fail-closed —
    //      prej je resolveLocationId fallback žigal PRVO lokacijo v DB,
    //      lahko tuji tenant).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/reservations',
    })
    if ('error' in scope) return scope.error

    const result = await handleCreateReservation(data, authResult.session?.employeeId, scope)

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true, reservation: result.reservation }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/reservations', 'Napaka pri ustvarjanju rezervacije')
  }
}
