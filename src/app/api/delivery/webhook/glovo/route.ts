// ============================================
// GLOVO INBOUND WEBHOOK — Sprejemanje naročil iz Glovo platforme
// Glovo pošlje naročilo na ta endpoint ko gost naroči
// Dokumentacija: Glovo Partners API
// ============================================
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { verifySignature } from '@/lib/webhook-engine'
import { getNextOrderNumber } from '@/lib/counters'
import { emitOrderCreated } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { toNum, multiply, round2, sumBy } from '@/lib/decimal'
import { checkRateLimitAsync, getClientIp, DELIVERY_WEBHOOK_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'
// R88-2: webhook envelope (?t=<integrationId>:<hmac64>) — tenant atribucija ŠE
// PRED DB lookupom; isOrderingSecretConfigured = R82-D fail-closed kanon.
import { isOrderingSecretConfigured, parseWebhookEnvelope } from '@/lib/ordering-token'
import {
  GLOVO_SIGNATURE_HEADER,
  glovoOrderSchema,
  findExistingGlovoOrder,
  mapGlovoProductsToOrderItems,
  deductInventoryForOrder,
  logAndSyncIntegration,
  broadcastWS,
} from './_helpers'

// POST /api/delivery/webhook/glovo — Glovo pošlje naročilo
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // FIX: Rate limit za Glovo webhook — prepreči ponovne pošiljanke (replay attacks)
    const ip = getClientIp(req)
    const rateLimit = await checkRateLimitAsync('glovo-webhook', ip, DELIVERY_WEBHOOK_LIMIT)
    if (!rateLimit.allowed) {
      return rateLimitedResponse(rateLimit.retryAfterMs, 'Preveč zahtevkov')
    }

    const body = await req.text()
    const signature = req.headers.get(GLOVO_SIGNATURE_HEADER) || ''

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
    const glovoIntegration = await db.integration.findFirst({
      where: { id: envelope.integrationId, provider: 'glovo', isActive: true },
    })
    if (!glovoIntegration) {
      return NextResponse.json({ error: 'Integracija ni najdena' }, { status: 404 })
    }

    // FIX D-01 CRITICAL: BREZ apiSecret = BREZ dostopa. Ne dovoli neoverjenih webhookov.
    if (!glovoIntegration.apiSecret) {
      logger.error('Glovo', 'WEBHOOK ZAVRNJEN: apiSecret ni nastavljen! Brez skrivnega ključa je webhook odprt za zlorabo.')
      return NextResponse.json({ error: 'Webhook zahteva konfiguriran apiSecret za preverjanje podpisa' }, { status: 401 })
    }

    if (!signature) {
      logger.warn('Glovo', 'Manjkajoč podpis')
      return NextResponse.json({ error: 'Manjkajoč podpis' }, { status: 401 })
    }

    const isValid = verifySignature(body, signature, glovoIntegration.apiSecret)
    if (!isValid) {
      logger.warn('Glovo', 'Neveljaven podpis')
      return NextResponse.json({ error: 'Neveljaven podpis' }, { status: 401 })
    }

    // Parsaj in validiraj
    const parsed = glovoOrderSchema.safeParse(JSON.parse(body))
    if (!parsed.success) {
      logger.error('Glovo', 'Neveljavni podatki:', parsed.error.issues)
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }
    const glovoOrder = parsed.data

    // Idempotenca
    const existing = await findExistingGlovoOrder(glovoIntegration.id, glovoOrder.order_id)
    if (existing) {
      return NextResponse.json({ status: 'accepted', orderId: existing.orderId })
    }

    // Ustvari naročilo v RestaurantOS
    // R88-2: lokacija pride IZ integracije (Integration.locationId — per-location
    // webhook žig). Globalni resolveDefaultLocationId fallback ODSTRANJEN
    // (R87-FINAL backlog): naročilo se NIKOLI tiho ne žiga na prvo aktivno
    // lokacijo katerega koli tenanta. Brez nastavljene lokacije → 503
    // (platforma retry-a; P1-6 kanon ostaja).
    const webhookLocationId = glovoIntegration.locationId
    if (!webhookLocationId) {
      return NextResponse.json({ status: 'error', message: 'Ni nastavljene lokacije' }, { status: 503 })
    }
    const orderNumber = await getNextOrderNumber(webhookLocationId)
    const deliveryAddress = [
      glovoOrder.delivery_address?.street,
      glovoOrder.delivery_address?.city,
      glovoOrder.delivery_address?.details,
    ].filter(Boolean).join(', ')
    const customerName = glovoOrder.customer?.name || 'Glovo gost'
    const customerPhone = glovoOrder.customer?.phone || ''

    const orderItems = await mapGlovoProductsToOrderItems(glovoOrder.products)
    if (orderItems.length === 0) {
      logger.error('Glovo', 'Ni bilo mogoče preslikati artiklov')
      return NextResponse.json({ error: 'Artikli niso najdeni' }, { status: 400 })
    }

    const subtotal = toNum(sumBy(orderItems, item => multiply(item.price, item.quantity)))
    const totalTax = round2(orderItems.reduce((sum, item) => sum + toNum(multiply(item.vatAmount, item.quantity)), 0))
    const total = round2(subtotal + totalTax)

    const order = await db.order.create({
      data: {
        orderNumber,
        type: 'delivery',
        status: 'pending',
        customerName,
        customerPhone,
        subtotal,
        tax: totalTax,
        discount: 0,
        total,
        tip: 0,
        totalWithTip: total,
        paymentStatus: glovoOrder.payment?.method ? 'paid' : 'unpaid',
        paymentMethod: glovoOrder.payment?.method || 'card',
        paidAt: glovoOrder.payment?.method ? new Date() : null,
        notes: `GLOVO:${glovoOrder.order_id}${glovoOrder.comment ? ' | ' + glovoOrder.comment : ''}`,
        inventoryDeducted: false,
        location: { connect: { id: webhookLocationId } },
        orderItems: { create: orderItems },
        deliveryInfo: {
          create: {
            address: deliveryAddress || 'Glovo dostava',
            recipientName: customerName,
            recipientPhone: customerPhone,
            deliveryInstructions: `Glovo Order ID: ${glovoOrder.order_id}`,
            status: 'pending',
            estimatedTime: new Date(Date.now() + 30 * 60 * 1000),
            deliveryFee: 0,
          },
        },
      },
      include: { orderItems: { include: { menuItem: true } } },
    })

    // Zmanjšaj zalogo
    await deductInventoryForOrder(order.id, order.orderNumber, orderItems, 'Glovo')

    // Integracijski log + sync
    await logAndSyncIntegration(glovoIntegration.id, body, order.id, order.orderNumber)

    // Broadcast NEW_ORDER to KDS/POS via WebSocket
    broadcastWS('NEW_ORDER', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: 'delivery',
      source: 'glovo',
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
    }).catch(err => logger.error('Glovo', 'order.created napaka:', err))

    logger.info('Glovo', `Novo naročilo #${order.orderNumber} iz Glova`)
    return NextResponse.json({ status: 'accepted', orderId: order.id, orderNumber: order.orderNumber })
  } catch (error: unknown) {
    // FIX P4: Če je inventory deduction failnil (INSUFFICIENT_STOCK), označi
    // order kot 'cancelled' da ga KDS ne prikaže. Pošlji 409 nazaj Glovu da
    // ve da order ni bil sprejet.
    if (error instanceof Error && error.message.startsWith('INSUFFICIENT_STOCK:')) {
      logger.error('Glovo', `Order zavrnjen — nezadostna zaloga: ${error.message}`)
      // Pošlji 409 Conflict — Glovo bo prikazal napako uporabniku
      return NextResponse.json(
        {
          status: 'rejected',
          error: 'Insufficient stock — order cannot be fulfilled',
          detail: error.message,
        },
        { status: 409 },
      )
    }
    return handleApiError(error, 'POST /api/delivery/webhook/glovo', 'Napaka pri obdelavi Glovo naročila')
  }
}
