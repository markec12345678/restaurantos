// ============================================
// GLOVO INBOUND WEBHOOK — Sprejemanje naročil iz Glovo platforme
// Glovo pošlje naročilo na ta endpoint ko gost naroči
// Dokumentacija: Glovo Partners API
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { verifySignature } from '@/lib/webhook-engine'
import { getNextCounter } from '@/lib/counters'
import { emitOrderCreated } from '@/lib/event-emitter'
import { z } from 'zod'

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
    const body = await req.text()
    const signature = req.headers.get(GLOVO_SIGNATURE_HEADER) || ''

    // Preveri Glovo integracijo
    const glovoIntegration = await db.integration.findFirst({
      where: { provider: 'glovo', isActive: true },
    })

    if (!glovoIntegration) {
      console.warn('[Glovo Webhook] Ni aktivne Glovo integracije')
      return NextResponse.json({ error: 'Glovo integracija ni konfigurirana' }, { status: 404 })
    }

    // Preveri podpis če je secret nastavljen
    if (glovoIntegration.apiSecret) {
      const isValid = verifySignature(body, signature, glovoIntegration.apiSecret)
      if (!isValid) {
        console.warn('[Glovo Webhook] Neveljaven podpis')
        return NextResponse.json({ error: 'Neveljaven podpis' }, { status: 401 })
      }
    }

    // Parsaj in validiraj
    const parsed = glovoOrderSchema.safeParse(JSON.parse(body))
    if (!parsed.success) {
      console.error('[Glovo Webhook] Neveljavni podatki:', parsed.error.issues)
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    const glovoOrder = parsed.data

    // Idempotenca — preveri, da naročilo še ne obstaja
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
    const totalAmount = glovoOrder.payment?.amount || 0

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
      const menuItem = await db.menuItem.findFirst({
        where: {
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
          price: menuItem.price,
          vatRate: menuItem.vatRate,
          vatAmount: Math.round(menuItem.price * (menuItem.vatRate / 100) * 100) / 100,
          discountAmount: 0,
          notes: product.description || '',
          status: 'pending' as const,
        })
      }
    }

    if (orderItems.length === 0) {
      console.error('[Glovo Webhook] Ni bilo mogoče preslikati artiklov')
      return NextResponse.json({ error: 'Artikli niso najdeni' }, { status: 400 })
    }

    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const totalTax = Math.round(orderItems.reduce((sum, item) => sum + item.vatAmount * item.quantity, 0) * 100) / 100
    const total = Math.round((subtotal + totalTax) * 100) / 100

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
        paymentStatus: totalAmount > 0 ? 'paid' : 'unpaid',
        paymentMethod: 'card',
        paidAt: totalAmount > 0 ? new Date() : null,
        notes: `GLOVO:${glovoOrder.order_id}${glovoOrder.comment ? ' | ' + glovoOrder.comment : ''}`,
        inventoryDeducted: false,
        orderItems: { create: orderItems },
      },
      include: {
        orderItems: { include: { menuItem: true } },
      },
    })

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

    // Sproži webhook za novo naročilo
    emitOrderCreated({
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: 'delivery',
      total: order.total,
    }).catch(err => console.error('[Webhook] order.created napaka:', err))

    console.log(`[Glovo Webhook] Novo naročilo #${order.orderNumber} iz Glova`)
    return NextResponse.json({ status: 'accepted', orderId: order.id, orderNumber: order.orderNumber })
  } catch (error) {
    console.error('[Glovo Webhook] Napaka:', error)
    return NextResponse.json({ error: 'Napaka pri obdelavi Glovo naročila' }, { status: 500 })
  }
}
