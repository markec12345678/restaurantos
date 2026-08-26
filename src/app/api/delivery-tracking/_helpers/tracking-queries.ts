// Delivery tracking — GET in GPS update helperji

import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'

// ============================================
// GET HELPER
// ============================================

export async function handleGetTrackings(status: string | null, driverName: string | null) {
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
}

// ============================================
// GPS UPDATE HELPER
// ============================================

export async function handleLocationUpdate(deliveryInfoId: string, latitude: number, longitude: number) {
  const tracking = await db.deliveryTracking.findUnique({ where: { deliveryInfoId } })
  if (!tracking) return NextResponse.json({ error: 'Sledenje ne obstaja' }, { status: 404 })

  const updated = await db.deliveryTracking.update({
    where: { deliveryInfoId },
    data: { currentLat: latitude, currentLng: longitude, lastUpdateAt: new Date() },
  })

  return NextResponse.json(updated)
}
