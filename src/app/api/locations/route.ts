// ============================================
// LOKACIJSKI API — Upravljanje več lokacij/poslovnih enot
// Multi-location podpora za verige restavracij
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

// ============================================
// GET /api/locations — Seznam lokacij
// ============================================

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

    // Statistika
    const totalLocations = await db.location.count()
    const activeLocations = await db.location.count({ where: { isActive: true } })
    const openNow = await db.location.count({ where: { isOpen: true, isActive: true } })

    return NextResponse.json({
      locations,
      stats: { total: totalLocations, active: activeLocations, open: openNow },
    })
  } catch (error) {
    console.error('Napaka pri pridobivanju lokacij:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju lokacij' }, { status: 500 })
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
    const body = await req.json()

    const parsed = createLocationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Neveljavni podatki',
        validationErrors: parsed.error.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, { status: 400 })
    }

    const data = parsed.data

    // Preveri, da koda še ne obstaja
    const existing = await db.location.findUnique({ where: { code: data.code } })
    if (existing) {
      return NextResponse.json({ error: `Lokacija s kodo "${data.code}" že obstaja` }, { status: 409 })
    }

    const location = await db.location.create({ data })

    return NextResponse.json(location, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju lokacije:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju lokacije' }, { status: 500 })
  }
}
