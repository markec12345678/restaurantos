// Delivery tracking — Status update in driver assignment

import { db, createAuditLog } from '@/lib/db'
// R139: WS push — coarse refetch signal za voznikov zaslon (isti proces
// custom server; next dev/Vercel = __wsBroadcast undefined → tiho preskoči)
import { wsBroadcastEvent } from '@/lib/ws-server-broadcast'
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

// R137-b (P1-13): podNotes (POD opomba voznika) + cashCollected (gotovina
// pobrana ob dostavi) — oba opcijska, relevantna SAMO za 'delivered' vejo.
export async function handleStatusUpdate(
  deliveryInfoId: string,
  status: string,
  customerRating?: number,
  customerFeedback?: string,
  scopeLocationId: string | null = null,
  podNotes?: string,
  cashCollected?: boolean,
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
      // R137-b (P1-13): POD opomba voznika (customerFeedback ostane ocena GOSTA)
      if (podNotes) updateData.podNotes = podNotes
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
      // R137-b: forenzika close-outa (lokalni akumulator znotraj tx)
      let deliveredAudit: { orderId: string; locationId: string | null } | null = null
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
      // R137-b (P1-13): select razširjen z order (tx-fresh) za close-out —
      // DeliveryInfo NIMA orderId skalarnega polja (FK deliveryInfoId živi na
      // Order), zato se order bere prek back-relacije v ISTEM poizvedbenem
      // koraku (ceneje kot ločen tx.order.findUnique, enako tx-fresh).
      const freshInfo = await tx.deliveryInfo.findUnique({
        where: { id: deliveryInfoId },
        select: {
          id: true, status: true,
          order: { select: { id: true, status: true, paymentStatus: true, locationId: true, type: true } },
        },
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

        // R137-b (P1-13) DELIVERED CLOSE-OUT — samo 'delivered', šele PO uspelem
        // CAS-u na obeh dostavnih vrsticah (obstoječa CAS logika se NE spreminja):
        //   1. Order.status pending/in-progress/ready → 'completed' (CAS-ovski
        //      pogojni updateMany — NIKOLI ne downgradiraj completed/cancelled;
        //      guard na tx-fresh statusu, pogoj tudi v where klavzuli).
        //   2. cashCollected === true → neplačani Checki + Order.paymentStatus
        //      unpaid → 'paid' (COD zaprtje po online-order kanonu; check lahko
        //      ne obstaja — webhook dostava je že paid — updateMany no-op je pravilen).
        if (status === 'delivered' && freshInfo.order) {
          const openOrderStatuses = ['pending', 'in-progress', 'ready']
          const order = freshInfo.order
          if (openOrderStatuses.includes(order.status)) {
            await tx.order.updateMany({
              where: { id: order.id, status: { in: openOrderStatuses } },
              data: { status: 'completed' },
            })
          }
          if (cashCollected === true) {
            await tx.check.updateMany({
              where: { orderId: order.id, paymentStatus: 'unpaid' },
              data: { paymentStatus: 'paid' },
            })
            await tx.order.updateMany({
              where: { id: order.id, paymentStatus: 'unpaid' },
              data: { paymentStatus: 'paid' },
            })
          }
          deliveredAudit = { orderId: order.id, locationId: order.locationId }
        }
      }

      // R137-b (P1-13): audit log 'delivery_delivered' — ZNOTRAJ tx (atomarno
      // s prehodom: audit obstaja ⇔ prehod obstaja; createAuditLog(entry, tx)
      // kanon — hash veriga beremo in pišemo v isti transakciji). Samo
      // 'delivered' prehod ga sproži (tudi standalone brez ordera — orderId null).
      if (status === 'delivered') {
        const auditLocationId = deliveredAudit?.locationId ?? tracking.locationId ?? null
        await createAuditLog({
          action: 'delivery_delivered',
          entityType: 'delivery',
          entityId: deliveryInfoId,
          details: {
            podNotes: podNotes ?? null,
            cashCollected: cashCollected === true,
            orderId: deliveredAudit?.orderId ?? null,
            locationId: auditLocationId,
          },
          locationId: auditLocationId,
        }, tx)
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
    // R139: WS push voznikovemu zaslonu — coarse refetch signal. Payload
    // whitelist = ids/status/locationId (NIKOLI PII — PII ostane za
    // GET /api/delivery/assignments whitelist). wsBroadcastEvent je
    // fire-and-forget (napake požere sam) — ne sme vplivati na odgovor.
    // locationId poganja per-location fan-out na strežniku (server.js
    // broadcastEvent) — brez njega bi signal ušel tujim lokacijam.
    wsBroadcastEvent('DELIVERY_UPDATED', {
      deliveryInfoId,
      reason: 'status_changed',
      status,
      locationId: deliveryInfo?.order?.locationId ?? null,
    })
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

// R137-b (P1-13) SELF-CLAIM: driverName/driverPhone/vehicleInfo so izbirni —
// manjkajoč/prazen driverName = voznik si dostavo prevzame SAM: identiteta
// pride IZKLJUČNO iz seje (userId = Session.employeeId, route ga že pošilja),
// driverEmployeeId se NIKOLI ne sprejme od klienta. Legacy dispatcher pot
// (prosto besedilo) ostane nespremenjena.
export async function handleAssignDriver(
  deliveryInfoId: string,
  driverName?: string,
  driverPhone?: string,
  vehicleInfo?: string,
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

  // R137-b (P1-13): resolvanje identitete voznika. Prazen/manjkajoč driverName
  // = SELF-CLAIM → ime (in telefon, če klient ni podal svojega) iz Employee
  // zapisa seje. Manjkajoča seja ALI neobstoječ zaposleni → 400 'Voznik ni
  // najden' (IZBRANI hišni kontrakt: 400, ker je napaka rešljiva na strani
  // klicatelja — seja nima veljavne voznikove identitete; 404 bi lažno
  // sugeriral, da dostava ne obstaja, ki obstaja).
  let resolvedName = typeof driverName === 'string' ? driverName.trim() : ''
  let resolvedPhone = typeof driverPhone === 'string' ? driverPhone.trim() : ''
  const resolvedVehicle = typeof vehicleInfo === 'string' ? vehicleInfo.trim() : ''
  if (!resolvedName) {
    if (!userId) return NextResponse.json({ error: 'Voznik ni najden' }, { status: 400 })
    const employee = await db.employee.findUnique({
      where: { id: userId },
      select: { name: true, phone: true },
    })
    if (!employee) return NextResponse.json({ error: 'Voznik ni najden' }, { status: 400 })
    resolvedName = employee.name
    if (!resolvedPhone) resolvedPhone = employee.phone
  }

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
      // R137-b (P1-13) idempotency guard #1 (obstoječ, nespremenjen): drugo
      // ime na zasedeni dostavi → 409 DRIVER_ALREADY_ASSIGNED.
      if (existing.driverName && existing.driverName !== resolvedName) {
        throw new Error('DRIVER_ALREADY_ASSIGNED')
      }
      // R137-b (P1-13) idempotency guard #2 (NOV): drug employeeId na zasedeni
      // dostavi → 409. Pokrije dva različna zaposlena z ISTIM imenom (guard #1
      // ne ujame) in zapre race okno dveh sočasnih self-claimov.
      if (existing.driverEmployeeId && existing.driverEmployeeId !== userId) {
        throw new Error('DRIVER_ALREADY_ASSIGNED')
      }
      isUpdate = true
      const updated = await tx.deliveryTracking.update({
        where: { deliveryInfoId },
        data: {
          driverName: resolvedName, driverPhone: resolvedPhone, vehicleInfo: resolvedVehicle,
          status: 'assigned', assignedAt: new Date(),
          // R137-b (P1-13): vezava voznika IZ SEJE (nikoli od klienta). Legacy
          // free-text update jo žigosi na klicatelja (kdo je dodelil).
          driverEmployeeId: userId ?? null,
          // FIX R85-H2: self-heal žigosanje legacy NULL locationId
          ...(scopeLocationId && !existing.locationId ? { locationId: stampLocationId } : {}),
        },
      })
      return updated
    }

    const created = await tx.deliveryTracking.create({
      data: {
        deliveryInfoId, driverName: resolvedName, driverPhone: resolvedPhone, vehicleInfo: resolvedVehicle,
        status: 'assigned', assignedAt: new Date(),
        estimatedArrival: new Date(Date.now() + 30 * 60 * 1000),
        // R137-b (P1-13): vezava voznika IZ SEJE (nikoli od klienta)
        driverEmployeeId: userId ?? null,
        // FIX R85-H2: žigosanje lokacije ob ustvarjanju (prej vedno NULL)
        locationId: stampLocationId,
      },
    })

    await tx.deliveryInfo.update({
      where: { id: deliveryInfoId },
      data: { courierName: resolvedName, courierPhone: resolvedPhone, status: 'preparing' },
    })

    return created
  })

  if (outOfScope) return notInScopeResponse('Sledenje')

  await createAuditLog({
    action: 'driver_assigned',
    entityType: 'delivery',
    // R137-b (P1-13): details dopolnjen z driverEmployeeId (self-claim vezava)
    details: {
      driverName: resolvedName,
      message: `Voznik ${resolvedName} dodeljen dostavi`,
      locationId: stampLocationId,
      ...(userId ? { driverEmployeeId: userId } : {}),
    },
    userId,
  })

  // R139: WS push — voznik dodeljen (self-claim ALI legacy dispatcher v enem
  // mestu). Coarse refetch signal; payload whitelist brez PII (ime/telefon
  // voznika so že v audit logu, klient jih dobi prek assignments rute).
  wsBroadcastEvent('DELIVERY_UPDATED', {
    deliveryInfoId,
    reason: 'assigned',
    status: 'assigned',
    locationId: stampLocationId,
  })

  return NextResponse.json(result, { status: isUpdate ? 200 : 201 })
}
