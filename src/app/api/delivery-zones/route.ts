import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { decimalsToNumbers } from '@/lib/decimal'
import { handleApiError, validateRequest } from '@/lib/api-utils'

// =====================================================================
// DELIVERY ZONES API — CRUD za cone dostave
// Zone-based delivery pricing (Toast standard)
// =====================================================================

const deliveryZoneSchema = z.object({
  name: z.string().min(1, 'Ime cone je obvezno').max(100, 'Ime cone ne sme preseči 100 znakov'),
  postCodes: z.string().max(2000, 'Poštne številke ne smejo preseči 2000 znakov').default('[]'),
  cities: z.string().max(2000, 'Mesta ne smejo preseči 2000 znakov').default('[]'),
  radiusKm: z.number().min(0, 'Radij mora biti vsaj 0').nullable().optional(),
  centerLat: z.number().min(-90, 'Zemljepisna širina mora biti med -90 in 90').max(90, 'Zemljepisna širina mora biti med -90 in 90').nullable().optional(),
  centerLng: z.number().min(-180, 'Zemljepisna dolžina mora biti med -180 in 180').max(180, 'Zemljepisna dolžina mora biti med -180 in 180').nullable().optional(),
  deliveryFee: z.number().min(0, 'Dostavna cena mora biti vsaj 0').default(2.50),
  minOrderAmount: z.number().min(0, 'Minimalni znesek naročila mora biti vsaj 0').default(10.00),
  freeDeliveryAbove: z.number().min(0, 'Brezplačna dostava mora biti vsaj 0').default(0),
  estimatedMinutes: z.number().int().min(5, 'Ocenjeni čas mora biti vsaj 5 minut').max(180, 'Ocenjeni čas ne sme preseči 180 minut').default(30),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  locationId: z.string().max(100, 'ID lokacije ne sme preseči 100 znakov').nullable().optional(),
})

// GET /api/delivery-zones
export const dynamic = 'force-dynamic'

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

    return NextResponse.json({ zones: zones.map(z => decimalsToNumbers(z, ['deliveryFee', 'minOrderAmount', 'freeDeliveryAbove'])) })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/delivery-zones', 'Napaka pri pridobivanju con dostave')
  }
}

// POST /api/delivery-zones
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, deliveryZoneSchema)
    if (validationError) return validationError

    const zone = await db.deliveryZone.create({ data })
    return NextResponse.json(decimalsToNumbers(zone, ['deliveryFee', 'minOrderAmount', 'freeDeliveryAbove']), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/delivery-zones', 'Napaka pri ustvarjanju cone dostave')
  }
}
