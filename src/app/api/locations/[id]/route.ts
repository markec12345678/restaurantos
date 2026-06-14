// ============================================
// LOKACIJA DETAIL — Posodobi, izbriši, pridobi podrobnosti
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'
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
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/locations/[id]', 'Napaka pri pridobivanju lokacije')
  }
}

// ============================================
// PUT /api/locations/[id] — Posodobi lokacijo
// ============================================

const updateLocationSchema = z.object({
  name: z.string().min(1, 'Ime lokacije je obvezno').max(200, 'Ime ne sme preseči 200 znakov').optional(),
  code: z.string().min(1, 'Koda je obvezna').max(20, 'Koda ne sme preseči 20 znakov').regex(/^[A-Z0-9_-]+$/, 'Koda sme vsebovati samo velike črke, številke, _ in -').optional(),
  type: z.enum(['restaurant', 'food_truck', 'pop_up', 'cloud_kitchen', 'bar'], { message: 'Neveljaven tip lokacije' }).optional(),
  address: z.string().max(500, 'Naslov ne sme preseči 500 znakov').optional(),
  city: z.string().max(200, 'Mesto ne sme preseči 200 znakov').optional(),
  postCode: z.string().max(20, 'Poštna številka ne sme preseči 20 znakov').optional(),
  country: z.string().max(5, 'Koda države ne sme preseči 5 znakov').optional(),
  phone: z.string().max(50, 'Telefon ne sme preseči 50 znakov').optional(),
  email: z.string().max(200, 'Email ne sme preseči 200 znakov').optional(),
  businessId: z.string().max(50, 'Matična številka ne sme preseči 50 znakov').optional(),
  taxId: z.string().max(50, 'Davčna številka ne sme preseči 50 znakov').optional(),
  registerNumber: z.string().max(50, 'Številka registra ne sme preseči 50 znakov').optional(),
  premisesId: z.string().max(50, 'ID poslovnega prostora ne sme preseči 50 znakov').optional(),
  fursCertPath: z.string().max(500, 'Pot do certifikata ne sme preseči 500 znakov').optional(),
  fursCertPassword: z.string().max(200, 'Geslo certifikata ne sme preseči 200 znakov').optional(),
  fursEnvironment: z.enum(['test', 'production'], { message: 'Okolje mora biti test ali production' }).optional(),
  timezone: z.string().max(100, 'Časovni pas ne sme preseči 100 znakov').optional(),
  currency: z.string().max(5, 'Valuta ne sme preseči 5 znakov').optional(),
  locale: z.string().max(10, 'Locale ne sme preseči 10 znakov').optional(),
  latitude: z.number().min(-90, 'Zemljepisna širina mora biti med -90 in 90').max(90, 'Zemljepisna širina mora biti med -90 in 90').optional().nullable(),
  longitude: z.number().min(-180, 'Zemljepisna dolžina mora biti med -180 in 180').max(180, 'Zemljepisna dolžina mora biti med -180 in 180').optional().nullable(),
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
    const { data, error: validationError } = await validateRequest(req, updateLocationSchema)
    if (validationError) return validationError

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
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/locations/[id]', 'Napaka pri posodobitvi lokacije')
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
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/locations/[id]', 'Napaka pri brisanju lokacije')
  }
}
