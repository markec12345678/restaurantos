// ============================================
// LOKACIJA DETAIL — Posodobi, izbriši, pridobi podrobnosti
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { updateLocationSchema } from './_helpers'

// FIX SECURITY: maske za občutljiva polja, ki se ne smejo vračati v odgovoru
function maskLocationSecrets<T extends { fursCertPassword?: string }>(location: T): T {
  if (location && typeof location.fursCertPassword === 'string' && location.fursCertPassword) {
    return { ...location, fursCertPassword: '****' }
  }
  return location
}


// ============================================
// GET /api/locations/[id] — Podrobnosti lokacije
// ============================================

export const dynamic = 'force-dynamic'

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

    // FIX SECURITY: maskiraj fursCertPassword pred vračanjem klientu
    return NextResponse.json({
      ...maskLocationSecrets(location),
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

    // FIX SECURITY: maskiraj fursCertPassword v odgovoru
    return NextResponse.json(deepToNumbers(maskLocationSecrets(location)))
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
