import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

// =====================================================================
// DELIVERY ZONE [ID] — Posodobi / izbriši cono dostave
// =====================================================================

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
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    const zone = await db.deliveryZone.update({ where: { id }, data: parsed.data })
    return NextResponse.json(zone)
  } catch (error) {
    console.error('Delivery zone PATCH error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju cone' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    await db.deliveryZone.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delivery zone DELETE error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju cone' }, { status: 500 })
  }
}
