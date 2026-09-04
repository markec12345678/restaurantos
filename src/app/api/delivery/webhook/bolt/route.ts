// ============================================
// BOLT INBOUND WEBHOOK — Sprejemanje naročil iz Bolt Food platforme
// Bolt pošlje naročilo na ta endpoint ko gost naroči
// Dokumentacija: Bolt Food Partner API
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { getNextCounter } from '@/lib/counters'
import { emitOrderCreated } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { toNum, round2, sumBy } from '@/lib/decimal'
import { checkRateLimitAsync, getClientIp, DELIVERY_WEBHOOK_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
import { broadcastWSEvent } from '@/lib/websocket-client'
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
      return NextResponse.json(
        { error: 'Preveč zahtevkov' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.retryAfterMs || 60000) / 1000)) } }
      )
    }

    const body = await req.text()

    // Preveri Bolt integracijo
    const boltIntegration = await db.integration.findFirst({
      where: { provider: 'bolt', isActive: true },
    })
    if (!boltIntegration) {
      logger.warn('Bolt', 'Ni aktivne Bolt integracije')
      return NextResponse.json({ error: 'Bolt integracija ni konfigurirana' }, { status: 404 })
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
      logger.warn('Bolt', 'Webhook secret ni konfiguriran — preskakujem preverjanje podpisa')
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

    // Preveri duplikate (idempotentnost)
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

    // Pridobi vse artikle iz baze za mapping
    const allMenuItems = await db.menuItem.findMany({
      where: { isAvailable: true },
      select: { id: true, name: true, price: true, vatRate: true },
    })

    if (allMenuItems.length === 0) {
      return NextResponse.json({ error: 'Ni artiklov v bazi' }, { status: 500 })
    }

    // Map Bolt artikli v OrderItem
    const orderItemsData = mapBoltItemsToOrderItems(data.items, allMenuItems)

    // Izračunaj zneske
    const subtotalNum = Number(sumBy(orderItemsData, item => toNum(item.price) * item.quantity))
    const deliveryFee = toNum(data.delivery_fee)
    const total = round2(subtotalNum + deliveryFee)

    // Ustvari naročilo
    const orderNumber = await getNextCounter('orderNumber')

    const order = await db.order.create({
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

    // Zabeleži v integration log
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
    }).catch(err => logger.error('Bolt', 'emitOrderCreated napaka:', err))

    // Obvesti KDS in natakarja
    broadcastWSEvent('NEW_ORDER', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: 'delivery',
      source: 'bolt',
    })

    logger.info('Bolt', `✅ Sprejeto Bolt naročilo ${data.order_id} → #${order.orderNumber} (${data.items.length} artiklov, ${total}€)`)

    return NextResponse.json({
      success: true,
      message: 'Naročilo sprejeto',
      orderNumber: order.orderNumber,
      orderId: order.id,
    }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/delivery/webhook/bolt', 'Napaka pri sprejemanju Bolt naročila')
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
