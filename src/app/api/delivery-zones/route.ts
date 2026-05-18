import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

// =====================================================================
// DELIVERY ZONES API — CRUD za cone dostave
// Zone-based delivery pricing (Toast standard)
// =====================================================================

const deliveryZoneSchema = z.object({
  name: z.string().min(1, 'Ime cone je obvezno').max(100),
  postCodes: z.string().max(2000).default('[]'),
  cities: z.string().max(2000).default('[]'),
  radiusKm: z.number().min(0).nullable().optional(),
  centerLat: z.number().min(-90).max(90).nullable().optional(),
  centerLng: z.number().min(-180).max(180).nullable().optional(),
  deliveryFee: z.number().min(0).default(2.50),
  minOrderAmount: z.number().min(0).default(10.00),
  freeDeliveryAbove: z.number().min(0).default(0),
  estimatedMinutes: z.number().int().min(5).max(180).default(30),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  locationId: z.string().nullable().optional(),
})

// GET /api/delivery-zones
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const url = new URL(req.url)
    const locationId = url.searchParams.get('locationId')

    const where = locationId ? { locationId } : {}
    const zones = await db.deliveryZone.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ zones })
  } catch (error) {
    console.error('Delivery zones GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju con dostave' }, { status: 500 })
  }
}

// POST /api/delivery-zones
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const parsed = deliveryZoneSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki', validationErrors: parsed.error.issues }, { status: 400 })
    }

    const zone = await db.deliveryZone.create({ data: parsed.data })
    return NextResponse.json(zone, { status: 201 })
  } catch (error) {
    console.error('Delivery zone POST error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju cone dostave' }, { status: 500 })
  }
}
