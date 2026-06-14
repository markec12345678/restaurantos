// ============================================
// GLOVO INBOUND WEBHOOK — Sprejemanje naročil iz Glovo platforme
// Glovo pošlje naročilo na ta endpoint ko gost naroči
// Dokumentacija: Glovo Partners API
// ============================================
// FIX: Helper za WebSocket broadcast
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { verifySignature } from '@/lib/webhook-engine'
import { getNextCounter } from '@/lib/counters'
import { emitOrderCreated } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { toNum, calcVat, multiply, round2, sumBy } from '@/lib/decimal'
import { checkRateLimit, getClientIp, DELIVERY_WEBHOOK_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
async function broadcastWS(type: string, payload: unknown) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`
    await fetch(`${appUrl}/api/ws-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch {
    // WS strežnik ni na voljo
  }
}
// Glovo uporablja HMAC-SHA256 v glavi
const GLOVO_SIGNATURE_HEADER = 'x-glovo-signature'
// Validacijska shema za Glovo naročilo
const glovoOrderSchema = z.object({
  order_id: z.string(),
  store_id: z.string().optional(),
  status: z.string().default('pending'),
  delivery_address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    details: z.string().optional(),
  }).optional(),
  customer: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  products: z.array(z.object({
    product_id: z.string(),
    name: z.string(),
    quantity: z.number().min(1),
    price: z.number().optional(),
    description: z.string().optional(),
  })).min(1),
  payment: z.object({
    method: z.string().optional(),
    amount: z.number().optional(),
  }).optional(),
  comment: z.string().optional(),
})
// POST /api/delivery/webhook/glovo — Glovo pošlje naročilo
export async function POST(req: Request) {
  try {
    // FIX: Rate limit za Glovo webhook — prepreči ponovne pošiljanke (replay attacks)
    const ip = getClientIp(req)
    const rateLimit = checkRateLimit('glovo-webhook', ip, DELIVERY_WEBHOOK_LIMIT)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Preveč zahtevkov' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.retryAfterMs || 60000) / 1000)) } }
      )
    }
    const body = await req.text()
    const signature = req.headers.get(GLOVO_SIGNATURE_HEADER) || ''
    // Preveri Glovo integracijo
    const glovoIntegration = await db.integration.findFirst({
      where: { provider: 'glovo', isActive: true },
    })
    if (!glovoIntegration) {
      logger.warn('Glovo', 'Ni aktivne Glovo integracije')
      return NextResponse.json({ error: 'Glovo integracija ni konfigurirana' }, { status: 404 })
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
    // FIX D-02 HIGH: Idempotenca z natančnim ujemanjem order_id, NE substring contains
    // contains lahko dela false positive (npr. "12" ujema "12345"), zato najprej
    // pridobimo kandidate, nato parsamo JSON in primerjamo order_id natančno
    const candidateLogs = await db.integrationLog.findMany({
      where: {
        integrationId: glovoIntegration.id,
        action: 'receive_order',
        direction: 'inbound',
        status: 'success',
        OR: [
          { requestData: { contains: `"order_id":"${glovoOrder.order_id}"` } },
          { requestData: { contains: `"order_id": "${glovoOrder.order_id}"` } },
        ],
      },
    })
    const existingLog = candidateLogs.find(log => {
      try {
        const data = JSON.parse(log.requestData || '{}')
        return data.order_id === glovoOrder.order_id
      } catch {
        return false
      }
    })
    if (existingLog) {
      const existingOrderId = (() => { try { return JSON.parse(existingLog.responseData || '{}').orderId } catch { return null } })()
      return NextResponse.json({ status: 'accepted', orderId: existingOrderId })
    }
    // Backward compat: preveri tudi notes
    const existingOrder = await db.order.findFirst({
      where: { notes: { contains: `GLOVO:${glovoOrder.order_id}` } },
    })
    if (existingOrder) {
      return NextResponse.json({ status: 'accepted', orderId: existingOrder.id })
    }
    // Ustvari naročilo v RestaurantOS
    const orderNumber = await getNextCounter('orderNumber')
    const deliveryAddress = [
      glovoOrder.delivery_address?.street,
      glovoOrder.delivery_address?.city,
      glovoOrder.delivery_address?.details,
    ].filter(Boolean).join(', ')
    const customerName = glovoOrder.customer?.name || 'Glovo gost'
    const customerPhone = glovoOrder.customer?.phone || ''
    const _totalAmount = glovoOrder.payment?.amount || 0
    // Preslikaj artikle
    const orderItems: Array<{
      menuItemId: string
      quantity: number
      price: number
      vatRate: number
      vatAmount: number
      discountAmount: number
      notes: string
      status: string
    }> = []
    for (const product of glovoOrder.products) {
      // FIX: Only match available menu items
      const menuItem = await db.menuItem.findFirst({
        where: {
          isAvailable: true,
          OR: [
            { id: product.product_id },
            { name: product.name },
          ],
        },
      })
      if (menuItem) {
        orderItems.push({
          menuItemId: menuItem.id,
          quantity: product.quantity,
          price: toNum(menuItem.price),
          vatRate: toNum(menuItem.vatRate),
          vatAmount: calcVat(toNum(menuItem.price), menuItem.vatRate),
          discountAmount: 0,
          notes: product.description || '',
          status: 'pending' as const,
        })
      }
    }
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
        paymentMethod: glovoOrder.payment?.method || 'card', // Uporabi plačilno metodo iz webhooka
        paidAt: glovoOrder.payment?.method ? new Date() : null,
        notes: `GLOVO:${glovoOrder.order_id}${glovoOrder.comment ? ' | ' + glovoOrder.comment : ''}`,
        inventoryDeducted: false, // FIX CRITICAL: Zaloga še ni zmanjšana — se posodobi na true po uspešnem dedukciji
        orderItems: { create: orderItems },
        // FIX: Create DeliveryInfo record for delivery tracking
        // FIX CRITICAL: DeliveryInfo model nima polj 'provider' in 'externalId'
        // Uporabimo deliveryInstructions za shranjevanje Glovo order ID-ja
        deliveryInfo: {
          create: {
            address: deliveryAddress || 'Glovo dostava',
            recipientName: customerName,
            recipientPhone: customerPhone,
            deliveryInstructions: `Glovo Order ID: ${glovoOrder.order_id}`,
            status: 'pending',
            estimatedTime: new Date(Date.now() + 30 * 60 * 1000),
            deliveryFee: 0, // Glovo plača dostavo
          },
        },
      },
      include: {
        orderItems: { include: { menuItem: true } },
      },
    })
    // FIX CRITICAL: Zmanjšaj zalogo za Glovo naročila ZNOTRAJ transakcije
    // Prejšnja koda je bila zunaj transakcije — recipe.inventoryItem.quantity je bil stale (race condition)
    try {
      await db.$transaction(async (tx) => {
        for (const item of orderItems) {
          const menuItem = await tx.menuItem.findUnique({
            where: { id: item.menuItemId },
            include: { recipeItems: { include: { inventoryItem: true } } },
          })
          if (!menuItem) continue
          for (const recipe of menuItem.recipeItems) {
            if (!recipe.inventoryItem) continue
            const deductQty = toNum(recipe.quantityPerServing) * item.quantity
            const currentInv = await tx.inventoryItem.findUnique({ where: { id: recipe.inventoryItem.id } })
            if (!currentInv) continue
            const updated = await tx.inventoryItem.updateMany({
              where: { id: recipe.inventoryItem.id, quantity: { gte: deductQty } },
              data: { quantity: { decrement: deductQty } },
            })
            if (updated.count > 0) {
              await tx.stockTransaction.create({
                data: {
                  inventoryItemId: recipe.inventoryItem.id,
                  type: 'sale',
                  quantity: -deductQty,
                  previousQty: toNum(currentInv.quantity),
                  newQty: toNum(currentInv.quantity) - deductQty,
                  costPerUnit: toNum(currentInv.costPerUnit),
                  totalCost: deductQty * toNum(currentInv.costPerUnit),
                  reason: `Glovo naročilo #${order.orderNumber}`,
                  orderId: order.id,
                },
              })
            }
          }
        }
        await tx.order.update({ where: { id: order.id }, data: { inventoryDeducted: true } })
      })
    } catch (stockErr: unknown) {
      logger.warn('Glovo', 'Zmanjšanje zaloge ni uspelo:', stockErr)
      // Naročilo je že ustvarjeno — zaloga bo ročno usklajena
    }
    // Integracijski log
    await db.integrationLog.create({
      data: {
        integrationId: glovoIntegration.id,
        action: 'receive_order',
        direction: 'inbound',
        status: 'success',
        statusCode: 200,
        requestData: body.substring(0, 2000),
        responseData: JSON.stringify({ orderId: order.id, orderNumber: order.orderNumber }),
        durationMs: 0,
      },
    })
    // Posodobi integracijo
    await db.integration.update({
      where: { id: glovoIntegration.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        connectionStatus: 'connected',
      },
    })
    // FIX: Broadcast NEW_ORDER to KDS/POS via WebSocket
    broadcastWS('NEW_ORDER', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: 'delivery',
      source: 'glovo',
    })
    // Sproži webhook za novo naročilo
    emitOrderCreated({
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: 'delivery',
      total: toNum(order.total),
    }).catch(err => logger.error('Glovo', 'order.created napaka:', err))
    logger.info('Glovo', `Novo naročilo #${order.orderNumber} iz Glova`)
    return NextResponse.json({ status: 'accepted', orderId: order.id, orderNumber: order.orderNumber })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/delivery/webhook/glovo', 'Napaka pri obdelavi Glovo naročila')
  }
}
