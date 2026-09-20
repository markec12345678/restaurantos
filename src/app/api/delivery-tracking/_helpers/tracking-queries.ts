// Delivery tracking — GET in GPS update helperji

import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { notInScopeResponse } from '@/lib/tenant-scope'

// ============================================
// GET HELPER
// ============================================

export async function handleGetTrackings(status: string | null, driverName: string | null, locationId: string | null = null) {
  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (driverName) where.driverName = { contains: driverName }
  // FIX R85-H2: Tenant scope — prej je GET vračal sledenja VSEH lokacij
  // (naslovi, telefoni, GPS pozicije voznikov čez tenant-e). DeliveryTracking
  // IMA lasten locationId stolpec (indeksiran), ampak ni bil nikoli žigosan.
  // Legacy NULL vrstice so vidne SAMO super-adminu (fail-closed). Pisalne poti
  // (GPS/status/assign) žigosajo locationId (self-heal); enkratni backfill:
  // scripts/backfill-delivery-tracking-location.ts
  if (locationId) where.locationId = locationId

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

export async function handleLocationUpdate(deliveryInfoId: string, latitude: number, longitude: number, scopeLocationId: string | null = null) {
  // FIX R85-H2: Cross-tenant WRITE guard — prej je bil update možen na
  // sledenju KATERE KOLI lokacije po znanem deliveryInfoId.
  // Guard: zapis mora biti dokazljivo v scope-u (lastni locationId ALI
  // izpeljava deliveryInfo.order.locationId). Legacy NULL brez izpeljive
  // lokacije = zavrnjen za lokacijske uporabnike (fail-closed).
  const tracking = await db.deliveryTracking.findUnique({ where: { deliveryInfoId } })
  if (!tracking) return NextResponse.json({ error: 'Sledenje ne obstaja' }, { status: 404 })

  if (scopeLocationId) {
    const proven = await isTrackingInScope(tracking, scopeLocationId)
    if (!proven) return notInScopeResponse('Sledenje')
  }

  const updated = await db.deliveryTracking.update({
    where: { deliveryInfoId },
    data: {
      currentLat: latitude,
      currentLng: longitude,
      lastUpdateAt: new Date(),
      // FIX R85-H2: self-heal — dokazano v scope-u → žigosi legacy NULL locationId
      ...(scopeLocationId && !tracking.locationId ? { locationId: scopeLocationId } : {}),
    },
  })

  return NextResponse.json(updated)
}

// ============================================
// SCOPE GUARD (deljeno med GPS/status/assign)
// ============================================

type TrackingRow = { locationId: string | null; deliveryInfoId: string }

/**
 * FIX R85-H2: Vrne true, če je zapis dokazljivo v scope-u lokacijskega
 * uporabnika. Veriga dokazov: (1) lastni tracking.locationId, (2) izpeljava
 * deliveryInfo.order.locationId. NULL brez izpeljive lokacije → false
 * (fail-closed — ne ugibamo). Super-admin klice ta guard ne (scope null).
 */
export async function isTrackingInScope(tracking: TrackingRow, scopeLocationId: string): Promise<boolean> {
  if (tracking.locationId) return tracking.locationId === scopeLocationId
  const deliveryInfo = await db.deliveryInfo.findUnique({
    where: { id: tracking.deliveryInfoId },
    select: { order: { select: { locationId: true } } },
  })
  return deliveryInfo?.order?.locationId === scopeLocationId
}
