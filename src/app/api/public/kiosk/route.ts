// POST /api/public/kiosk — Self-service kiosk ordering (brez auth, rate-limited)
// Stranka na kiosku izbere artikle in plača — ustvari order + payment
import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, KIOSK_LIMIT, PUBLIC_MENU_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { getNextOrderNumber } from '@/lib/counters'
import { notInScopeResponse } from '@/lib/tenant-scope'
import { buildOrderItemsData, calculateOrderTotals, fetchModifierPriceMap, type MenuItemVatMap } from '@/app/api/orders/_helpers/order-items'
import { Prisma } from '@prisma/client'
import { z } from 'zod'


import { formatEUR } from '@/lib/safe-format'
const kioskOrderSchema = z.object({
  orderItems: z.array(z.object({
    menuItemId: z.string().min(1),
    quantity: z.number().int().min(1).max(99),
    notes: z.string().max(200).default(''),
  })).min(1, 'Naročilo mora vsebovati vsaj en artikel'),
  diningOption: z.enum(['dine-in', 'takeout']).default('takeout'),
  tableNumber: z.string().max(10).optional(),
  customerName: z.string().max(100).default('Kiosk'),
  paymentMethod: z.enum(['cash', 'card']).default('card'),
  // FIX P4: idempotency key — brez njega React Query retry ustvari duplikat
  // (kiosk je javna naprava — network retry-ji so pogosti)
  idempotencyKey: z.string().max(100).optional(),
  // R86-3 (M4): izrecen lokacijski kontekst kioska — query ?locationId ima
  // prednost (konsistentno z GET); brez obeh → POST fail-closed 400.
  locationId: z.string().max(50).optional(),
})

export const dynamic = 'force-dynamic'

// R86-3 (M4): ENOTNA validacija izrecnega lokacijskega konteksta (GET + POST).
// Kiosk je javna ruta BREZ seje/API-ključa → edini veznik je ekspliciten,
// obstoječ in AKTIVEN locationId (isti kanon kot public/delivery-check R83:
// location.findFirst({ id, isActive: true })). Neznana / tuja / neaktivna /
// neveljavna oblika → IZKLJUČENO notInScopeResponse('Lokacija') 404 — isti
// odgovor za "ne obstaja" in "tuja" (ni obstoja-oraklja, ni uhajanja menija
// tujega tenanta). NIKOLI globalnega resolveDefaultLocationId() za pisno pot.
async function resolveKioskLocation(
  explicitId: string | null,
): Promise<{ ok: true; locationId: string } | { ok: false; response: NextResponse }> {
  if (!explicitId || !/^[a-z0-9]{5,50}$/i.test(explicitId)) {
    return { ok: false, response: notInScopeResponse('Lokacija') }
  }
  const location = await db.location.findFirst({
    where: { id: explicitId, isActive: true },
    select: { id: true },
  })
  if (!location) return { ok: false, response: notInScopeResponse('Lokacija') }
  return { ok: true, locationId: location.id }
}

export async function GET(req: Request) {
  // FIX SECURITY: dodaj rate limit na GET (menu fetch) — prejšnja koda ni bila
  // omejena, napadalec je lahko z metal DB poizvedbami in izčrpal povezave.
  // Kiosk tipično naloži meni ob zagonu, 30 req/min je več kot dovolj.
  const rl = await checkRateLimitAsync('kiosk-menu', getClientIp(req), PUBLIC_MENU_LIMIT)
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')
  }

  try {
    // R83 fix: prej GLOBALNI meni VSEH tenantov (where samo isActive) — kiosk
    // na lokaciji A je prikazoval artikle/cene/DDV vseh lokacij. Zdaj: scope
    // na lokacijo kioska. R86-3 (M4): izrecen ?locationId je POLNO validiran
    // (obstaja + aktiven — prej samo regex oblike); neznana/tuja/neaktivna →
    // notInScopeResponse 404. R90: READ fallback izkoreninjen — P0-C3B kanon
    // zaprt tudi za GET. Manjkajoč ?locationId → notInScopeResponse 404 PRED
    // vsakim db klicem (ZERO db — prej: resolveDefaultLocationId() = prva
    // aktivna lokacija KATEREGA KOLI tenanta; stara 'Kiosk ni nastavljen' 400
    // pot za manjkajoč parameter odstranjena — POST jo še vedno proizvaja
    // za pisno pot).
    const url = new URL(req.url)
    const paramLocationId = url.searchParams.get('locationId')?.trim() || null
    if (!paramLocationId) {
      return notInScopeResponse('Lokacija')
    }
    const resolved = await resolveKioskLocation(paramLocationId)
    if (!resolved.ok) return resolved.response
    const kioskLocationId = resolved.locationId
    // Vrni meni za kiosk (samo aktivni artikli z alergeni)
    const menu = await db.menu.findMany({
      where: { isActive: true, locationId: kioskLocationId },
      include: {
        categories: {
          where: { menuItems: { some: { isAvailable: true } } },
          include: {
            menuItems: {
              where: { isAvailable: true },
              select: {
                id: true, name: true, description: true, price: true,
                vatRate: true, allergens: true, image: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json({ menus: menu })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/public/kiosk', 'Napaka pri pridobivanju menija')
  }
}

export async function POST(req: Request) {
  // `data` deklariran zunaj try — dostopen v catch za idempotent replay pri P2002
  let data: z.infer<typeof kioskOrderSchema> | undefined
  // R83: lokacija tudi v catch (P2002 replay lookup mora biti scoped)
  let kioskLocationId: string | null = null
  try {
    // Rate limiting — prepreči zlorabo kioska
    const rl = await checkRateLimitAsync('kiosk-order', getClientIp(req), KIOSK_LIMIT)
    if (!rl.allowed) {
      return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')
    }

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    try { data = kioskOrderSchema.parse(bodyResult.data) } catch (_e) { return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 }) }
    if (!data) return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })

    // R83 fix: lokacija se mora rešiti PRED fetchom artiklov (prej je bil
    // menuItem fetch globalen — tuji artikli/cene/DDV v naročilu na privzeti
    // lokaciji) in Artikli morajo biti scope-ani na menu te lokacije.
    // P1-6: kiosk naprava stoji na lokaciji.
    // R86-3 (M4) FIX MEDIUM, fail-closed: POST NIKOLI več uporabi globalnega
    // resolveDefaultLocationId() fallbacka (prej: VEDNO prva aktivna lokacija
    // KATEREGA KOLI tenanta = cross-tenant žig naročila, tuj per-lokacijski
    // order counter, tuj KDS; GET je sprejel ?locationId, POST ga je
    // ignoriral). Ekspliciten kontekst je OBVEZEN: ?locationId (query,
    // konsistentno z GET) ali body.locationId; manjka → 400 (naročilo brez
    // lokacije bi bilo tiho izgubljeno za tenant poizvedbe), neznana/tuja/
    // neaktivna → 404 notInScopeResponse (isti odgovor — ni oraklja).
    const url = new URL(req.url)
    const explicitLocationId =
      url.searchParams.get('locationId')?.trim() || data.locationId || null
    if (!explicitLocationId) {
      return NextResponse.json(
        { error: 'Kiosk ni nastavljen — kontaktirajte osebje' },
        { status: 400 },
      )
    }
    const kioskLoc = await resolveKioskLocation(explicitLocationId)
    if (!kioskLoc.ok) return kioskLoc.response
    kioskLocationId = kioskLoc.locationId

    // Pridobi meni artikle za izračun — R83: scoped na lokacijo kioska
    // (category.menu.locationId — isti relacijski filter kot R82-C online-order)
    const menuItemIds = data.orderItems.map(oi => oi.menuItemId)
    const menuItems = await db.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        isAvailable: true,
        category: { menu: { locationId: kioskLocationId } },
      },
      select: { id: true, name: true, price: true, vatRate: true },
    })

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json({ error: 'Nekateri artikli niso na voljo' }, { status: 400 })
    }

    // P1-8 FIX KRITIČNO: kiosk je prej ceno obravnal kot GROSS (neto = cena − DDV),
    // medtem ko jeMenuItem.price po definiciji sistema NETO (QR meni prikazuje
    // € × (1 + DDV/100); POS izračun: total = subtotal + DDV). Kiosk je s tem
    // zaračunaval MANJ kot POS za isti artikel — neusklajeno z računi/DB.
    // Sedaj: ISTI kanonični izračun (buildOrderItemsData + calculateOrderTotals).
    const vatMap = new Map<string, MenuItemVatMap>(menuItems.map(mi => [mi.id, mi]))
    // FIX BUG-13: DB cene modifierjev (server-authoritative) — kiosk meni pogosto uporablja dodatke
    const modifierPriceMap = await fetchModifierPriceMap(menuItemIds, kioskLocationId, db)
    for (const [miId, modPrices] of modifierPriceMap) {
      const entry = vatMap.get(miId)
      if (entry) entry.modifierPrices = modPrices
    }
    const { orderItemsData, subtotal } = buildOrderItemsData(data.orderItems, vatMap, 0)
    const { totalTax: tax, total } = calculateOrderTotals(orderItemsData, subtotal)

    // P1-7: per-lokacijsko številčenje naročil (self-init iz MAX)
    const nextOrderNumber = await getNextOrderNumber(kioskLocationId)

    // P1-8: idempotencyKey — vedno prisoten (auto), klient lahko pošlje svojega
    const idempotencyKey = data.idempotencyKey ||
      `auto-kiosk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    // FIX CRITICAL (Test 3.2 parity): vrni obstoječe naročilo pri replay-u
    // R83: scoped na lokacijo kioska — idempotencyKey je globalno @unique
    // (namespace trči med tenanti); replay tujega ključa ne sme razkriti
    // tujega naročila (orderNumber/total/items).
    const existingOrder = await db.order.findFirst({
      where: { idempotencyKey, locationId: kioskLocationId },
      select: { id: true, orderNumber: true, total: true, orderItems: { select: { id: true } } },
    })
    if (existingOrder) {
      return NextResponse.json({
        success: true,
        orderId: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        total: toNum(existingOrder.total),
        items: existingOrder.orderItems.length,
        message: `Naročilo #${existingOrder.orderNumber} že obstaja — plačaj ${formatEUR(toNum(existingOrder.total).toFixed(2))}`,
        idempotentReplay: true,
      }, { status: 200 })
    }

    // Ustvari naročilo (dine-in za mizo, takeout za s seboj)
    const order = await db.order.create({
      data: {
        orderNumber: nextOrderNumber,
        idempotencyKey,
        type: data.diningOption,
        status: 'pending',
        customerName: data.customerName,
        subtotal,
        tax,
        total,
        totalWithTip: total,
        paymentStatus: 'unpaid',
        paymentMethod: '',
        locationId: kioskLocationId,
        orderItems: {
          // OrderItemData (z menuItemId skalarjem) — isti unchecked vzorec kot POS post-handler
          create: (
            orderItemsData.map(oid => ({
              ...oid,
              menuItemName: menuItems.find(m => m.id === oid.menuItemId)?.name ?? '',
            })) as Prisma.OrderItemUncheckedCreateInput[]
          ),
        },
      },
      include: { orderItems: true },
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: toNum(order.total),
      items: order.orderItems.length,
      message: `Naročilo #${order.orderNumber} ustvarjeno na kiosku — plačaj ${formatEUR(toNum(order.total).toFixed(2))}`,
    }, { status: 201 })
  } catch (error: unknown) {
    // P2002 (idempotencyKey race): dva vzporedna klica z istim ključem —
    // drugi dobi unique violation → vrni obstoječe naročilo (200, ne 500)
    if (
      error && typeof error === 'object' && 'code' in error &&
      (error as { code?: string }).code === 'P2002' && data?.idempotencyKey
    ) {
      // R83: replay lookup mora biti lokacijsko scoped (nikoli tujega naročila);
      // brez lokacije (P2002 pred resolucijo ni možen za order.create) → generičen 409
      if (kioskLocationId) {
        const existing = await db.order.findFirst({
          where: { idempotencyKey: data.idempotencyKey, locationId: kioskLocationId },
          select: { id: true, orderNumber: true, total: true, orderItems: { select: { id: true } } },
        })
        if (existing) {
          return NextResponse.json({
            success: true,
            orderId: existing.id,
            orderNumber: existing.orderNumber,
            total: toNum(existing.total),
            items: existing.orderItems.length,
            message: `Naročilo #${existing.orderNumber} že obstaja — plačaj ${formatEUR(toNum(existing.total).toFixed(2))}`,
            idempotentReplay: true,
          }, { status: 200 })
        }
      }
      // R83: P2002 na tujem idempotencyKey (druga lokacija) — NIKOLI ne razkrij
      // tujega naročila; generičen 409 (isti kanon kot R82-C mobile/order)
      return NextResponse.json({ error: 'Naročilo s tem ključem že obstaja' }, { status: 409 })
    }
    return handleApiError(error, 'POST /api/public/kiosk', 'Napaka pri kiosk naročilu')
  }
}
