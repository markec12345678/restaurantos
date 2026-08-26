// Delivery tracking — Status update in driver assignment

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'

// ============================================
// STATUS UPDATE HELPER
// ============================================

export async function handleStatusUpdate(
  deliveryInfoId: string,
  status: string,
  customerRating?: number,
  customerFeedback?: string,
) {
  const tracking = await db.deliveryTracking.findUnique({ where: { deliveryInfoId } })
  if (!tracking) return NextResponse.json({ error: 'Sledenje ne obstaja' }, { status: 404 })

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
      })
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
) {
  let isUpdate = false
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.deliveryTracking.findUnique({ where: { deliveryInfoId } })

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
        deliveryInfoId, driverName, driverPhone, vehicleInfo,
        status: 'assigned', assignedAt: new Date(),
        estimatedArrival: new Date(Date.now() + 30 * 60 * 1000),
      },
    })

    await tx.deliveryInfo.update({
      where: { id: deliveryInfoId },
      data: { courierName: driverName, courierPhone: driverPhone, status: 'preparing' },
    })

    return created
  })

  await createAuditLog({
    action: 'driver_assigned',
    entityType: 'delivery',
    details: { driverName, message: `Voznik ${driverName} dodeljen dostavi` },
    userId,
  })

  return NextResponse.json(result, { status: isUpdate ? 200 : 201 })
}
