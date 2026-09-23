// ============================================
// BOLT INBOUND WEBHOOK — Sprejemanje naročil iz Bolt Food platforme
// Bolt pošlje naročilo na ta endpoint ko gost naroči
// Dokumentacija: Bolt Food Partner API
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { Prisma } from '@prisma/client'
import { getNextOrderNumber } from '@/lib/counters'
import { emitOrderCreated } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { toNum, round2, sumBy } from '@/lib/decimal'
import { checkRateLimitAsync, getClientIp, DELIVERY_WEBHOOK_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { broadcastWSEvent } from '@/lib/websocket-client'
// R88-2: webhook envelope (?t=<integrationId>:<hmac64>) — tenant atribucija ŠE
// PRED DB lookupom; isOrderingSecretConfigured = R82-D fail-closed kanon.
import { isOrderingSecretConfigured, parseWebhookEnvelope } from '@/lib/ordering-token'
// FIX R112: canonical error kontrakt (R103/R111) — strukturirani
// { error, status } throws iz tx telesa → pravi 400/500 (prej handleApiError 500).
import { structuredErrorResponse } from '@/lib/structured-error'
import {
  BOLT_SIGNATURE_HEADER,
  boltOrderSchema,
  findExistingBoltOrder,
  mapBoltItemsToOrderItems,
} from './_helpers'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // Rate limit za Bolt webhook
    const ip = getClientIp(req)
    const rateLimit = await checkRateLimitAsync('bolt-webhook', ip, DELIVERY_WEBHOOK_LIMIT)
    if (!rateLimit.allowed) {
      return rateLimitedResponse(rateLimit.retryAfterMs, 'Preveč zahtevkov')
    }

    const body = await req.text()

    // R88-2 (R82-D kanon): produkcija brez HMAC secret-a → 503 fail-closed PRED
    // kakršno koli izdajo/verifikacijo (isOrderingSecretConfigured v dev/testu
    // dovoli fallback; zrcali online-order + izdajno lokacijsko ruto).
    if (!isOrderingSecretConfigured()) {
      return NextResponse.json({ error: 'Webhook ni konfiguriran' }, { status: 503 })
    }

    // R88-2 (1/2): parsaj + timing-safe verificiraj envelope ?t=. Vsak
    // manjkajoč/malformiran/tuj envelope = ISTI unificiran 404 (ni oraklja).
    const envelope = parseWebhookEnvelope(new URL(req.url).searchParams.get('t'))
    if (!envelope.ok) {
      return NextResponse.json({ error: 'Integracija ni najdena' }, { status: 404 })
    }

    // R88-2 (2/2): tenant atribucija — lookup po VERIFICIRANEM integrationId
    // (nikoli raw input) + provider pin; neznana/neaktivna = isti 404 kot
    // envelope fail (ni razlike "ne obstaja" vs "tuj").
    const boltIntegration = await db.integration.findFirst({
      where: { id: envelope.integrationId, provider: 'bolt', isActive: true },
    })
    if (!boltIntegration) {
      return NextResponse.json({ error: 'Integracija ni najdena' }, { status: 404 })
    }

    // Verificiraj podpis (HMAC-SHA256)
    const signature = req.headers.get(BOLT_SIGNATURE_HEADER)
    if (!signature) {
      logger.warn('Bolt', 'Manjka signature header')
      return NextResponse.json({ error: 'Manjka podpis' }, { status: 401 })
    }

    // FIX: HMAC-SHA256 signature verification — prepreči lažna naročila
    const crypto = await import('crypto')
    const webhookSecret = boltIntegration.apiSecret || process.env.WEBHOOK_SECRET || ''
    if (webhookSecret) {
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex')
      // Constant-time comparison (prepreči timing attack)
      if (
        signature.length !== expectedSig.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
      ) {
        logger.warn('Bolt', 'Neveljaven podpis — zavrnjeno')
        return NextResponse.json({ error: 'Neveljaven podpis' }, { status: 401 })
      }
    } else {
      // FIX SECURITY (fail-closed): brez konfiguriranega secreta ZAVRNEMO zahtevo — prej se je
      // preverjanje podpisa tiho preskočilo (fail-open), kar je omogočalo lažna Bolt naročila.
      // Skladno z rate-limit fail-closed filozofijo tega projekta.
      logger.error('Bolt', 'Webhook secret NI konfiguriran — zahteva ZAVRNJENA (fail-closed)')
      return NextResponse.json(
        { error: 'Webhook ni konfiguriran — podpis ni mogoče preveriti. Nastavite Integration.apiSecret ali WEBHOOK_SECRET.' },
        { status: 503 }
      )
    }

    // Parse in validiraj payload
    let payload
    try {
      payload = JSON.parse(body)
    } catch {
      return NextResponse.json({ error: 'Neveljaven JSON' }, { status: 400 })
    }

    const { data, error } = boltOrderSchema.safeParse(payload)
    if (error) {
      logger.error('Bolt', 'Validacijska napaka:', error.issues)
      return NextResponse.json({ error: 'Neveljavni podatki naročila' }, { status: 400 })
    }

    // Fast-path duplikat (idempotentnost) — SAMO hitri pregled nad db;
    // AVTORITATIVNA preverba je tx-fresh ZNOTRAJ transakcije spodaj
    // (pod advisory lock-om), fast-path obstaja za prihranek tx-ov na
    // ponovljenih redeliverijih. Kontrakt duplikata je nespremenjen (200).
    const existing = await findExistingBoltOrder(data.order_id)
    if (existing) {
      logger.info('Bolt', `Duplikat naročila ${data.order_id} — vračam obstoječi ${existing.orderNumber}`)
      return NextResponse.json({
        success: true,
        message: 'Naročilo že obstaja',
        orderNumber: existing.orderNumber,
        orderId: existing.id,
      })
    }

    // R88-2: lokacija pride IZ integracije (Integration.locationId — per-location
    // webhook žig). Globalni resolveDefaultLocationId fallback ODSTRANJEN
    // (R87-FINAL backlog): naročilo se NIKOLI tiho ne žiga na prvo aktivno
    // lokacijo katerega koli tenanta. Brez nastavljene lokacije → 503
    // (platforma retry-a; P1-6 kanon ostaja).
    const webhookLocationId = boltIntegration.locationId
    if (!webhookLocationId) {
      return NextResponse.json({ status: 'error', message: 'Ni nastavljene lokacije' }, { status: 503 })
    }

    // FIX R112 (WEBHOOK-1, MED-HIGH — TOCTOU razred iz R100–R111): prej je bil
    // dedup (order.findFirst customerName CONTAINS 'Bolt:<id>') IZVEN tx in
    // order.create SEKUNDO KASNEJE — sočasna provider redeliverija je obšla
    // oba pregleda v check-then-act oknu → DVE plačani naročili za isti Bolt
    // order. Sedaj: ENA Serializable transakcija — advisory lock
    // 'delivery-webhook:{integrationId}:{externalOrderId}' + tx-fresh dedup
    // re-check + lokacijsko-scoped menu read (WEBHOOK-3) + mapping brez
    // fallbacka (WEBHOOK-4) + create pod istim snapshot-om. Izgubljena tekma
    // dedup-a → idempotenten 200 z obstoječim naročilom (isti kontrakt kot
    // fast-path duplikat zgoraj).
    const lockKey = `delivery-webhook:${boltIntegration.id}:${data.order_id}`
    const txResult = await db.$transaction(async (tx) => {
      // Advisory lock (R110 kanon) — serializira vse redeliverije ISTEGA
      // (integrationId, boltOrderId) para; re-check pod ključavnico je
      // AVTORITATIVEN (READ COMMITTED re-check sam NE ščiti).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`

      // tx-fresh dedup re-check
      const freshDup = await findExistingBoltOrder(data.order_id, tx)
      if (freshDup) {
        return { duplicate: true as const, existing: freshDup }
      }

      // FIX R112 (WEBHOOK-3, MED): menu read je bil GLOBALNI
      // (findMany isAvailable brez lokacije = artikli VSEH tenantov!) — sedaj
      // scoped na webhook lokacijo prek MODEL A verige category → menu →
      // locationId (isti vzorec kot online-order katalog). Tx-fresh tudi za
      // konsistenten cenovni/DDV snapshot.
      const allMenuItems = await tx.menuItem.findMany({
        where: {
          isAvailable: true,
          category: { menu: { locationId: webhookLocationId } },
        },
        select: { id: true, name: true, price: true, vatRate: true },
      })

      if (allMenuItems.length === 0) {
        throw { error: 'Ni artiklov v bazi', status: 500 }
      }

      // FIX R112 (WEBHOOK-4): mapping brez menuItems[0] fallbacka in brez
      // wire cene — neznana pozicija → strukturirana 400 'Neznana pozicija'
      // (tx se abortira, ni delnega naročila).
      const orderItemsData = mapBoltItemsToOrderItems(data.items, allMenuItems)

      // Izračunaj zneske
      const subtotalNum = Number(sumBy(orderItemsData, item => toNum(item.price) * item.quantity))
      const deliveryFee = toNum(data.delivery_fee)
      const total = round2(subtotalNum + deliveryFee)

      // Številka naročila ZNOTRAJ tx (R100 atomarni per-lokacijski counter) —
      // porabljena šele ko vsi guardi gredo skozi.
      const orderNumber = await getNextOrderNumber(webhookLocationId, tx)

      const order = await tx.order.create({
        data: {
          orderNumber,
          type: 'delivery',
          status: 'pending',
          customerName: `Bolt:${data.order_id} — ${data.customer.name}`,
          customerPhone: data.customer.phone,
          notes: `Bolt dostava na: ${data.delivery_address}. Opombe: ${data.delivery_notes}`,
          // FIX AUD-17: Pravilen DDV za vsak artikel — uporabi vatRate iz baze
          subtotal: subtotalNum,
          tax: orderItemsData.reduce((sum, item) => {
            const itemTotal = toNum(item.price) * item.quantity
            return round2(sum + itemTotal * (Number(item.vatRate) / 100))
          }, 0),
          discount: 0,
          tip: 0,
          total,
          totalWithTip: total,
          paymentStatus: 'paid', // Bolt plača vnaprej
          paymentMethod: 'card', // Bolt vedno kartično
          location: { connect: { id: webhookLocationId } },
          deliveryInfo: {
            create: {
              address: data.delivery_address,
              deliveryInstructions: data.delivery_notes,
              recipientName: data.customer.name,
              recipientPhone: data.customer.phone,
              deliveryFee,
              status: 'pending',
              ...(data.pickup_time ? { promisedTime: new Date(data.pickup_time) } : {}),
            },
          },
          orderItems: {
            create: orderItemsData.map(item => ({
              menuItemId: item.menuItemId,
              menuItemName: item.menuItemName,
              quantity: item.quantity,
              price: item.price,
              vatRate: item.vatRate,
              notes: item.notes,
              modifiersJson: item.modifiersJson,
            })),
          },
        },
        include: { orderItems: true, deliveryInfo: true },
      })

      return { duplicate: false as const, order }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    // Izgubljena dedup tekma → idempotenten 200 z obstoječim naročilom
    if (txResult.duplicate) {
      logger.info('Bolt', `Duplikat naročila ${data.order_id} (tx re-check) — vračam obstoječi ${txResult.existing.orderNumber}`)
      return NextResponse.json({
        success: true,
        message: 'Naročilo že obstaja',
        orderNumber: txResult.existing.orderNumber,
        orderId: txResult.existing.id,
      })
    }

    const order = txResult.order
    const total = toNum(order.total)

    // Zabeleži v integration log (izven tx — log ni kritičen za poslovni tok)
    await db.integrationLog.create({
      data: {
        integrationId: boltIntegration.id,
        action: 'order_received',
        direction: 'inbound',
        status: 'success',
        statusCode: 200,
        requestData: JSON.stringify({ boltOrderId: data.order_id, itemCount: data.items.length }),
        responseData: JSON.stringify({ orderNumber: order.orderNumber, orderId: order.id }),
        durationMs: 0,
      },
    })

    // Posodobi lastSync
    await db.integration.update({
      where: { id: boltIntegration.id },
      data: { lastSyncAt: new Date(), lastSyncStatus: 'success' },
    })

    // Webhook event
    emitOrderCreated({
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: 'delivery',
      total,
      locationId: order.locationId ?? null,
    }).catch(err => logger.error('Bolt', 'emitOrderCreated napaka:', err))

    // Obvesti KDS in natakarja
    broadcastWSEvent('NEW_ORDER', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: 'delivery',
      source: 'bolt',
      // FIX MULTI-TENANT: locationId za per-location WS filtriranje (KDS ne vidi tujih lokacij)
      locationId: order.locationId ?? null,
    })

    logger.info('Bolt', `✅ Sprejeto Bolt naročilo ${data.order_id} → #${order.orderNumber} (${data.items.length} artiklov, ${total}€)`)

    return NextResponse.json({
      success: true,
      message: 'Naročilo sprejeto',
      orderNumber: order.orderNumber,
      orderId: order.id,
    }, { status: 201 })
  } catch (error: unknown) {
    // FIX R112: canonical error kontrakt (R107/R111 vzorec) — P2034 Serializable
    // konflikt / P2002 → 409; strukturirani { error, status } throws iz tx
    // telesa (Ni artiklov / Neznana pozicija) → pravi 500/400 (prej 500 vsi).
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002')) {
      return NextResponse.json(
        { error: 'Konflikt pri sprejemanju Bolt naročila (sočasna dostava). Poskusite znova.' },
        { status: 409 }
      )
    }
    return structuredErrorResponse(error, 'POST /api/delivery/webhook/bolt', 'Napaka pri sprejemanju Bolt naročila')
  }
}

// GET — health check za Bolt
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    platform: 'bolt',
    message: 'Bolt webhook je aktiven. Pošlji POST za novo naročilo.',
  })
}
