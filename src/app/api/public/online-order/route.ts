
// =====================================================================
// ONLINE ORDER API - Spletna naročila z dostavo ali prevzemom
// Podpora za: delivery, takeout z online plačilom
// Ekvivalent Toast Online Ordering za slovenski trg
// FIX CRITICAL: Skupni rate limiter modul
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { toNum } from '@/lib/decimal'
import { getNextOrderNumber } from '@/lib/counters'
import { checkRateLimitAsync, getClientIp, ONLINE_ORDER_LIMIT } from '@/lib/rate-limit'
import { handleRouteError, validateRequest } from '@/lib/api-utils'
import { notInScopeResponse } from '@/lib/tenant-scope'
// R88: per-location ordering token (qr-pay HMAC vzorec iz R81) — vezava
// naročilo↔lokacija brez sheme/Redis-a, timing-safe, fail-closed.
// R89: token vezava zdaj vključuje tokenVersion (`v1:<verzija>:<hmac>`) —
// per-location revokacija prek Location.tokenVersion (rotate endpoint).
import { isOrderingSecretConfigured, verifyOrderingToken } from '@/lib/ordering-token'
import { formatEUR } from '@/lib/safe-format'
import {

  onlineOrderSchema, MIN_ORDER_AMOUNT,
  checkRestaurantOpen, calculateDeliveryFee, calculateOrderItems,
  triggerWebhookAsync, createOnlineOrder,
} from './_helpers'

export const dynamic = 'force-dynamic'

// R87-3: ENOTNA validacija izrecnega locationId (isti kanon kot public/kiosk
// R86-3: regex oblika + location.findFirst({ id, isActive: true })). Neznana /
// tuja / neaktivna / neveljavna oblika → IZKLJUČNO notInScopeResponse('Lokacija')
// 404 'Lokacija ni najden' — isti odgovor za "ne obstaja" in "tuja" (ni
// obstoja-oraklja). NIKOLI globalnega resolveDefaultLocationId() za pisno pot
// (odstranjen R86 residual).
async function resolveOnlineOrderLocation(
  explicitId: string,
): Promise<{ ok: true; locationId: string; tokenVersion: number } | { ok: false; response: NextResponse }> {
  if (!/^[a-z0-9]{5,50}$/i.test(explicitId)) {
    return { ok: false, response: notInScopeResponse('Lokacija') }
  }
  // R89: select vključuje tokenVersion (per-location revokacija) — brez dodatnega
  // DB klica. `?? 0` guard: NOT NULL DEFAULT 0 v shemi (undefined/null samo v
  // testnih fikserjih brez polja — takrat velja verzija 0, enako kot R88 tokeni).
  const location = await db.location.findFirst({
    where: { id: explicitId, isActive: true },
    select: { id: true, tokenVersion: true },
  })
  if (!location) return { ok: false, response: notInScopeResponse('Lokacija') }
  return { ok: true, locationId: location.id, tokenVersion: location.tokenVersion ?? 0 }
}

export async function POST(req: Request) {
  // FIX CRITICAL: Rate limiting — skupni modul
  const clientIp = getClientIp(req)
  const rateCheck = await checkRateLimitAsync('online-order', clientIp, ONLINE_ORDER_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč naročil. Poskusite znova čez nekaj minut.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 120000) / 1000)) } }
    )
  }

  try {
    // FIX MEDIUM: Fail-CLOSED — če nastavitv ni mogoče prebrati, ZAPRI naročila
    const openError = await checkRestaurantOpen()
    if (openError) return openError

    // R88 FIX 1/2 (production secret, R82-D kanon — zrcali qr-pay init 503):
    // produkcija brez ORDERING_TOKEN_SECRET / QR_PAY_SECRET / ENCRYPTION_KEY /
    // NEXTAUTH_SECRET → 503 fail-closed PRED resolucijo lokacije (NI 404-vs-503
    // obstoja-oraklja aktivnih lokacij v pokvarjeni produkciji — vsak zahtevek
    // dobi enak 503). Nikoli ne verificiraj z javno znanim dev secretom;
    // sporočilo brez notranjih detajlov.
    if (process.env.NODE_ENV === 'production' && !isOrderingSecretConfigured()) {
      return NextResponse.json({ error: 'Spletno naročanje trenutno ni na voljo. Poskusite znova kasneje.' }, { status: 503 })
    }

    const { data, error: validationError } = await validateRequest(req, onlineOrderSchema)
    if (validationError) return validationError

    const { orderType, items, paymentMethod, customer, promoCode, locationId, orderingToken } = data

    // R87-3 FIX (R86-3 residual), fail-closed: izrecen locationId je OBVEZEN —
    // prej je manjkajoč padel na GLOBALNO prvo aktivno lokacijo (counters.ts
    // resolveDefaultLocationId) = cross-tenant žig naročila + tuj per-lokacijski
    // order counter + odbitek tuje zaloge + tuj guest/discount kontekst.
    // Spletni klijent (src/app/order/useOnlineOrder) pošilja selectedLocation
    // (R89: iz deep-link URL-ja ?loc= + token ?t=; order-config je od R89
    // token-gated in vrača config samo za token-proveno lokacijo);
    // tretje-ožji klicatelji brez locationId →
    // 400 brez NOBENE pisne operacije (BREAKING CHANGE, dokumentiran v worklogu
    // R87-3). Unknown/inactive → unificiran 404 'Lokacija ni najden' (prej 400
    // 'Izbrana lokacija ni na voljo' prek findUnique — zdaj isti kanon kot
    // kiosk/delivery-check: findFirst({ id, isActive: true }) brez oraklja).
    // ZGODOVINA: R87-3 je dovolil body.locationId katere koli aktivne lokacije
    // ("BY-DESIGN ena domena, več restavracij") — R88 to ZAPRE: locationId je
    // zdaj vezan na HMAC ordering token (spodaj), anonimen klicatelj brez
    // tokena RESTAVRACIJE ne more več žigati naročil na njeno lokacijo.
    if (!locationId) {
      return NextResponse.json({ error: 'Restavracija trenutno ne sprejema spletnih naročil' }, { status: 400 })
    }
    const resolvedLocation = await resolveOnlineOrderLocation(locationId)
    if (!resolvedLocation.ok) return resolvedLocation.response
    const onlineLocationId: string = resolvedLocation.locationId
    const onlineTokenVersion: number = resolvedLocation.tokenVersion

    // R88 FIX 2/2 (BY-DESIGN luknja iz R87 zaprta): ordering token je OBVEZEN
    // in vezan na TOČNO TO lokacijo — manjkajoč / napačen format / token TUJE
    // lokacije → IZKLJUČNO isti notInScopeResponse('Lokacija') 404 kot neznana
    // lokacija (NI obstoja-oraklja, NI razlike "manjka" vs "tuj"). Check gre
    // TUKAJ — takoj po resoluciji lokacije, PRED menu lookupom in PRED vsakim
    // pisnim klicem (counter upsert, getNextOrderNumber, createOnlineOrder —
    // zavrnitev = ZERO db zapisov).
    // R89: vezava zdaj vključuje tokenVersion — token izdan za STARO verzijo
    // lokacije (pred rotate) je neveljaven (isti 404, zero pisnih klicev).
    if (!orderingToken || !verifyOrderingToken(orderingToken, onlineLocationId, onlineTokenVersion)) {
      return notInScopeResponse('Lokacija')
    }

    // Pridobi menu iteme iz DB (strežniška cena, NE klientova!)
    // FIX R82-C (LEAK-MEDIUM: cross-tenant item injection + existence oracle):
    // where dobi category.menu.locationId = IZBRANA lokacija — tuji menuItemId
    // je "ni na voljo" (isti odgovor kot neobstoječ: NI oracle o tujem meniju,
    // NI vstavljanja tujih cen/DDV v order, NI odbijanja tuje zaloge).
    const menuItemIds = [...new Set(items.map((i: { menuItemId: string }) => i.menuItemId))]
    const menuItems = await db.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        isAvailable: true,
        category: { menu: { locationId: onlineLocationId } },
      },
      include: { recipeItems: { include: { inventoryItem: true } } },
    })
    const menuItemMap = new Map(menuItems.map(mi => [mi.id, mi]))

    // FIX BUG-06: Subtotal iz strežniških cen, NE klientovih
    const itemsSubtotal = items.reduce((sum: number, i: { menuItemId: string; quantity: number }) => {
      const mi = menuItemMap.get(i.menuItemId)
      return sum + (mi ? toNum(mi.price) * i.quantity : 0)
    }, 0)

    // Ponovno preveri minimum za dostavo s strežniškimi cenami
    if (orderType === 'delivery' && itemsSubtotal < MIN_ORDER_AMOUNT) {
      return NextResponse.json({ error: `Minimalno naročilo za dostavo je ${formatEUR(MIN_ORDER_AMOUNT)}` }, { status: 400 })
    }

    if (menuItems.length !== menuItemIds.length) {
      const foundIds = new Set(menuItems.map(m => m.id))
      const missing = menuItemIds.filter(id => !foundIds.has(id))
      return NextResponse.json({ error: 'Nekateri artikli niso na voljo', unavailableItems: missing }, { status: 400 })
    }

    // FIX Q02 CRITICAL: deliveryFee se izračuna strežniško iz cone dostave
    let actualDeliveryFee = 0
    if (orderType === 'delivery' && 'postCode' in customer) {
      const feeResult = await calculateDeliveryFee(customer, itemsSubtotal)
      if (feeResult.error) return feeResult.error
      actualDeliveryFee = feeResult.fee
    }

    // Generiraj številko naročila
    // FIX Q04 MEDIUM: Če counter ne deluje, VRNI NAPAKO namesto neatomskega fallbacka
    // P1-7: per-lokacijsko številčenje (self-init iz MAX — varno nadaljevanje)
    let nextOrderNumber: number
    try {
      nextOrderNumber = await getNextOrderNumber(onlineLocationId)
    } catch (_counterErr: unknown) {
      return NextResponse.json({ error: 'Napaka pri generiranju številke naročila. Poskusite znova.' }, { status: 503 })
    }

    // Generiraj številko čeka
    let nextCheckNumber: number
    try {
      const counter = await db.counter.upsert({
        where: { name: 'checkNumber' }, update: { value: { increment: 1 } }, create: { name: 'checkNumber', value: 1 },
      })
      nextCheckNumber = counter.value
    } catch {
      return NextResponse.json({ error: 'Napaka pri generiranju številke čeka. Poskusite znova.' }, { status: 503 })
    }

    // Izračunaj zneske iz strežniških podatkov
    const { orderItemsData, subtotal, totalVat } = await calculateOrderItems(items, menuItemMap)

    // Ustvari naročilo znotraj transakcije
    const { order, customerName, customerPhone, deliveryAddress } = await createOnlineOrder({
      orderType,
      items,
      paymentMethod,
      customer: customer as Record<string, unknown>,
      promoCode,
      locationId: onlineLocationId,
      menuItemMap,
      orderItemsData,
      subtotal,
      totalVat,
      actualDeliveryFee,
      nextOrderNumber,
      nextCheckNumber,
    })

    // Sproži webhook za novo online naročilo (ne blokiraj odziva)
    triggerWebhookAsync('order.created', {
      orderId: order.id, orderNumber: String(order.orderNumber),
      type: orderType, total: toNum(order.total),
      customerName, customerPhone, paymentMethod, source: 'online',
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      order: {
        id: order.id, orderNumber: String(order.orderNumber), status: order.status,
        total: toNum(order.total), orderType,
        estimatedTime: orderType === 'delivery' ? '30-45 min' : '15-25 min',
        deliveryAddress, paymentMethod,
      },
    }, { status: 201 })

  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/public/online-order', [
      // FIX R82-C (stock oracle): INSUFFICIENT_STOCK sporočilo NE odaja več
      // točnih količin ("potrebno X, na voljo Y") anonimnemu klicatelju —
      // prej je bilo mogoče odmerjati zaloge do decimale. Polna detajla ostane
      // v server logu (handleRouteError).
      { match: 'INSUFFICIENT_STOCK', message: 'Artikel ni na zalogi', status: 409, extra: () => ({ error: 'Na žalost nekateri artikli niso več na zalogi. Prosimo, prilagodite naročilo in poskusite znova.' }) },
    ], 'Napaka pri oddaji naročila. Prosimo, poskusite znova.')
  }
}
