// ============================================
// GET /api/delivery/assignments — voznikovo delovno okno
// R137-b (epic #115 P1-13) — pariteta KDS polling vzorca
// ============================================
// ENA GET ruta, dva seznama (kontrakt za voznikovo UI — src/app/driver):
//   mine  = moja AKTIVNA dostavna opravila (DeliveryTracking.driverEmployeeId
//           = seja; status assigned/picked_up/on_the_way/arriving),
//   ready = dostave PRIpravljene za prevzem (naročilo type 'delivery', status
//           pending/in-progress/ready, tracking BREZ voznika).
//
// Varnostne lastnosti (kanon R85-H2/R86-2b/R137-a):
//   1. Auth + permission: requireAuth take_orders (isti kontrakt kot ostale
//      dostavne rute; nova 'manage_delivery' NI v permission matriki).
//   2. Tenant scope fail-closed: resolveTenantLocationIdOrThrow (kanon iz
//      delivery-tracking GET) — brez dokazljive lokacije NI ready seznama;
//      scope error se prenaša 1:1 (404, brez oraklja).
//   3. SELECT WHITELIST — nikoli Order.customerName/customerEmail/notes/
//      totals (PII/cenik ne potujeta); naslov + telefon prejemnika so
//      voznikov poklic; Check.total potuje SAMO za COD znesek pri vratih.
//   4. driverEmployeeId pride IZKLJUČNO iz seje — ?driverName= filter NE
//      obstaja (prej name-contains ugibanje, sedaj identiteta iz seje).
//   5. take 50 + determinističen orderBy (anti-DoS cap, FIFO po času).
//   6. Standalone dostava (brez ordera) je za voznika neuporabna —
//      izključena iz obeh seznamov (order: { isNot: null } filter).
//
// OPOMBA sheme: DeliveryTracking NIMA Prisma relacije do DeliveryInfo
// (deliveryInfoId je soft-FK @unique brez @relation) — zato dvokoračno
// branje + sestavljanje v pomnilniku (isti batch vzor kot FIX N+1 v
// tracking-queries.ts), ne relacijski include.
// ============================================

import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Aktivni voznikovi statusi (terminalna delivered/failed so IZVEN delovnega okna)
const MY_ACTIVE_STATUSES = ['assigned', 'picked_up', 'on_the_way', 'arriving'] as const

// Še odprti statusi naročila za 'ready' prevzem (completed/cancelled NIKOLI)
const OPEN_ORDER_STATUSES = ['pending', 'in-progress', 'ready'] as const

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // Tenant scope (fail-closed) — isti resolver kot delivery-tracking GET
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/delivery/assignments',
    })
    if ('error' in scope) return scope.error

    // R137-b: identiteta voznika IZ SEJE (requireAuth jo zagotavlja; ob
    // nedoločeni employeeId — sistemski rob — mine ostane prazen, ready deluje)
    const driverId = authResult.session?.employeeId

    // ---------- MINE: moja aktivna dostavna opravila ----------
    const mineTrackings = driverId
      ? await db.deliveryTracking.findMany({
          where: { driverEmployeeId: driverId, status: { in: [...MY_ACTIVE_STATUSES] } },
          orderBy: { assignedAt: 'asc' },
          take: 50,
          select: {
            deliveryInfoId: true, status: true, assignedAt: true, pickedUpAt: true,
            onTheWayAt: true, estimatedArrival: true, driverName: true, podNotes: true,
          },
        })
      : []

    // Standalone dostava (brez ordera) = za voznika neuporabna → izključena
    const mineInfos = mineTrackings.length > 0
      ? await db.deliveryInfo.findMany({
          where: { id: { in: mineTrackings.map(t => t.deliveryInfoId) }, order: { isNot: null } },
          select: {
            id: true, address: true, city: true, postCode: true,
            recipientName: true, recipientPhone: true, deliveryInstructions: true,
            status: true, estimatedTime: true,
            order: {
              select: {
                id: true, orderNumber: true, status: true, paymentStatus: true,
                type: true, locationId: true, createdAt: true,
                checks: { select: { total: true, paymentStatus: true }, orderBy: { checkNumber: 'asc' }, take: 1 },
              },
            },
          },
        })
      : []
    const mineInfoMap = new Map(mineInfos.map(info => [info.id, info]))
    const mine = mineTrackings
      .filter(t => mineInfoMap.has(t.deliveryInfoId))
      .map(t => ({ ...t, deliveryInfo: mineInfoMap.get(t.deliveryInfoId) }))

    // ---------- READY: pripravljeno za prevzem (brez voznika) ----------
    const readyInfos = await db.deliveryInfo.findMany({
      where: {
        order: {
          // R86-2b kanon: conditional spread — super-admin (null scope) vidi
          // globalno, lokacijski uporabnik SAMO svojo lokacijo (fail-closed)
          ...(scope.locationId ? { locationId: scope.locationId } : {}),
          type: 'delivery',
          status: { in: [...OPEN_ORDER_STATUSES] },
        },
      },
      orderBy: { order: { createdAt: 'asc' } },
      take: 50,
      select: {
        id: true, address: true, city: true, postCode: true,
        recipientName: true, recipientPhone: true, deliveryInstructions: true,
        status: true, estimatedTime: true,
        order: {
          select: {
            id: true, orderNumber: true, status: true, paymentStatus: true,
            type: true, locationId: true, createdAt: true,
            checks: { select: { total: true, paymentStatus: true }, orderBy: { checkNumber: 'asc' }, take: 1 },
          },
        },
      },
    })

    // Brez voznika = tracking ne obstaja ALI je prazen (dodelitev VEDNO zapiše
    // driverName in/ali driverEmployeeId — free-text in self-claim obe poti)
    const readyTrackings = readyInfos.length > 0
      ? await db.deliveryTracking.findMany({
          where: { deliveryInfoId: { in: readyInfos.map(i => i.id) } },
          select: { deliveryInfoId: true, driverName: true, driverEmployeeId: true },
        })
      : []
    const assignedIds = new Set(
      readyTrackings.filter(t => t.driverName !== '' || t.driverEmployeeId !== null).map(t => t.deliveryInfoId),
    )
    const ready = readyInfos.filter(info => !assignedIds.has(info.id))

    return NextResponse.json({ mine, ready, timestamp: new Date().toISOString() })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/delivery/assignments', 'Napaka pri pridobivanju dostavnih opravil')
  }
}
