// ============================================
// WOLT INBOUND WEBHOOK — Sprejemanje naročil iz Wolt platforme
// Wolt pošlje naročilo na ta endpoint ko gost naroči
// Dokumentacija: Wolt Merchant API
// ============================================
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { Prisma } from '@prisma/client'
import { verifySignature } from '@/lib/webhook-engine'
import { getNextOrderNumber } from '@/lib/counters'
import { emitOrderCreated } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { toNum, multiply, round2, sumBy } from '@/lib/decimal'
import { checkRateLimitAsync, getClientIp, DELIVERY_WEBHOOK_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
// R88-2: webhook envelope (?t=<integrationId>:<hmac64>) — tenant atribucija ŠE
// PRED DB lookupom; isOrderingSecretConfigured = R82-D fail-closed kanon.
import { isOrderingSecretConfigured, parseWebhookEnvelope } from '@/lib/ordering-token'
// FIX R112: canonical error kontrakt (R103/R111) — strukturirani
// { error, status } throws iz tx telesa → pravi 400/500.
import { structuredErrorResponse } from '@/lib/structured-error'
import {
  WOLT_SIGNATURE_HEADER,
  woltOrderSchema,
  findExistingWoltOrder,
  mapWoltItemsToOrderItems,
  deductInventoryForOrder,
  logAndSyncIntegration,
  broadcastWS,
} from './_helpers'

// POST /api/delivery/webhook/wolt — Wolt pošlje naročilo
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // FIX: Rate limit za Wolt webhook — prepreči ponovne pošiljanke (replay attacks)
    const ip = getClientIp(req)
    const rateLimit = await checkRateLimitAsync('wolt-webhook', ip, DELIVERY_WEBHOOK_LIMIT)
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
    const woltIntegration = await db.integration.findFirst({
      where: { id: envelope.integrationId, provider: 'wolt', isActive: true },
    })
    if (!woltIntegration) {
      return NextResponse.json({ error: 'Integracija ni najdena' }, { status: 404 })
    }

    // FIX D-01 CRITICAL: BREZ apiSecret = BREZ dostopa. Ne dovoli neoverjenih webhookov.
    if (!woltIntegration.apiSecret) {
      logger.error('Wolt', 'WEBHOOK ZAVRNJEN: apiSecret ni nastavljen! Brez skrivnega ključa je webhook odprt za zlorabo.')
      return NextResponse.json({ error: 'Webhook zahteva konfiguriran apiSecret za preverjanje podpisa' }, { status: 401 })
    }

    const signature = req.headers.get(WOLT_SIGNATURE_HEADER)
    if (!signature) {
      logger.warn('Wolt', 'Manjkajoč podpis')
      return NextResponse.json({ error: 'Manjkajoč podpis' }, { status: 401 })
    }

    const isValid = verifySignature(body, signature, woltIntegration.apiSecret)
    if (!isValid) {
      logger.warn('Wolt', 'Neveljaven podpis')
      return NextResponse.json({ error: 'Neveljaven podpis' }, { status: 401 })
    }

    // Parsaj in validiraj
    const parsed = woltOrderSchema.safeParse(JSON.parse(body))
    if (!parsed.success) {
      logger.error('Wolt', 'Neveljavni podatki:', parsed.error.issues)
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }
    const woltOrder = parsed.data

    // Fast-path idempotenca — SAMO hitri pregled nad db; AVTORITATIVNA
    // preverba je tx-fresh ZNOTRAJ transakcije spodaj (pod advisory lock-om).
    // Kontrakt duplikata je nespremenjen (200 accepted + obstoječi orderId).
    // R117 (H-2): lokacijska resolucija je prestavljena PRED fast-path —
    // legacy fallback je od zdaj lokacijsko scoped in brez scope-a ni niti
    // fast-path preverbe (prej je unscoped notes contains lahko vrnil tuj
    // order ne glede na lokacijo integracije).
    // R88-2: lokacija pride IZ integracije (Integration.locationId — per-location
    // webhook žig). Globalni resolveDefaultLocationId fallback ODSTRANJEN
    // (R87-FINAL backlog): naročilo se NIKOLI tiho ne žiga na prvo aktivno
    // lokacijo katerega koli tenanta. Brez nastavljene lokacije → 503
    // (platforma retry-a; P1-6 kanon ostaja).
    const webhookLocationId = woltIntegration.locationId
    if (!webhookLocationId) {
      return NextResponse.json({ status: 'error', message: 'Ni nastavljene lokacije' }, { status: 503 })
    }
    const existing = await findExistingWoltOrder(woltIntegration.id, woltOrder.order_id, webhookLocationId)
    if (existing) {
      return NextResponse.json({ status: 'accepted', orderId: existing.orderId })
    }
    const deliveryAddress = woltOrder.delivery?.location?.formatted_address || ''
    const recipientName = woltOrder.delivery?.recipient?.name || 'Wolt gost'
    const recipientPhone = woltOrder.delivery?.recipient?.phone || ''

    // FIX R112 (WEBHOOK-2, MED — TOCTOU razred iz R100–R111): prej je bil dedup
    // scan integrationLog.requestData IZVEN tx, log pa je bil zapisan ŠELE PO
    // order.create — sočasna redeliverija je obšla oba pregleda (check-then-act
    // okno) → DVE plačani naročili za isti Wolt order. Sedaj: ENA Serializable
    // transakcija — advisory lock 'delivery-webhook:{integrationId}:{orderId}'
    // + tx-fresh dedup re-check + lokacijsko-scoped item mapping (WEBHOOK-3) +
    // create pod istim snapshot-om. Izgubljena tekma → idempotenten 200 accepted
    // z obstoječim orderId (isti kontrakt kot fast-path duplikat zgoraj).
    const lockKey = `delivery-webhook:${woltIntegration.id}:${woltOrder.order_id}`
    // mapped items preživijo tx scope (deduction podpis ostane enak kot prej)
    let mappedOrderItems: Awaited<ReturnType<typeof mapWoltItemsToOrderItems>> = []
    const txResult = await db.$transaction(async (tx) => {
      // Advisory lock (R110 kanon) — serializira vse redeliverije ISTEGA
      // (integrationId, woltOrderId) para; re-check pod ključavnico je
      // AVTORITATIVEN.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`

      // tx-fresh dedup re-check (log + backward-compat notes scan, na tx
      // klientu; R117 H-2: notes fallback lokacijsko scoped)
      const freshDup = await findExistingWoltOrder(woltIntegration.id, woltOrder.order_id, webhookLocationId, tx)
      if (freshDup) {
        return { duplicate: true as const, existing: freshDup }
      }

      // FIX R112 (WEBHOOK-3): mapping scoped na webhook lokacijo (MODEL A
      // veriga category → menu → locationId) + tx-fresh cenovni/DDV snapshot.
      const orderItems = await mapWoltItemsToOrderItems(woltOrder.items, webhookLocationId, tx)
      if (orderItems.length === 0) {
        throw { error: 'Artikli niso najdeni', status: 400 }
      }
      mappedOrderItems = orderItems

      const subtotal = toNum(sumBy(orderItems, item => multiply(item.price, item.quantity)))
      const totalTax = round2(orderItems.reduce((sum, item) => sum + toNum(multiply(item.vatAmount, item.quantity)), 0))
      const total = round2(subtotal + totalTax)

      // Številka naročila ZNOTRAJ tx (R100 atomarni per-lokacijski counter) —
      // porabljena šele ko vsi guardi gredo skozi.
      const orderNumber = await getNextOrderNumber(webhookLocationId, tx)

      const order = await tx.order.create({
        data: {
          orderNumber,
          type: 'delivery',
          status: 'pending',
          customerName: recipientName,
          customerPhone: recipientPhone,
          subtotal,
          tax: totalTax,
          discount: 0,
          total,
          tip: 0,
          totalWithTip: total,
          paymentStatus: woltOrder.payment?.method ? 'paid' : 'unpaid',
          paymentMethod: woltOrder.payment?.method || 'card',
          paidAt: woltOrder.payment?.method ? new Date() : null,
          notes: `WOLT:${woltOrder.order_id}${woltOrder.notes ? ' | ' + woltOrder.notes : ''}`,
          inventoryDeducted: false,
          location: { connect: { id: webhookLocationId } },
          orderItems: { create: orderItems },
          deliveryInfo: {
            create: {
              address: deliveryAddress || 'Wolt dostava',
              recipientName,
              recipientPhone,
              deliveryInstructions: `Wolt Order ID: ${woltOrder.order_id}`,
              status: 'pending',
              estimatedTime: new Date(Date.now() + 30 * 60 * 1000),
              deliveryFee: 0,
            },
          },
        },
        include: { orderItems: { include: { menuItem: true } } },
      })

      return { duplicate: false as const, order }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    // Izgubljena dedup tekma → idempotenten 200 accepted z obstoječim orderId
    if (txResult.duplicate) {
      return NextResponse.json({ status: 'accepted', orderId: txResult.existing.orderId })
    }

    const order = txResult.order

    // Zmanjšaj zalogo (lastna tx — INSUFFICIENT_STOCK kontrakt ostaja enak)
    await deductInventoryForOrder(order.id, order.orderNumber, mappedOrderItems, 'Wolt')

    // Integracijski log + sync
    await logAndSyncIntegration(woltIntegration.id, body, order.id, order.orderNumber)

    // Broadcast NEW_ORDER to KDS/POS via WebSocket
    broadcastWS('NEW_ORDER', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: 'delivery',
      source: 'wolt',
      // WS AUDIT: locationId za per-location dostavo (KDS ne vidi tujih lokacij)
      locationId: order.locationId ?? null,
    })

    // Sproži webhook za novo naročilo
    emitOrderCreated({
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: 'delivery',
      total: toNum(order.total),
      locationId: order.locationId ?? null,
    }).catch(err => logger.error('Wolt', 'order.created napaka:', err))

    logger.info('Wolt', `Novo naročilo #${order.orderNumber} iz Wolta`)
    return NextResponse.json({ status: 'accepted', orderId: order.id, orderNumber: order.orderNumber })
  } catch (error: unknown) {
    // FIX P4: Če je inventory deduction failnil (INSUFFICIENT_STOCK), pošlji
    // 409 Conflict nazaj Woltu da ve da order ni bil sprejet.
    if (error instanceof Error && error.message.startsWith('INSUFFICIENT_STOCK:')) {
      logger.error('Wolt', `Order zavrnjen — nezadostna zaloga: ${error.message}`)
      return NextResponse.json(
        {
          status: 'rejected',
          error: 'Insufficient stock — order cannot be fulfilled',
          detail: error.message,
        },
        { status: 409 },
      )
    }
    // FIX R112: canonical error kontrakt (R107/R111 vzorec) — P2034 Serializable
    // konflikt / P2002 → 409; strukturirani { error, status } throws iz tx
    // telesa (Artikli niso najdeni) → pravi 400 (prej 500).
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002')) {
      return NextResponse.json(
        { error: 'Konflikt pri obdelavi Wolt naročila (sočasna dostava). Poskusite znova.' },
        { status: 409 }
      )
    }
    return structuredErrorResponse(error, 'POST /api/delivery/webhook/wolt', 'Napaka pri obdelavi Wolt naročila')
  }
}
