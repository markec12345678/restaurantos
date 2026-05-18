// ============================================
// LOKACIJA DETAIL — Posodobi, izbriši, pridobi podrobnosti
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

// ============================================
// GET /api/locations/[id] — Podrobnosti lokacije
// ============================================

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { id } = await params

    const location = await db.location.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: true,
            tables: true,
            employees: true,
            inventoryItems: true,
            cashShifts: true,
            reservations: true,
          },
        },
        tables: {
          where: { status: 'occupied' },
          take: 20,
        },
      },
    })

    if (!location) {
      return NextResponse.json({ error: 'Lokacija ni najdena' }, { status: 404 })
    }

    // Dnevna statistika za lokacijo
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayStats = await db.order.aggregate({
      where: {
        locationId: id,
        paymentStatus: 'paid',
        paidAt: { gte: today },
      },
      _sum: { total: true, tip: true },
      _count: true,
    })

    return NextResponse.json({
      ...location,
      todayStats: {
        totalSales: todayStats._sum.total || 0,
        totalTips: todayStats._sum.tip || 0,
        totalOrders: todayStats._count,
      },
    })
  } catch (error) {
    console.error('Napaka pri pridobivanju lokacije:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju lokacije' }, { status: 500 })
  }
}

// ============================================
// PUT /api/locations/[id] — Posodobi lokacijo
// ============================================

const updateLocationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(20).regex(/^[A-Z0-9_-]+$/).optional(),
  type: z.enum(['restaurant', 'food_truck', 'pop_up', 'cloud_kitchen', 'bar']).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(200).optional(),
  postCode: z.string().max(20).optional(),
  country: z.string().max(5).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().max(200).optional(),
  businessId: z.string().max(50).optional(),
  taxId: z.string().max(50).optional(),
  registerNumber: z.string().max(50).optional(),
  premisesId: z.string().max(50).optional(),
  fursCertPath: z.string().max(500).optional(),
  fursCertPassword: z.string().max(200).optional(),
  fursEnvironment: z.enum(['test', 'production']).optional(),
  timezone: z.string().max(100).optional(),
  currency: z.string().max(5).optional(),
  locale: z.string().max(10).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  isOpen: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { id } = await params
    const body = await req.json()

    const parsed = updateLocationSchema.safeParse(body)
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

    // Preveri, da lokacija obstaja
    const existing = await db.location.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Lokacija ni najdena' }, { status: 404 })
    }

    // Če spreminjamo kodo, preveri unikatnost
    if (data.code && data.code !== existing.code) {
      const codeExists = await db.location.findUnique({ where: { code: data.code } })
      if (codeExists) {
        return NextResponse.json({ error: `Koda "${data.code}" je že zasedena` }, { status: 409 })
      }
    }

    const location = await db.location.update({
      where: { id },
      data,
    })

    return NextResponse.json(location)
  } catch (error) {
    console.error('Napaka pri posodobitvi lokacije:', error)
    return NextResponse.json({ error: 'Napaka pri posodobitvi lokacije' }, { status: 500 })
  }
}

// ============================================
// DELETE /api/locations/[id] — Izbriši/deaktiviraj lokacijo
// ============================================

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { id } = await params

    const location = await db.location.findUnique({ where: { id } })
    if (!location) {
      return NextResponse.json({ error: 'Lokacija ni najdena' }, { status: 404 })
    }

    // Preveri, da lokacija nima aktivnih naročil
    const activeOrders = await db.order.count({
      where: {
        locationId: id,
        status: { in: ['pending', 'in-progress', 'ready'] },
      },
    })

    if (activeOrders > 0) {
      return NextResponse.json({
        error: `Lokacija ima ${activeOrders} aktivnih naročil — najprej jih zaključite`,
      }, { status: 400 })
    }

    // Soft delete — deaktiviraj namesto brisanja
    await db.location.update({
      where: { id },
      data: { isActive: false, isOpen: false },
    })

    return NextResponse.json({ success: true, action: 'deactivated' })
  } catch (error) {
    console.error('Napaka pri brisanju lokacije:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju lokacije' }, { status: 500 })
  }
}
