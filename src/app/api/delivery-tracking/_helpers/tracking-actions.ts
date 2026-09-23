// Delivery tracking — Status update in driver assignment

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { notInScopeResponse } from '@/lib/tenant-scope'
import { isTrackingInScope } from './tracking-queries'
// FIX R112 (WEBHOOK-5, MED): enoten vir prehodov statusov dostave (voznikova
// + ročna UI pot) — prej je ta helper pisal status NEPOGOJENO (brez prehodnega
// pravila, brez CAS) → regresija delivered → picked_up ob dupliranih/izven
// reda sporočilih voznika.
import {
  canTransitionDeliveryStatus,
  STALE_DELIVERY_STATUS_MESSAGE,
} from '@/app/api/delivery/_helpers/status-transitions'

// ============================================
// STATUS UPDATE HELPER
// ============================================

// Strukturirani { error, status } throws iz tx telesa (R103 kontrakt) →
// NextResponse; P2034 → 409 stale; ostalo pade naprej v route catch.
function structuredToResponse(error: unknown): NextResponse | null {
  if (
    error &&
    typeof error === 'object' &&
    'error' in error &&
    'status' in error &&
    typeof (error as { error: unknown }).error === 'string' &&
    typeof (error as { status: unknown }).status === 'number'
  ) {
    const structured = error as { error: string; status: number }
    return NextResponse.json({ error: structured.error }, { status: structured.status })
  }
  return null
}

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

  // FIX R112 (WEBHOOK-5): hitri preveri prehod (400 — Slovenian message);
  // AVTORITATIVNA preverba je tx-fresh ZNOTRAJ transakcije spodaj.
  if (!canTransitionDeliveryStatus(tracking.status, status)) {
    return NextResponse.json(
      { error: `Neveljaven prehod statusa dostave: ${tracking.status} → ${status}` },
      { status: 400 }
    )
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
  // FIX R112 (WEBHOOK-5, MED — last-writer-wins razred iz R100–R111): prej sta
  // bila tx.deliveryTracking.update + tx.deliveryInfo.update NEPOGOJENA —
  // 3 nepovezani writerji (voznik, ročna UI pot PUT /api/delivery/[id],
  // dodelitev voznika) so tekmovali last-writer-wins → regresija
  // delivered → picked_up. Sedaj: tx-fresh status read + CAS
  // updateMany ({ where: { id, status: <freshStatus> } }) na OBEH vrsticah +
  // preverba prehoda prek skupne mape (status-transitions.ts). count 0 →
  // strukturirana 409 'Status dostave je v medčasom spremenjen — osvežite'.
  const deliveryStatusMap: Record<string, string> = {
    assigned: 'pending', picked_up: 'picked_up', on_the_way: 'picked_up',
    arriving: 'picked_up', delivered: 'delivered', failed: 'failed',
  }
  const nextInfoStatus = deliveryStatusMap[status] || status

  let updated: { driverName: string; estimatedArrival: Date | null } | null
  try {
    updated = await db.$transaction(async (tx) => {
      // tx-fresh status read — zastarel pre-read izven tx NE sme odločati
      const fresh = await tx.deliveryTracking.findUnique({ where: { deliveryInfoId } })
      if (!fresh) {
        throw { error: 'Sledenje ne obstaja', status: 404 }
      }
      if (!canTransitionDeliveryStatus(fresh.status, status)) {
        throw { error: `Neveljaven prehod statusa dostave: ${fresh.status} → ${status}`, status: 400 }
      }

      // CAS na DeliveryTracking (count 0 = concurrent writer je zmagal)
      const casTracking = await tx.deliveryTracking.updateMany({
        where: { id: fresh.id, status: fresh.status },
        data: updateData,
      })
      if (casTracking.count === 0) {
        throw { error: STALE_DELIVERY_STATUS_MESSAGE, status: 409 }
      }

      // DeliveryInfo: tx-fresh read + prehod + CAS — brez tega bi ročna UI pot
      // (delivered) lahko bila REGRESIRANA na picked_up prek voznikove preslikave.
      const freshInfo = await tx.deliveryInfo.findUnique({
        where: { id: deliveryInfoId },
        select: { id: true, status: true },
      })
      if (freshInfo) {
        if (!canTransitionDeliveryStatus(freshInfo.status, nextInfoStatus)) {
          throw { error: STALE_DELIVERY_STATUS_MESSAGE, status: 409 }
        }
        const casInfo = await tx.deliveryInfo.updateMany({
          where: { id: deliveryInfoId, status: freshInfo.status },
          data: {
            status: nextInfoStatus,
            ...(status === 'delivered' ? { actualTime: new Date() } : {}),
          },
        })
        if (casInfo.count === 0) {
          throw { error: STALE_DELIVERY_STATUS_MESSAGE, status: 409 }
        }
      }

      // Ponovno branje za odgovor (ista vrstica — CAS je pravkar uspel;
      // enaka oblika polj kot prejšnji update() povratni zapis)
      return tx.deliveryTracking.findUnique({ where: { deliveryInfoId } })
    })
  } catch (error: unknown) {
    const structured = structuredToResponse(error)
    if (structured) return structured
    // P2034 → 409 (canonical mapping; brambni globini pod READ COMMITTED se
    // ne sproži, ostaja za varnost pri morebitni izolacijski nadgradnji)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: STALE_DELIVERY_STATUS_MESSAGE }, { status: 409 })
    }
    throw error
  }

  if (!updated) {
    return NextResponse.json({ error: 'Sledenje ne obstaja' }, { status: 404 })
  }

  // Sproži webhook
  try {
    const deliveryInfo = await db.deliveryInfo.findUnique({ where: { id: deliveryInfoId }, include: { order: true } })
    if (deliveryInfo?.order) {
      const { emitEvent } = await import('@/lib/event-emitter')
      await emitEvent('delivery.status_changed', {
        orderId: deliveryInfo.order.id,
        orderNumber: String(deliveryInfo.order.orderNumber),
        status,
        driverName: updated.driverName,
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
