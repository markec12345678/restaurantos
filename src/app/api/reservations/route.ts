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
import { requireAuth } from '@/lib/auth-middleware'
import { createReservationSchema } from '@/lib/validations'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { handleGetReservations, handleCreateReservation } from './_helpers'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo za vpogled v rezervacije
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    return await handleGetReservations(req)
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

    const result = await handleCreateReservation(data, authResult.session?.employeeId)

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true, reservation: result.reservation }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/reservations', 'Napaka pri ustvarjanju rezervacije')
  }
}
