// ============================================
// DELIVERY TRACKING API — GPS sledenje voznikom
// Toast + DoorDash standard
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

const assignDriverSchema = z.object({
  deliveryInfoId: z.string().min(1),
  driverName: z.string().min(1),
  driverPhone: z.string().min(1),
  vehicleInfo: z.string().default(''),
})

const updateLocationSchema = z.object({
  deliveryInfoId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

const updateStatusSchema = z.object({
  deliveryInfoId: z.string().min(1),
  status: z.enum(['assigned', 'picked_up', 'on_the_way', 'arriving', 'delivered', 'failed']),
  customerRating: z.number().min(1).max(5).optional(),
  customerFeedback: z.string().max(500).optional(),
})

// GET — Pridobi aktivne dostave s sledenjem
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const driverName = searchParams.get('driverName')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (driverName) where.driverName = { contains: driverName }

    const trackings = await db.deliveryTracking.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })

    // Dodaj order podatke
    const enriched = await Promise.all(trackings.map(async (t) => {
      const deliveryInfo = await db.deliveryInfo.findUnique({
        where: { id: t.deliveryInfoId },
        include: { order: { include: { orderItems: { include: { menuItem: true } } } } },
      })
      return { ...t, deliveryInfo }
    }))

    return NextResponse.json(enriched)
  } catch (error: any) {
    console.error('DeliveryTracking GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju sledenja' }, { status: 500 })
  }
}

// POST — Dodeli voznika dostavi
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // Preveri vrsto zahtevka
    if (body.latitude && body.longitude) {
      // GPS posodobitev
      const parsed = updateLocationSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'Neveljavni GPS podatki' }, { status: 400 })

      const { deliveryInfoId, latitude, longitude } = parsed.data

      const tracking = await db.deliveryTracking.findUnique({ where: { deliveryInfoId } })
      if (!tracking) return NextResponse.json({ error: 'Sledenje ne obstaja' }, { status: 404 })

      const updated = await db.deliveryTracking.update({
        where: { deliveryInfoId },
        data: { currentLat: latitude, currentLng: longitude, lastUpdateAt: new Date() },
      })

      return NextResponse.json(updated)
    }

    if (body.status) {
      // Status posodobitev
      const parsed = updateStatusSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'Neveljavni status podatki' }, { status: 400 })

      const { deliveryInfoId, status, customerRating, customerFeedback } = parsed.data

      const tracking = await db.deliveryTracking.findUnique({ where: { deliveryInfoId } })
      if (!tracking) return NextResponse.json({ error: 'Sledenje ne obstaja' }, { status: 404 })

      const updateData: Record<string, unknown> = { status }

      // Časovnica
      switch (status) {
        case 'picked_up': updateData.pickedUpAt = new Date(); break
        case 'on_the_way': updateData.onTheWayAt = new Date(); break
        case 'delivered':
          updateData.deliveredAt = new Date()
          if (customerRating) updateData.customerRating = customerRating
          if (customerFeedback) updateData.customerFeedback = customerFeedback
          break
      }

      const updated = await db.deliveryTracking.update({
        where: { deliveryInfoId },
        data: updateData,
      })

      // Posodobi tudi DeliveryInfo status
      const deliveryStatusMap: Record<string, string> = {
        assigned: 'pending',
        picked_up: 'picked_up',
        on_the_way: 'picked_up',
        arriving: 'picked_up',
        delivered: 'delivered',
        failed: 'failed',
      }
      await db.deliveryInfo.update({
        where: { id: deliveryInfoId },
        data: {
          status: deliveryStatusMap[status] || status,
          ...(status === 'delivered' ? { actualTime: new Date() } : {}),
        },
      })

      // Sproži webhook
      try {
        const deliveryInfo = await db.deliveryInfo.findUnique({ where: { id: deliveryInfoId }, include: { order: true } })
        if (deliveryInfo?.order) {
          const { emitEvent } = await import('@/lib/event-emitter')
          await emitEvent('delivery.status_changed', {
            orderId: deliveryInfo.order.id,
            orderNumber: String(deliveryInfo.order.orderNumber),
            status,
            driverName: tracking.driverName,
            estimatedArrival: updated.estimatedArrival ? updated.estimatedArrival.toISOString() : null,
          })
        }
      } catch {}

      return NextResponse.json(updated)
    }

    // Dodeli voznika
    const parsed = assignDriverSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Neveljavni podatki', details: parsed.error.issues }, { status: 400 })

    const { deliveryInfoId, driverName, driverPhone, vehicleInfo } = parsed.data

    // Preveri če že obstaja sledenje
    const existing = await db.deliveryTracking.findUnique({ where: { deliveryInfoId } })

    if (existing) {
      const updated = await db.deliveryTracking.update({
        where: { deliveryInfoId },
        data: { driverName, driverPhone, vehicleInfo, status: 'assigned', assignedAt: new Date() },
      })
      return NextResponse.json(updated)
    }

    const tracking = await db.deliveryTracking.create({
      data: {
        deliveryInfoId,
        driverName,
        driverPhone,
        vehicleInfo,
        status: 'assigned',
        assignedAt: new Date(),
        estimatedArrival: new Date(Date.now() + 30 * 60 * 1000), // 30 min ETA
      },
    })

    // Posodobi DeliveryInfo s podatki voznika
    await db.deliveryInfo.update({
      where: { id: deliveryInfoId },
      data: { courierName: driverName, courierPhone: driverPhone, status: 'preparing' },
    })

    await createAuditLog({
      action: 'driver_assigned',
      entityType: 'delivery',
      details: { driverName, message: `Voznik ${driverName} dodeljen dostavi` },
      userId: (authResult as any).employee?.id,
    })

    return NextResponse.json(tracking, { status: 201 })
  } catch (error: any) {
    console.error('DeliveryTracking POST error:', error)
    return NextResponse.json({ error: 'Napaka pri sledenju dostave' }, { status: 500 })
  }
}
