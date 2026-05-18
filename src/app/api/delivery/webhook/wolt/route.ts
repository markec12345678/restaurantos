// ============================================
// WOLT INBOUND WEBHOOK — Sprejemanje naročil iz Wolt platforme
// Wolt pošlje naročilo na ta endpoint ko gost naroči
// Dokumentacija: Wolt Merchant API
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { verifySignature } from '@/lib/webhook-engine'
import { getNextCounter } from '@/lib/counters'
import { emitOrderCreated } from '@/lib/event-emitter'
import { z } from 'zod'

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
    const body = await req.text()
    const signature = req.headers.get(WOLT_SIGNATURE_HEADER) || ''

    // Preveri Wolt integracijo
    const woltIntegration = await db.integration.findFirst({
      where: { provider: 'wolt', isActive: true },
    })

    if (!woltIntegration) {
      console.warn('[Wolt Webhook] Ni aktivne Wolt integracije')
      return NextResponse.json({ error: 'Wolt integracija ni konfigurirana' }, { status: 404 })
    }

    // Preveri podpis če je secret nastavljen
    if (woltIntegration.apiSecret) {
      const isValid = verifySignature(body, signature, woltIntegration.apiSecret)
      if (!isValid) {
        console.warn('[Wolt Webhook] Neveljaven podpis')
        return NextResponse.json({ error: 'Neveljaven podpis' }, { status: 401 })
      }
    }

    // Parsaj in validiraj
    const parsed = woltOrderSchema.safeParse(JSON.parse(body))
    if (!parsed.success) {
      console.error('[Wolt Webhook] Neveljavni podatki:', parsed.error.issues)
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    const woltOrder = parsed.data

    // Preveri, da naročilo še ne obstaja (idempotenca)
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
    const totalAmount = woltOrder.payment?.total || 0

    // Poišči menu iteme po Wolt ID-jih
    const config = JSON.parse(woltIntegration.config || '{}')
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
      // Poišči artikel po ID-ju iz konfiguracije ali po imenu
      const menuItem = await db.menuItem.findFirst({
        where: {
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
          price: menuItem.price,
          vatRate: menuItem.vatRate,
          vatAmount: Math.round(menuItem.price * (menuItem.vatRate / 100) * 100) / 100,
          discountAmount: 0,
          notes: item.options?.map(o => o.name).filter(Boolean).join(', ') || '',
          status: 'pending' as const,
        })
      }
    }

    if (orderItems.length === 0) {
      console.error('[Wolt Webhook] Ni bilo mogoče preslikati artiklov')
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
        customerName: recipientName,
        customerPhone: recipientPhone,
        subtotal,
        tax: totalTax,
        discount: 0,
        total,
        tip: 0,
        totalWithTip: total,
        paymentStatus: totalAmount > 0 ? 'paid' : 'unpaid',
        paymentMethod: 'card', // Wolt plača kartico
        paidAt: totalAmount > 0 ? new Date() : null,
        notes: `WOLT:${woltOrder.order_id}${woltOrder.notes ? ' | ' + woltOrder.notes : ''}`,
        inventoryDeducted: false,
        orderItems: { create: orderItems },
      },
      include: {
        orderItems: { include: { menuItem: true } },
      },
    })

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

    // Sproži webhook za novo naročilo
    emitOrderCreated({
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: 'delivery',
      total: order.total,
    }).catch(err => console.error('[Webhook] order.created napaka:', err))

    console.log(`[Wolt Webhook] Novo naročilo #${order.orderNumber} iz Wolta`)
    return NextResponse.json({ status: 'accepted', orderId: order.id, orderNumber: order.orderNumber })
  } catch (error) {
    console.error('[Wolt Webhook] Napaka:', error)
    return NextResponse.json({ error: 'Napaka pri obdelavi Wolt naročila' }, { status: 500 })
  }
}
