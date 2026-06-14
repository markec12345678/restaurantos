
// =====================================================================
// DELIVERY ZONE [ID] — Posodobi / izbriši cono dostave
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { decimalsToNumbers } from '@/lib/decimal'
import { parseJsonBody, handleApiError } from '@/lib/api-utils'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  postCodes: z.string().max(2000).optional(),
  cities: z.string().max(2000).optional(),
  radiusKm: z.number().min(0).nullable().optional(),
  centerLat: z.number().min(-90).max(90).nullable().optional(),
  centerLng: z.number().min(-180).max(180).nullable().optional(),
  deliveryFee: z.number().min(0).optional(),
  minOrderAmount: z.number().min(0).optional(),
  freeDeliveryAbove: z.number().min(0).optional(),
  estimatedMinutes: z.number().int().min(5).max(180).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  locationId: z.string().nullable().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    const parsed = updateSchema.safeParse(bodyResult.data)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    // FIX BUG4: Check zone exists before updating — previously returned generic 500 on missing ID
    const existing = await db.deliveryZone.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Cone dostave ni mogoče najti' }, { status: 404 })
    }

    const zone = await db.deliveryZone.update({ where: { id }, data: parsed.data })
    return NextResponse.json(decimalsToNumbers(zone, ['deliveryFee', 'minOrderAmount', 'freeDeliveryAbove']))
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/delivery-zones/[id]', 'Napaka pri posodabljanju cone')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    // FIX BUG4: Check zone exists before deleting — previously returned generic 500 on missing ID
    const existing = await db.deliveryZone.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Cone dostave ni mogoče najti' }, { status: 404 })
    }

    await db.deliveryZone.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/delivery-zones/[id]', 'Napaka pri brisanju cone')
  }
}
