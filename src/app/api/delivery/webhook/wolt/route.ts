// ============================================
// WOLT INBOUND WEBHOOK — Sprejemanje naročil iz Wolt platforme
// Wolt pošlje naročilo na ta endpoint ko gost naroči
// Dokumentacija: Wolt Merchant API
// ============================================
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { verifySignature } from '@/lib/webhook-engine'
import { getNextCounter } from '@/lib/counters'
import { emitOrderCreated } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { toNum, multiply, round2, sumBy } from '@/lib/decimal'
import { checkRateLimitAsync, getClientIp, DELIVERY_WEBHOOK_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
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
      return NextResponse.json(
        { error: 'Preveč zahtevkov' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.retryAfterMs || 60000) / 1000)) } }
      )
    }

    const body = await req.text()

    // Preveri Wolt integracijo
    const woltIntegration = await db.integration.findFirst({
      where: { provider: 'wolt', isActive: true },
    })
    if (!woltIntegration) {
      logger.warn('Wolt', 'Ni aktivne Wolt integracije')
      return NextResponse.json({ error: 'Wolt integracija ni konfigurirana' }, { status: 404 })
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

    // Idempotenca
    const existing = await findExistingWoltOrder(woltIntegration.id, woltOrder.order_id)
    if (existing) {
      return NextResponse.json({ status: 'accepted', orderId: existing.orderId })
    }

    // Ustvari naročilo v RestaurantOS
    const orderNumber = await getNextCounter('orderNumber')
    const deliveryAddress = woltOrder.delivery?.location?.formatted_address || ''
    const recipientName = woltOrder.delivery?.recipient?.name || 'Wolt gost'
    const recipientPhone = woltOrder.delivery?.recipient?.phone || ''

    const orderItems = await mapWoltItemsToOrderItems(woltOrder.items)
    if (orderItems.length === 0) {
      logger.error('Wolt', 'Ni bilo mogoče preslikati artiklov')
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

    // Zmanjšaj zalogo
    await deductInventoryForOrder(order.id, order.orderNumber, orderItems, 'Wolt')

    // Integracijski log + sync
    await logAndSyncIntegration(woltIntegration.id, body, order.id, order.orderNumber)

    // Broadcast NEW_ORDER to KDS/POS via WebSocket
    broadcastWS('NEW_ORDER', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: 'delivery',
      source: 'wolt',
    })

    // Sproži webhook za novo naročilo
    emitOrderCreated({
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: 'delivery',
      total: toNum(order.total),
    }).catch(err => logger.error('Wolt', 'order.created napaka:', err))

    logger.info('Wolt', `Novo naročilo #${order.orderNumber} iz Wolta`)
    return NextResponse.json({ status: 'accepted', orderId: order.id, orderNumber: order.orderNumber })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/delivery/webhook/wolt', 'Napaka pri obdelavi Wolt naročila')
  }
}
