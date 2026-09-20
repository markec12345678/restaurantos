// Delivery tracking — Status update in driver assignment

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { notInScopeResponse } from '@/lib/tenant-scope'
import { isTrackingInScope } from './tracking-queries'

// ============================================
// STATUS UPDATE HELPER
// ============================================

export async function handleStatusUpdate(
  deliveryInfoId: string,
  status: string,
  customerRating?: number,
  customerFeedback?: string,
  scopeLocationId: string | null = null,
) {
  const tracking = await db.deliveryTracking.findUnique({ where: { deliveryInfoId } })
  if (!tracking) return NextResponse.json({ error: 'Sledenje ne obstaja' }, { status: 404 })

  // FIX R85-H2: Cross-tenant WRITE guard — prej je bilo spremembo statusa
  // (picked_up/on_the_way/delivered/failed + dostavljeno DeliveryInfo) možno
  // izvesti na dostavi KATERE KOLI lokacije po znanem deliveryInfoId.
  if (scopeLocationId) {
    const proven = await isTrackingInScope(tracking, scopeLocationId)
    if (!proven) return notInScopeResponse('Sledenje')
  }

  const updateData: Record<string, unknown> = { status }

  switch (status) {
    case 'picked_up': updateData.pickedUpAt = new Date(); break
    case 'on_the_way': updateData.onTheWayAt = new Date(); break
    case 'delivered':
      updateData.deliveredAt = new Date()
      if (customerRating) updateData.customerRating = customerRating
      if (customerFeedback) updateData.customerFeedback = customerFeedback
      break
  }

  // FIX R85-H2: self-heal žigosanje legacy NULL locationId (dokazano v scope-u)
  if (scopeLocationId && !tracking.locationId) updateData.locationId = scopeLocationId

  // FIX BUG-9 MEDIUM: Oboje posodobitvi v transakciji
  const [updated] = await db.$transaction(async (tx) => {
    const trackingUpdate = await tx.deliveryTracking.update({
      where: { deliveryInfoId },
      data: updateData,
    })

    const deliveryStatusMap: Record<string, string> = {
      assigned: 'pending', picked_up: 'picked_up', on_the_way: 'picked_up',
      arriving: 'picked_up', delivered: 'delivered', failed: 'failed',
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
      }, deliveryInfo.order.locationId)
    }
  } catch {
    // Webhook napaka ne sme preprečiti posodobitve statusa dostave
  }

  return NextResponse.json(updated)
}

// ============================================
// DRIVER ASSIGNMENT HELPER
// ============================================

export async function handleAssignDriver(
  deliveryInfoId: string,
  driverName: string,
  driverPhone: string,
  vehicleInfo: string,
  userId?: string,
  scopeLocationId: string | null = null,
) {
  // FIX R85-H2: Cross-tenant WRITE guard — prej je bilo vozniško dodelo /
  // ustvarjanje sledenja možno na dostavi KATERE KOLI lokacije.
  // Anchoring: DeliveryInfo nima lastnega locationId — izpeljava prek
  // deliveryInfo.order.locationId (kakor GET /api/delivery). Dostava brez
  // naročila je dokazljivo vezana SAMO na lokacijo klicatelja (scope).
  const deliveryInfo = await db.deliveryInfo.findUnique({
    where: { id: deliveryInfoId },
    select: { id: true, order: { select: { locationId: true } } },
  })
  if (!deliveryInfo) return NextResponse.json({ error: 'Dostava ne obstaja' }, { status: 404 })

  const derivedLocationId = deliveryInfo.order?.locationId ?? null
  if (scopeLocationId && derivedLocationId !== scopeLocationId) {
    // Fail-closed: tuja lokacija ALI neizpeljiva lokacija (order brez lokacije /
    // standalone dostava) za lokacijskega uporabnika — ne razkrivamo obstoja.
    return notInScopeResponse('Dostava')
  }
  const stampLocationId = derivedLocationId ?? scopeLocationId ?? null

  let isUpdate = false
  let outOfScope = false
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.deliveryTracking.findUnique({ where: { deliveryInfoId } })

    if (existing) {
      // Inkonzistenten zapis (tracking na tuji lokaciji, četudi order ustreza)
      // = zavrnjen za lokacijskega uporabnika.
      if (scopeLocationId && existing.locationId && existing.locationId !== scopeLocationId) {
        outOfScope = true
        return null
      }
      if (existing.driverName && existing.driverName !== driverName) {
        throw new Error('DRIVER_ALREADY_ASSIGNED')
      }
      isUpdate = true
      const updated = await tx.deliveryTracking.update({
        where: { deliveryInfoId },
        data: {
          driverName, driverPhone, vehicleInfo, status: 'assigned', assignedAt: new Date(),
          // FIX R85-H2: self-heal žigosanje legacy NULL locationId
          ...(scopeLocationId && !existing.locationId ? { locationId: stampLocationId } : {}),
        },
      })
      return updated
    }

    const created = await tx.deliveryTracking.create({
      data: {
        deliveryInfoId, driverName, driverPhone, vehicleInfo,
        status: 'assigned', assignedAt: new Date(),
        estimatedArrival: new Date(Date.now() + 30 * 60 * 1000),
        // FIX R85-H2: žigosanje lokacije ob ustvarjanju (prej vedno NULL)
        locationId: stampLocationId,
      },
    })

    await tx.deliveryInfo.update({
      where: { id: deliveryInfoId },
      data: { courierName: driverName, courierPhone: driverPhone, status: 'preparing' },
    })

    return created
  })

  if (outOfScope) return notInScopeResponse('Sledenje')

  await createAuditLog({
    action: 'driver_assigned',
    entityType: 'delivery',
    details: { driverName, message: `Voznik ${driverName} dodeljen dostavi`, locationId: stampLocationId },
    userId,
  })

  return NextResponse.json(result, { status: isUpdate ? 200 : 201 })
}
