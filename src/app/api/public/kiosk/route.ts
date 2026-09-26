// POST /api/public/kiosk — Self-service kiosk ordering (token-bound, rate-limited)
// R135 (epic #115 P1-11): stranka na kiosku izbere artikle (+ modifierje),
// odda naročilo in plača — order + Check + Payment (kartica) / plačilo pri
// blagajni (gotovina) + odbitek zaloge, vse v eni transakciji.
//
// R135 varnostni kanon (zrcali online-order R88):
//  - pisna pot je vezana na per-lokacijski HMAC ordering token
//    (`v1:<tokenVersion>:<hmac64>`, izdaja/rotacija prek
//    /api/locations/[id]/ordering-token) — token = vezava kioska na lokacijo;
//    rotacija (Location.tokenVersion++) instant umre vse stare kioske.
//  - produkcija brez ordering secret → 503 fail-closed (R82-D kanon).
//  - sold-out enforcement na POST (R124 kanon — ista stock mapa kot GET/POS).
//  - odbitek zaloge znotraj transakcije (isti helper kot QR javna pot).
//  - opcionalen deviceId → DeviceRegistry upsert (type 'kiosk') — naprava se
//    registrira sama ob vsakem uspešnem naročilu (heartbeat lastSeenAt).
// GET ostane anonimen (samo javni meni podatki — isti kanon kot public/menu),
// z modifierGroups (P1-11: kiosk mora ponuditi dodatke).
import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { computeMenuStockMap, type MenuStockMap } from '@/lib/availability/menu-availability'
import { checkRateLimitAsync, getClientIp, KIOSK_LIMIT, PUBLIC_MENU_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { getNextOrderNumber, getNextCounter } from '@/lib/counters'
import { notInScopeResponse } from '@/lib/tenant-scope'
import { verifyOrderingToken, isOrderingSecretConfigured } from '@/lib/ordering-token'
import { isRestaurantOpen, deductInventoryInTx, MAX_ORDER_TOTAL } from '@/app/api/public/order/_helpers'
import { buildOrderItemsData, calculateOrderTotals, fetchModifierPriceMap, type MenuItemVatMap } from '@/app/api/orders/_helpers/order-items'
import { Prisma } from '@prisma/client'
import { z } from 'zod'


import { formatEUR } from '@/lib/safe-format'
const kioskOrderSchema = z.object({
  orderItems: z.array(z.object({
    menuItemId: z.string().min(1),
    quantity: z.number().int().min(1).max(99),
    notes: z.string().max(200).default(''),
    // R135 (P1-11): izbrani modifierji — isti format kot online-order
    // (JSON array { name, price }, ≤2000 znakov; strežnik cene vzame iz DB
    // prek fetchModifierPriceMap — client cena je samo fallback, BUG-13 kanon)
    modifiersJson: z.string().max(2000).optional(),
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
  // R135 (P1-11): OBVEZEN per-lokacijski ordering token (R89 format) —
  // vezava kioska na lokacijo; manjkajoč/tuj/rotiran → 404 notInScope
  // (isti odgovor kot neznana lokacija — ni oraklja).
  orderingToken: z.string().min(1).max(200).optional(),
  // R135 (P1-11): opcijska vezava naprave — DeviceRegistry upsert (type
  // 'kiosk', status 'online', lastSeenAt). Ni obvezen (token nosi varnost),
  // omogoča pa adminu pregled aktivnih kioskov v Settings → Naprave.
  deviceId: z.string().max(64).regex(/^[a-zA-Z0-9_-]+$/).optional(),
})

export const dynamic = 'force-dynamic'

// R86-3 (M4): ENOTNA validacija izrecnega lokacijskega konteksta (GET + POST).
// Kiosk je javna ruta BREZ seje/API-ključa → edini veznik je ekspliciten,
// obstoječ in AKTIVEN locationId (isti kanon kot public/delivery-check R83:
// location.findFirst({ id, isActive: true })). Neznana / tuja / neaktivna /
// neveljavna oblika → IZKLJUČENO notInScopeResponse('Lokacija') 404 — isti
// odgovor za "ne obstaja" in "tuja" (ni obstoja-oraklja, ni uhajanja menija
// tujega tenanta). NIKOLI globalnega resolveDefaultLocationId() za pisno pot.
// R135: select razširjen s tokenVersion (R89 — per-location revokacija).
async function resolveKioskLocation(
  explicitId: string | null,
): Promise<{ ok: true; locationId: string; tokenVersion: number } | { ok: false; response: NextResponse }> {
  if (!explicitId || !/^[a-z0-9]{5,50}$/i.test(explicitId)) {
    return { ok: false, response: notInScopeResponse('Lokacija') }
  }
  const location = await db.location.findFirst({
    where: { id: explicitId, isActive: true },
    select: { id: true, tokenVersion: true },
  })
  if (!location) return { ok: false, response: notInScopeResponse('Lokacija') }
  return { ok: true, locationId: location.id, tokenVersion: location.tokenVersion ?? 0 }
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
    // R135 (P1-11): modifierGroups v selectu (ista oblika kot public/menu) —
    // kiosk mora ponuditi dodatke (extra cheese itd.); samo isAvailable
    // modifierji, z alergeni (EU 1169/2011 kanon, ALLER-06/08).
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
                modifierGroups: {
                  select: {
                    sortOrder: true,
                    modifierGroup: {
                      select: {
                        id: true,
                        name: true,
                        required: true,
                        minSelect: true,
                        maxSelect: true,
                        modifiers: {
                          where: { isAvailable: true },
                          select: {
                            id: true,
                            name: true,
                            price: true,
                            allergens: true,
                          },
                          orderBy: { sortOrder: 'asc' },
                        },
                      },
                    },
                  },
                  orderBy: { sortOrder: 'asc' },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    // R124 (P0-03): sold-out propagation za kiosk — ista stock mapa kot
    // POS/QR (enoten kanon availability). Kiosk UI lahko gray-out izprodane.
    const kioskItemIds = menu.flatMap(m =>
      m.categories.flatMap(c => c.menuItems.map(i => i.id))
    )
    const stockMap: MenuStockMap = kioskItemIds.length > 0
      ? await computeMenuStockMap({ menuItemIds: kioskItemIds })
      : {}
    const menuWithStock = menu.map(m => ({
      ...m,
      categories: m.categories.map(c => ({
        ...c,
        menuItems: c.menuItems.map(i => {
          const stock = stockMap[i.id]
          return {
            ...i,
            stockStatus: stock?.status ?? 'ok',
            stockAvailable: stock ? stock.available : null,
            stockUnit: stock?.unit ?? null,
          }
        }),
      })),
    }))

    return NextResponse.json({ menus: menuWithStock })
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

    // R135 (P1-11) FIX HIGH, fail-closed: pisna pot kioska je zdaj vezana na
    // ordering token lokacije (R88 kanon iz online-order — prej je KDO KOLI z
    // veljavnim locationId žigal naročila). Produkcija brez ordering secret →
    // 503 PRED resolucijo (ni 404-vs-503 oraklja). Manjkajoč / napačen /
    // rotiran token → IZKLJUČNO notInScopeResponse('Lokacija') 404 (isti
    // odgovor kot neznana lokacija — ni oraklja, zero pisnih klicev).
    if (process.env.NODE_ENV === 'production' && !isOrderingSecretConfigured()) {
      return NextResponse.json(
        { error: 'Kiosk naročanje trenutno ni na voljo. Poskusite znova kasneje.' },
        { status: 503 },
      )
    }
    if (!data.orderingToken || !verifyOrderingToken(data.orderingToken, kioskLocationId, kioskLoc.tokenVersion)) {
      return notInScopeResponse('Lokacija')
    }

    // R135 (P1-11): gate odprtosti — isti kanon kot QR javna pot (urnik TOČNO
    // te lokacije, slovenski čas; brez urnika = zaprto, fail-closed).
    const isOpen = await isRestaurantOpen(kioskLocationId)
    if (!isOpen) {
      return NextResponse.json(
        { error: 'Restavracija je trenutno zaprta. Naročila niso mogoča.' },
        { status: 403 },
      )
    }

    // Pridobi meni artikle za izračun — R83: scoped na lokacijo kioska
    // (category.menu.locationId — isti relacijski filter kot R82-C online-order)
    // R135: include recipeItems+inventoryItem (odbitek zaloge v transakciji,
    // isti helper kot QR javna pot).
    const menuItemIds = data.orderItems.map(oi => oi.menuItemId)
    const menuItems = await db.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        isAvailable: true,
        category: { menu: { locationId: kioskLocationId } },
      },
      include: { recipeItems: { include: { inventoryItem: true } } },
    })

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json({ error: 'Nekateri artikli niso na voljo' }, { status: 400 })
    }

    // R135 (P1-11) FIX HIGH: sold-out enforcement na pisni poti — prej je
    // izprodan artikel mirno ustvaril naročilo (GET gray-out je bil edini
    // mehanizem). Isti R124 stock map kot GET/POS → 'out' artikel = 400
    // (brez transakcije, zero pisnih klicev). 'low' je dovoljen (isti kanon
    // kot POS — opozorilo, ne zapora).
    const orderedStockMap: MenuStockMap = await computeMenuStockMap({ menuItemIds })
    const soldOutItems = menuItems
      .filter(mi => orderedStockMap[mi.id]?.status === 'out')
      .map(mi => ({ menuItemId: mi.id, name: mi.name }))
    if (soldOutItems.length > 0) {
      return NextResponse.json(
        { error: 'Nekateri artikli so žal izprodani', unavailableItems: soldOutItems },
        { status: 400 },
      )
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

    // R135 (P1-11): zgornja meja zneska — isti kanon kot QR javna pot
    // (QR-02 HIGH: prepreči zlorabo javne naprave z absurdnimi zneski).
    if (total > MAX_ORDER_TOTAL) {
      return NextResponse.json(
        { error: `Naročilo presega maksimalni znesek ${formatEUR(MAX_ORDER_TOTAL)}. Zmanjšajte količino.` },
        { status: 400 },
      )
    }

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

    // R135 (P1-11): številka čeka (isti kanon kot online-order — Check nosi
    // plačilni kontekst; Q04: counter napaka = 503, ne atomski fallback).
    let nextCheckNumber: number
    try {
      nextCheckNumber = await getNextCounter('checkNumber')
    } catch (_counterErr: unknown) {
      return NextResponse.json({ error: 'Napaka pri generiranju številke čeka. Poskusite znova.' }, { status: 503 })
    }

    // R135 (P1-11): notes marker vira za KDS/osebje (kiosk je sicer prepoznaven
    // po customerName 'Kiosk', a notes nosi tudi kontekst mize/s seboj).
    const kioskNote = data.diningOption === 'dine-in' && data.tableNumber
      ? `Kiosk naročilo — miza ${data.tableNumber}`
      : 'Kiosk naročilo — s seboj'

    // R135 (P1-11): order + Check + Payment + odbitek zaloge v ENI transakciji
    // (isti kanon kot online-order createOnlineOrder / QR javna pot):
    //  - paymentMethod se ZDAJ persistira (prej ignoriran — schema je sprejela
    //    'cash'/'card', zapis je vedno nosil '' — plačilna semantika manjkala)
    //  - kartica → Payment status 'pending' (potrditev na terminalu/blagajni);
    //    gotovina → brez Payment vrstice (plačilo pri blagajni)
    //  - inventoryDeducted: true šele po uspešnem odbitku znotraj transakcije
    const paymentMethodLabel = data.paymentMethod === 'cash' ? 'gotovina' : 'kartica'
    const order = await db.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber: nextOrderNumber,
          idempotencyKey,
          type: data!.diningOption,
          status: 'pending',
          customerName: data!.customerName,
          notes: kioskNote,
          subtotal,
          tax,
          total,
          totalWithTip: total,
          paymentStatus: 'unpaid',
          paymentMethod: paymentMethodLabel,
          inventoryDeducted: false,
          locationId: kioskLocationId!,
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

      const check = await tx.check.create({
        data: {
          checkNumber: nextCheckNumber, orderId: newOrder.id,
          subtotal, tax, discount: 0,
          serviceCharge: 0,
          total,
          tip: 0, totalWithTip: total,
          paymentStatus: 'unpaid',
          paymentMethod: data!.paymentMethod,
          orderItems: { connect: newOrder.orderItems.map(oi => ({ id: oi.id })) },
        },
      })

      if (data!.paymentMethod !== 'cash') {
        await tx.payment.create({
          data: {
            checkId: check.id, amount: total, tipAmount: 0,
            type: 'card',
            status: 'pending',
          },
        })
      }

      await tx.orderItem.updateMany({ where: { orderId: newOrder.id }, data: { checkId: check.id } })
      await deductInventoryInTx(tx, data!.orderItems, new Map(menuItems.map(mi => [mi.id, mi])), nextOrderNumber)
      await tx.order.update({ where: { id: newOrder.id }, data: { inventoryDeducted: true } })

      return newOrder
    })

    // R135 (P1-11): vezava naprave — DeviceRegistry upsert (best-effort, PoT:
    // napaka registracije NE restriktira naročila; token je nosilec varnosti).
    // type 'kiosk' + status 'online' + lastSeenAt = admin vidi žive kioske.
    if (data.deviceId) {
      try {
        await db.deviceRegistry.upsert({
          where: { deviceId: data.deviceId },
          create: {
            deviceId: data.deviceId,
            name: `Kiosk-${data.deviceId.slice(-4).toUpperCase()}`,
            type: 'kiosk',
            locationId: kioskLocationId,
            status: 'online',
            lastSeenAt: new Date(),
          },
          update: {
            type: 'kiosk',
            locationId: kioskLocationId,
            status: 'online',
            lastSeenAt: new Date(),
          },
        })
      } catch (deviceErr: unknown) {
        logger.warn('API', '[KIOSK] DeviceRegistry upsert ni uspel (ne-blockirajoče):', deviceErr)
      }
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: toNum(order.total),
      items: order.orderItems.length,
      paymentMethod: paymentMethodLabel,
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
