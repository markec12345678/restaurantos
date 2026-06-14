// ============================================
// DELIVERY TRACKING API — GPS sledenje voznikom
// Toast + DoorDash standard
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, handleRouteError, validateRequest } from '@/lib/api-utils'
const assignDriverSchema = z.object({
  deliveryInfoId: z.string().min(1, 'ID dostave je obvezen').max(100, 'ID dostave ne sme preseči 100 znakov'),
  driverName: z.string().min(1, 'Ime voznika je obvezno').max(200, 'Ime voznika ne sme preseči 200 znakov'),
  driverPhone: z.string().min(1, 'Telefon voznika je obvezen').max(50, 'Telefon ne sme preseči 50 znakov'),
  vehicleInfo: z.string().max(200, 'Podatki o vozilu ne smejo preseči 200 znakov').default(''),
})

const updateLocationSchema = z.object({
  deliveryInfoId: z.string().min(1, 'ID dostave je obvezen').max(100, 'ID dostave ne sme preseči 100 znakov'),
  latitude: z.number().min(-90, 'Zemljepisna širina mora biti med -90 in 90').max(90, 'Zemljepisna širina mora biti med -90 in 90'),
  longitude: z.number().min(-180, 'Zemljepisna dolžina mora biti med -180 in 180').max(180, 'Zemljepisna dolžina mora biti med -180 in 180'),
})

const updateStatusSchema = z.object({
  deliveryInfoId: z.string().min(1, 'ID dostave je obvezen').max(100, 'ID dostave ne sme preseči 100 znakov'),
  status: z.enum(['assigned', 'picked_up', 'on_the_way', 'arriving', 'delivered', 'failed'], { message: 'Neveljaven status dostave' }),
  customerRating: z.number().min(1, 'Ocena mora biti vsaj 1').max(5, 'Ocena ne sme preseči 5').optional(),
  customerFeedback: z.string().max(500, 'Povratna informacija ne sme preseči 500 znakov').optional(),
})

// Union schema za POST — trije tipi zahtevkov v enem validateRequest klicu
const deliveryTrackingPostSchema = z.union([updateLocationSchema, updateStatusSchema, assignDriverSchema])

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

    // FIX N+1: Batch query instead of individual queries per tracking
    const deliveryInfoIds = trackings.map(t => t.deliveryInfoId)
    const deliveryInfos = deliveryInfoIds.length > 0
      ? await db.deliveryInfo.findMany({
          where: { id: { in: deliveryInfoIds } },
          include: { order: { include: { orderItems: { include: { menuItem: true } } } } },
        })
      : []
    const deliveryInfoMap = new Map(deliveryInfos.map(di => [di.id, di]))
    const enriched = trackings.map(t => ({
      ...t,
      deliveryInfo: deliveryInfoMap.get(t.deliveryInfoId) || null,
    }))

    return NextResponse.json(deepToNumbers(enriched))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/delivery-tracking', 'Napaka pri pridobivanju sledenja')
  }
}

// POST — Dodeli voznika dostavi / Posodobi GPS / Posodobi status
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, deliveryTrackingPostSchema)
    if (validationError) return validationError

    // GPS posodobitev
    if ('latitude' in data) {
      const { deliveryInfoId, latitude, longitude } = data

      const tracking = await db.deliveryTracking.findUnique({ where: { deliveryInfoId } })
      if (!tracking) return NextResponse.json({ error: 'Sledenje ne obstaja' }, { status: 404 })

      const updated = await db.deliveryTracking.update({
        where: { deliveryInfoId },
        data: { currentLat: latitude, currentLng: longitude, lastUpdateAt: new Date() },
      })

      return NextResponse.json(updated)
    }

    // Status posodobitev
    if ('status' in data) {
      const { deliveryInfoId, status, customerRating, customerFeedback } = data

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

      // FIX BUG-9 MEDIUM: Oboje posodobitvi (tracking + deliveryInfo) v transakciji — prepreči desync
      const [updated] = await db.$transaction(async (tx) => {
        const trackingUpdate = await tx.deliveryTracking.update({
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
        await tx.deliveryInfo.update({
          where: { id: deliveryInfoId },
          data: {
            status: deliveryStatusMap[status] || status,
            ...(status === 'delivered' ? { actualTime: new Date() } : {}),
          },
        })

        return [trackingUpdate] as const
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
      } catch {
        // Webhook napaka ne sme preprečiti posodobitve statusa dostave
      }

      return NextResponse.json(updated)
    }

    // Dodeli voznika
    const { deliveryInfoId, driverName, driverPhone, vehicleInfo } = data

    // FIX Race condition: Use transaction for driver assignment
    // Preveri če že obstaja sledenje in dodeli voznika znotraj transakcije
    let tracking
    let isUpdate = false
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.deliveryTracking.findUnique({ where: { deliveryInfoId } })

      // FIX D02 HIGH: Prepreči race condition pri dodelitvi voznika
      // Če že obstaja voznik, prepreči prepis — uporabi optimistično konkurenčno kontrolo
      if (existing) {
        if (existing.driverName && existing.driverName !== driverName) {
          throw new Error('DRIVER_ALREADY_ASSIGNED')
        }
        isUpdate = true
        const updated = await tx.deliveryTracking.update({
          where: { deliveryInfoId },
          data: { driverName, driverPhone, vehicleInfo, status: 'assigned', assignedAt: new Date() },
        })
        return updated
      }

      const created = await tx.deliveryTracking.create({
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

      // Posodobi DeliveryInfo s podatki voznika znotraj transakcije
      await tx.deliveryInfo.update({
        where: { id: deliveryInfoId },
        data: { courierName: driverName, courierPhone: driverPhone, status: 'preparing' },
      })

      return created
    })

    tracking = result

    await createAuditLog({
      action: 'driver_assigned',
      entityType: 'delivery',
      details: { driverName, message: `Voznik ${driverName} dodeljen dostavi` },
      userId: authResult.session?.employeeId,
    })

    return NextResponse.json(tracking, { status: isUpdate ? 200 : 201 })
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/delivery-tracking', [
      { match: 'DRIVER_ALREADY_ASSIGNED', message: 'Dostava že ima dodeljenega voznika. Kontaktrajte voznika za predajo.', status: 409 },
    ], 'Napaka pri sledenju dostave')
  }
}
