// ============================================
// LOKACIJSKI API — Upravljanje več lokacij/poslovnih enot
// Multi-location podpora za verige restavracij
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

// FIX SECURITY: maske za občutljiva polja, ki se ne smejo vračati v GET odgovoru
function maskLocationSecrets<T extends { fursCertPassword?: string }>(location: T): T {
  if (location && typeof location.fursCertPassword === 'string' && location.fursCertPassword) {
    return { ...location, fursCertPassword: '****' }
  }
  return location
}

// ============================================
// GET /api/locations — Seznam lokacij
// ============================================

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { searchParams } = new URL(req.url)
    const isActive = searchParams.get('isActive')
    const type = searchParams.get('type')

    const where: Record<string, unknown> = {}
    if (isActive !== null) where.isActive = isActive === 'true'
    if (type) where.type = type

    const locations = await db.location.findMany({
      where,
      include: {
        _count: {
          select: {
            orders: true,
            tables: true,
            employees: true,
            inventoryItems: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // FIX SECURITY: maskiraj fursCertPassword v odgovoru
    // (prejšnja koda je vračala polno vrstico vključno z geslom certifikata)
    const maskedLocations = locations.map(maskLocationSecrets)

    // Statistika
    const totalLocations = await db.location.count()
    const activeLocations = await db.location.count({ where: { isActive: true } })
    const openNow = await db.location.count({ where: { isOpen: true, isActive: true } })

    return NextResponse.json({
      locations: maskedLocations,
      stats: { total: totalLocations, active: activeLocations, open: openNow },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/locations', 'Napaka pri pridobivanju lokacij')
  }
}

// ============================================
// POST /api/locations — Ustvari novo lokacijo
// ============================================

const createLocationSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200),
  code: z.string().min(1, 'Koda je obvezna').max(20).regex(/^[A-Z0-9_-]+$/, 'Koda mora vsebovati samo velike črke, številke, _ ali -'),
  type: z.enum(['restaurant', 'food_truck', 'pop_up', 'cloud_kitchen', 'bar']).default('restaurant'),
  address: z.string().max(500).default(''),
  city: z.string().max(200).default(''),
  postCode: z.string().max(20).default(''),
  country: z.string().max(5).default('SI'),
  phone: z.string().max(50).default(''),
  email: z.string().max(200).default(''),
  businessId: z.string().max(50).default(''),
  taxId: z.string().max(50).default(''),
  registerNumber: z.string().max(50).default(''),
  premisesId: z.string().max(50).default(''),
  fursCertPath: z.string().max(500).default(''),
  fursCertPassword: z.string().max(200).default(''),
  fursEnvironment: z.enum(['test', 'production']).default('test'),
  timezone: z.string().max(100).default('Europe/Ljubljana'),
  currency: z.string().max(5).default('EUR'),
  locale: z.string().max(10).default('sl-SI'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isActive: z.boolean().default(true),
})

export async function POST(req: Request) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { data, error: validationError } = await validateRequest(req, createLocationSchema)
    if (validationError) return validationError

    // Preveri, da koda še ne obstaja
    const existing = await db.location.findUnique({ where: { code: data.code } })
    if (existing) {
      return NextResponse.json({ error: `Lokacija s kodo "${data.code}" že obstaja` }, { status: 409 })
    }

    const location = await db.location.create({ data })

    // FIX SECURITY: maskiraj fursCertPassword v odgovoru
    return NextResponse.json(maskLocationSecrets(location), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/locations', 'Napaka pri ustvarjanju lokacije')
  }
}
