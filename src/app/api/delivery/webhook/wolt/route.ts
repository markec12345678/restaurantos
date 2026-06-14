// ============================================
// WOLT INBOUND WEBHOOK — Sprejemanje naročil iz Wolt platforme
// Wolt pošlje naročilo na ta endpoint ko gost naroči
// Dokumentacija: Wolt Merchant API
// ============================================
// FIX: Helper za WebSocket broadcast (enak kot v orders/[id]/route.ts)
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
// Wolt webhook signature header
const WOLT_SIGNATURE_HEADER = 'x-wolt-signature'
// Validacijska shema za Wolt naročilo
const woltOrderSchema = z.object({
  order_id: z.string(),
  order_number: z.string().optional(),
  status: z.string().default('pending'),
  pickup: z.object({
    location: z.object({
      formatted_address: z.string(),
    }).optional(),
  }).optional(),
  delivery: z.object({
    location: z.object({
      formatted_address: z.string(),
    }),
    recipient: z.object({
      name: z.string(),
      phone: z.string().optional(),
    }).optional(),
    comment: z.string().optional(),
  }).optional(),
  items: z.array(z.object({
    item_id: z.string(),
    name: z.string(),
    count: z.number().min(1),
    unit_price: z.number().optional(),
    options: z.array(z.object({
      id: z.string().optional(),
      name: z.string().optional(),
    })).optional(),
  })).min(1),
  payment: z.object({
    method: z.string().optional(),
    total: z.number().optional(),
  }).optional(),
  notes: z.string().optional(),
})
// POST /api/delivery/webhook/wolt — Wolt pošlje naročilo
export async function POST(req: Request) {
  try {
    // FIX: Rate limit za Wolt webhook — prepreči ponovne pošiljanke (replay attacks)
    const ip = getClientIp(req)
    const rateLimit = checkRateLimit('wolt-webhook', ip, DELIVERY_WEBHOOK_LIMIT)
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
    // FIX D-02 HIGH: Idempotenca z natančnim ujemanjem order_id, NE substring contains
    // contains lahko dela false positive (npr. "12" ujema "12345"), zato najprej
    // pridobimo kandidate, nato parsamo JSON in primerjamo order_id natančno
    const candidateLogs = await db.integrationLog.findMany({
      where: {
        integrationId: woltIntegration.id,
        action: 'receive_order',
        direction: 'inbound',
        status: 'success',
        OR: [
          { requestData: { contains: `"order_id":"${woltOrder.order_id}"` } },
          { requestData: { contains: `"order_id": "${woltOrder.order_id}"` } },
        ],
      },
    })
    const existingLog = candidateLogs.find(log => {
      try {
        const data = JSON.parse(log.requestData || '{}')
        return data.order_id === woltOrder.order_id
      } catch {
        return false
      }
    })
    if (existingLog) {
      // Naročilo že obdelano — idempotentno vrni uspeh
      const existingOrderId = (() => { try { return JSON.parse(existingLog.responseData || '{}').orderId } catch { return null } })()
      return NextResponse.json({ status: 'accepted', orderId: existingOrderId })
    }
    // Backward compat: preveri tudi notes
    const existingOrder = await db.order.findFirst({
      where: { notes: { contains: `WOLT:${woltOrder.order_id}` } },
    })
    if (existingOrder) {
      // Naročilo že obstaja — vrni ga (idempotentno)
      return NextResponse.json({ status: 'accepted', orderId: existingOrder.id })
    }
    // Ustvari naročilo v RestaurantOS
    const orderNumber = await getNextCounter('orderNumber')
    const deliveryAddress = woltOrder.delivery?.location?.formatted_address || ''
    const recipientName = woltOrder.delivery?.recipient?.name || 'Wolt gost'
    const recipientPhone = woltOrder.delivery?.recipient?.phone || ''
    const _totalAmount = woltOrder.payment?.total || 0
    // FIX LOW: config se parsira ampak ne uporabi — odstrani unused spremenljivko
    // const config = JSON.parse(woltIntegration.config || '{}')
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
    for (const item of woltOrder.items) {
      // FIX: Only match available menu items (prevent ordering unavailable items)
      const menuItem = await db.menuItem.findFirst({
        where: {
          isAvailable: true,
          OR: [
            { id: item.item_id },
            { name: item.name },
          ],
        },
      })
      if (menuItem) {
        orderItems.push({
          menuItemId: menuItem.id,
          quantity: item.count,
          price: toNum(menuItem.price),
          vatRate: toNum(menuItem.vatRate),
          vatAmount: calcVat(toNum(menuItem.price), menuItem.vatRate),
          discountAmount: 0,
          notes: item.options?.map(o => o.name).filter(Boolean).join(', ') || '',
          status: 'pending' as const,
        })
      }
    }
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
        paymentMethod: woltOrder.payment?.method || 'card', // Uporabi plačilno metodo iz webhooka
        paidAt: woltOrder.payment?.method ? new Date() : null,
        notes: `WOLT:${woltOrder.order_id}${woltOrder.notes ? ' | ' + woltOrder.notes : ''}`,
        inventoryDeducted: false, // FIX CRITICAL: Zaloga še ni zmanjšana — se posodobi na true po uspešnem dedukciji
        orderItems: { create: orderItems },
        // FIX: Create DeliveryInfo record for delivery tracking
        // FIX CRITICAL: DeliveryInfo model nima polj 'provider' in 'externalId'
        // Uporabimo deliveryInstructions za shranjevanje Wolt order ID-ja
        deliveryInfo: {
          create: {
            address: deliveryAddress || 'Wolt dostava',
            recipientName,
            recipientPhone,
            deliveryInstructions: `Wolt Order ID: ${woltOrder.order_id}`,
            status: 'pending',
            estimatedTime: new Date(Date.now() + 30 * 60 * 1000), // 30 min default — Wolt ne pošilja ETA v webhooku
            deliveryFee: 0, // Wolt plača dostavo
          },
        },
      },
      include: {
        orderItems: { include: { menuItem: true } },
      },
    })
    // FIX CRITICAL: Zmanjšaj zalogo za Wolt naročila ZNOTRAJ transakcije
    // Prejšnja koda je bila zunaj transakcije — recipe.inventoryItem.quantity je bil stale (race condition)
    // Kar je povzročilo napačne previousQty/newQty v stockTransaction in dvojno razknjiževanje
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
            // FIX: Preberi trenutno količino ZNOTRAJ transakcije
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
                  reason: `Wolt naročilo #${order.orderNumber}`,
                  orderId: order.id,
                },
              })
            }
          }
        }
        await tx.order.update({ where: { id: order.id }, data: { inventoryDeducted: true } })
      })
    } catch (stockErr: unknown) {
      logger.warn('Wolt', 'Zmanjšanje zaloge ni uspelo:', stockErr)
      // Naročilo je že ustvarjeno — zaloga bo ročno usklajena
    }
    // Zabeleži v integracijski log
    await db.integrationLog.create({
      data: {
        integrationId: woltIntegration.id,
        action: 'receive_order',
        direction: 'inbound',
        status: 'success',
        statusCode: 200,
        requestData: body.substring(0, 2000),
        responseData: JSON.stringify({ orderId: order.id, orderNumber: order.orderNumber }),
        durationMs: 0,
      },
    })
    // Posodobi zadnjo sinhronizacijo
    await db.integration.update({
      where: { id: woltIntegration.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        connectionStatus: 'connected',
      },
    })
    // FIX: Broadcast NEW_ORDER to KDS/POS via WebSocket — kitchen needs to know!
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
