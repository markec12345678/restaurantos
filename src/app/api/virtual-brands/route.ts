// ============================================
// Virtual Brand / Ghost Kitchen API
// ============================================
// GET  /api/virtual-brands — Seznam virtualnih znamk
// POST /api/virtual-brands — Ustvari novo znamko
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    // FIX R81-G (LEAK-LOW, cross-tenant): findMany je bil brez lokacijskega
    // filtra — view_reports staff je videl znamke + _count.orders VSEH
    // lokacij. VirtualBrand.locationId je nullable — NULL (legacy) vrstice so
    // fail-closed za lokacijsko vezane seje; super-admin = globalni pogled.
    // _count.orders se skopa naravno (seznam je že filtriran).
    const sessionLocId = authResult.session?.locationId ?? null
    const brands = await db.virtualBrand.findMany({
      where: {
        isActive: true,
        ...(sessionLocId ? { locationId: sessionLocId } : {}),
      },
      include: {
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ brands: deepToNumbers(brands) })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/virtual-brands', 'Napaka pri pridobivanju virtualnih znamk')
  }
}

const createSchema = z.object({
  name: z.string().min(2, 'Ime je obvezno').max(100),
  code: z.string().min(2).max(10).toUpperCase(),
  description: z.string().max(500).default(''),
  color: z.string().default('#f59e0b'),
  locationId: z.string().optional(),
  ownMenu: z.boolean().default(true),
  ownPricing: z.boolean().default(true),
  orderPrefix: z.string().max(10).default(''),
  deliveryEnabled: z.boolean().default(true),
  pickupEnabled: z.boolean().default(true),
})

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error } = createSchema.safeParse(bodyResult.data)
    if (error) {
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    const existing = await db.virtualBrand.findUnique({ where: { code: data.code } })
    if (existing) {
      return NextResponse.json({ error: `Znamka s kodo "${data.code}" že obstaja` }, { status: 409 })
    }

    // FIX R81-G (LEAK-LOW): body locationId je STRIPPAN za lokacijsko vezane
    // seje (seja je avtoritativna); super-admin sme podati izrecen locationId
    // (ali pustiti null — VirtualBrand.locationId je nullable).
    const sessionLocId = authResult.session?.locationId ?? null
    const brand = await db.virtualBrand.create({
      data: { ...data, locationId: sessionLocId || data.locationId || null },
    })
    return NextResponse.json(deepToNumbers(brand), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/virtual-brands', 'Napaka pri ustvarjanju virtualne znamke')
  }
}
