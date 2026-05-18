import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// =====================================================================
// ONLINE ORDER API - Spletna naročila z dostavo ali prevzemom
// Podpora za: delivery, takeout z online plačilom
// Ekvivalent Toast Online Ordering za slovenski trg
// =====================================================================

// Rate limiting
const orderRateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW = 120000 // 2 minuti za online naročila

const onlineOrderItemSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  price: z.number().min(0),
  vatRate: z.number().min(0).max(100),
  notes: z.string().max(500).default(''),
  modifiersJson: z.string().max(2000).default('[]'),
})

const deliveryDetailsSchema = z.object({
  fullName: z.string().min(1, 'Ime je obvezno').max(100),
  phone: z.string().min(1, 'Telefon je obvezen').max(30),
  email: z.string().max(200).default(''),
  address: z.string().min(1, 'Naslov je obvezen').max(300),
  city: z.string().min(1, 'Mesto je obvezno').max(100),
  postCode: z.string().min(1, 'Poštna številka je obvezna').max(20),
  notes: z.string().max(1000).default(''),
  type: z.literal('delivery'),
})

const takeoutDetailsSchema = z.object({
  fullName: z.string().min(1, 'Ime je obvezno').max(100),
  phone: z.string().min(1, 'Telefon je obvezen').max(30),
  email: z.string().max(200).default(''),
  notes: z.string().max(1000).default(''),
  preferredTime: z.string().max(10).default(''),
  type: z.literal('takeout'),
})

const onlineOrderSchema = z.object({
  orderType: z.enum(['delivery', 'takeout']),
  items: z.array(onlineOrderItemSchema).min(1, 'Naročilo mora vsebovati vsaj en artikel').max(30),
  paymentMethod: z.enum(['card', 'cash', 'mobile']).default('card'),
  customer: z.union([deliveryDetailsSchema, takeoutDetailsSchema]),
  deliveryFee: z.number().min(0).default(0),
  promoCode: z.string().max(50).optional(),
  discountId: z.string().optional(),
  discountAmount: z.number().min(0).default(0),
  locationId: z.string().optional(),
})

const DELIVERY_FEE = 2.50
const MIN_ORDER_AMOUNT = 10.00

export async function POST(req: Request) {
  // Rate limiting
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'

  // Cleanup
  const now = Date.now()
  for (const [ip, entry] of orderRateLimit.entries()) {
    if (entry.resetAt <= now) orderRateLimit.delete(ip)
  }

  const rateEntry = orderRateLimit.get(clientIp)
  if (rateEntry && rateEntry.resetAt > now && rateEntry.count >= RATE_LIMIT_MAX) {
    return NextResponse.json({ error: 'Preveč naročil. Poskusite znova čez nekaj minut.' }, { status: 429 })
  }
  if (!rateEntry || rateEntry.resetAt <= now) {
    orderRateLimit.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
  } else {
    rateEntry.count++
  }

  try {
    const body = await req.json()
    const parsed = onlineOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        error: 'Neveljavni podatki',
        validationErrors: parsed.error.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, { status: 400 })
    }

    const data = parsed.data
    const { orderType, items, paymentMethod, customer, deliveryFee, promoCode, discountId, discountAmount, locationId } = data

    // Preveri minimum za dostavo
    const itemsSubtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    if (orderType === 'delivery' && itemsSubtotal < MIN_ORDER_AMOUNT) {
      return NextResponse.json({ error: `Minimalno naročilo za dostavo je €${MIN_ORDER_AMOUNT.toFixed(2)}` }, { status: 400 })
    }

    // Pridobi menu iteme iz DB (strežniška cena, NE klientova!)
    const menuItemIds = items.map(i => i.menuItemId)
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuItemIds }, isAvailable: true },
      include: { recipeItems: { include: { inventoryItem: true } } },
    })
    const menuItemMap = new Map(menuItems.map(mi => [mi.id, mi]))

    if (menuItems.length !== menuItemIds.length) {
      const foundIds = new Set(menuItems.map(m => m.id))
      const missing = menuItemIds.filter(id => !foundIds.has(id))
      return NextResponse.json({ error: 'Nekateri artikli niso na voljo', unavailableItems: missing }, { status: 400 })
    }

    // Preveri cone dostave za delivery
    if (orderType === 'delivery' && 'postCode' in customer) {
      const zones = await db.deliveryZone.findMany({ where: { isActive: true } })
      const matchingZone = zones.find(zone => {
        try {
          const postCodes: string[] = JSON.parse(zone.postCodes)
          const cities: string[] = JSON.parse(zone.cities)
          const postCodeMatch = postCodes.includes(customer.postCode)
          const cityMatch = cities.some(c => customer.city.toLowerCase().includes(c.toLowerCase()))
          return postCodeMatch || cityMatch
        } catch { return false }
      })

      if (!matchingZone && zones.length > 0) {
        // Ima cone dostave, ta naslov pa ni v nobeni
        return NextResponse.json({
          error: 'Na ta naslov ne dostavljamo. Izberite prevzem na lokaciji.',
          deliverable: false,
        }, { status: 400 })
      }

      if (matchingZone && itemsSubtotal < matchingZone.minOrderAmount) {
        return NextResponse.json({
          error: `Minimalno naročilo za cono "${matchingZone.name}" je €${matchingZone.minOrderAmount.toFixed(2)}`,
        }, { status: 400 })
      }
    }

    // Preveri lokacijo
    if (locationId) {
      const location = await db.location.findUnique({ where: { id: locationId } })
      if (!location || !location.isActive) {
        return NextResponse.json({ error: 'Izbrana lokacija ni na voljo' }, { status: 400 })
      }
    }

    // Generiraj številko naročila
    let nextOrderNumber: number
    try {
      const counter = await db.counter.upsert({
        where: { name: 'orderNumber' },
        update: { value: { increment: 1 } },
        create: { name: 'orderNumber', value: 1 },
      })
      nextOrderNumber = counter.value
    } catch {
      const maxOrder = await db.order.findFirst({ orderBy: { orderNumber: 'desc' }, select: { orderNumber: true } })
      nextOrderNumber = (maxOrder?.orderNumber || 0) + 1
    }

    // Generiraj številko čeka
    let nextCheckNumber: number
    try {
      const counter = await db.counter.upsert({
        where: { name: 'checkNumber' },
        update: { value: { increment: 1 } },
        create: { name: 'checkNumber', value: 1 },
      })
      nextCheckNumber = counter.value
    } catch {
      nextCheckNumber = 1
    }

    // Izračunaj zneske iz strežniških podatkov
    let subtotal = 0
    let totalVat = 0
    const orderItemsData: Array<{
      menuItemId: string; quantity: number; price: number; vatRate: number; vatAmount: number; notes: string; modifiersJson: string;
    }> = []

    for (const item of items) {
      const menuItem = menuItemMap.get(item.menuItemId)
      if (!menuItem) continue

      const qty = item.quantity
      const itemBase = menuItem.price * qty
      const itemVat = itemBase * (menuItem.vatRate / 100)
      subtotal += itemBase
      totalVat += itemVat

      orderItemsData.push({
        menuItemId: menuItem.id,
        quantity: qty,
        price: menuItem.price,
        vatRate: menuItem.vatRate,
        vatAmount: itemVat,
        notes: item.notes,
        modifiersJson: item.modifiersJson,
      })
    }

    const actualDeliveryFee = orderType === 'delivery' ? deliveryFee || DELIVERY_FEE : 0
    const discount = discountAmount || 0
    const total = Math.max(0, subtotal + totalVat + actualDeliveryFee - discount)

    // Poišči ali ustvari dining option
    let diningOption = await db.diningOption.findFirst({ where: { type: orderType } })
    if (!diningOption) {
      diningOption = await db.diningOption.create({
        data: {
          name: orderType === 'delivery' ? 'Dostava' : 'Za s seboj',
          type: orderType,
          isActive: true,
          sortOrder: orderType === 'takeout' ? 1 : 2,
          prepTimeMinutes: orderType === 'delivery' ? 30 : 15,
        },
      })
    }

    // Stranka podatki
    const customerName = customer.fullName
    const customerPhone = customer.phone
    const customerEmail = 'email' in customer ? customer.email : ''
    const customerNotes = customer.notes || ''

    // Naslov za dostavo
    const deliveryAddress = orderType === 'delivery' && 'address' in customer
      ? `${customer.address}, ${customer.postCode} ${customer.city}`
      : ''

    const orderNotes = [
      orderType === 'delivery' ? `ONLINE DOSTAVA → ${deliveryAddress}` : 'ONLINE PREVZEM',
      customerNotes ? `Opombe: ${customerNotes}` : '',
      paymentMethod === 'cash' ? 'PLAČILO: Gotovina ob prevzemu' : `PLAČILO: ${paymentMethod === 'card' ? 'Kartica' : 'Mobilno'}`,
      'preferredTime' in customer && customer.preferredTime ? `Želen čas: ${customer.preferredTime}` : '',
      promoCode ? `PROMO: ${promoCode} (-€${discount.toFixed(2)})` : '',
    ].filter(Boolean).join(' | ')

    // Ustvari naročilo + zaloga + ček + dostava v transakciji
    const order = await db.$transaction(async (tx) => {
      // Ustvari DeliveryInfo za dostavo
      let deliveryInfoId: string | undefined
      if (orderType === 'delivery' && 'address' in customer) {
        const deliveryInfo = await tx.deliveryInfo.create({
          data: {
            address: customer.address,
            city: customer.city,
            postCode: customer.postCode,
            recipientName: customer.fullName,
            recipientPhone: customer.phone,
            deliveryInstructions: customer.notes || '',
            status: 'pending',
            deliveryFee: actualDeliveryFee,
            estimatedTime: new Date(Date.now() + 30 * 60 * 1000), // 30 min od zdaj
          },
        })
        deliveryInfoId = deliveryInfo.id
      }

      const newOrder = await tx.order.create({
        data: {
          orderNumber: nextOrderNumber,
          type: orderType,
          status: 'pending',
          subtotal,
          tax: totalVat,
          discount,
          total,
          totalWithTip: total,
          customerName,
          customerPhone,
          customerEmail,
          notes: orderNotes,
          paymentMethod: paymentMethod === 'cash' ? 'gotovina' : paymentMethod === 'card' ? 'kartica' : 'mobilno',
          paymentStatus: paymentMethod === 'cash' ? 'unpaid' : 'paid',
          paidAt: paymentMethod !== 'cash' ? new Date() : null,
          diningOptionId: diningOption!.id,
          deliveryInfoId,
          inventoryDeducted: false,
          locationId: locationId || null,
          orderItems: { create: orderItemsData },
        },
        include: { orderItems: true },
      })

      // Ustvari Check za plačilo
      const check = await tx.check.create({
        data: {
          checkNumber: nextCheckNumber,
          orderId: newOrder.id,
          subtotal,
          tax: totalVat,
          discount,
          serviceCharge: actualDeliveryFee,
          total: subtotal + totalVat + actualDeliveryFee - discount,
          tip: 0,
          totalWithTip: subtotal + totalVat + actualDeliveryFee - discount,
          paymentStatus: paymentMethod === 'cash' ? 'unpaid' : 'paid',
          paymentMethod: paymentMethod === 'cash' ? 'cash' : paymentMethod === 'card' ? 'card' : 'mobile',
          orderItems: { connect: newOrder.orderItems.map(oi => ({ id: oi.id })) },
        },
      })

      // Ustvari Payment zapis za kartico/mobilno
      if (paymentMethod !== 'cash') {
        await tx.payment.create({
          data: {
            checkId: check.id,
            amount: total,
            tipAmount: 0,
            type: paymentMethod === 'card' ? 'card' : 'mobile',
            status: 'completed',
          },
        })

        // Označi ček kot plačan
        await tx.check.update({
          where: { id: check.id },
          data: { paymentStatus: 'paid' },
        })
      }

      // Poveži order items s checkom
      await tx.orderItem.updateMany({
        where: { orderId: newOrder.id },
        data: { checkId: check.id },
      })

      // Zmanjšaj zalogo
      for (const item of items) {
        const menuItem = menuItemMap.get(item.menuItemId)
        if (!menuItem) continue
        for (const recipe of menuItem.recipeItems) {
          if (!recipe.inventoryItem) continue
          const deductQty = recipe.quantityPerServing * item.quantity
          const currentInvItem = await tx.inventoryItem.findUnique({ where: { id: recipe.inventoryItem.id } })
          if (!currentInvItem) continue
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
                previousQty: currentInvItem.quantity,
                newQty: currentInvItem.quantity - deductQty,
                costPerUnit: currentInvItem.costPerUnit,
                totalCost: deductQty * currentInvItem.costPerUnit,
                reason: `Online naročilo #${nextOrderNumber}`,
                orderId: newOrder.id,
              },
            })
          }
        }
      }

      await tx.order.update({ where: { id: newOrder.id }, data: { inventoryDeducted: true } })

      // Ustvari goste zapis če je email na voljo
      if (customerEmail) {
        const existingGuest = await tx.guest.findFirst({ where: { email: customerEmail } })
        if (existingGuest) {
          await tx.guest.update({
            where: { id: existingGuest.id },
            data: {
              firstName: customerName.split(' ')[0] || customerName,
              lastName: customerName.split(' ').slice(1).join(' ') || customerName,
              phone: customerPhone,
              totalVisits: { increment: 1 },
              totalSpent: { increment: total },
              lastVisitAt: new Date(),
            },
          })
        } else {
          await tx.guest.create({
            data: {
              firstName: customerName.split(' ')[0] || customerName,
              lastName: customerName.split(' ').slice(1).join(' ') || '-',
              email: customerEmail,
              phone: customerPhone,
              totalVisits: 1,
              totalSpent: total,
              lastVisitAt: new Date(),
              firstVisitAt: new Date(),
            },
          })
        }
      }

      // Uporabi popust če je promo koda
      if (discountId && promoCode) {
        await tx.discount.update({
          where: { id: discountId },
          data: { currentUses: { increment: 1 } },
        }).catch(() => {}) // Ne blokiraj če ne najde
      }

      return newOrder
    })

    // Sproži webhook za novo online naročilo (ne blokiraj odziva)
    triggerWebhookAsync('order.created', {
      orderId: order.id,
      orderNumber: String(order.orderNumber),
      type: orderType,
      total,
      customerName,
      customerPhone,
      paymentMethod,
      source: 'online',
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: String(order.orderNumber),
        status: order.status,
        total: order.total,
        orderType,
        estimatedTime: orderType === 'delivery' ? '30-45 min' : '15-25 min',
        deliveryAddress,
        paymentMethod,
      },
    }, { status: 201 })

  } catch (error: any) {
    console.error('Online order error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju naročila' }, { status: 500 })
  }
}

// Async webhook trigger — ne blokiraj odziva
async function triggerWebhookAsync(event: string, payload: any) {
  try {
    const webhooks = await db.webhook.findMany({
      where: { isActive: true },
    })
    const matchingWebhooks = webhooks.filter(wh => {
      try {
        const events: string[] = JSON.parse(wh.events)
        return events.includes(event)
      } catch { return false }
    })

    for (const webhook of matchingWebhooks) {
      // Ustvari webhook delivery zapis
      await db.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          event,
          payload: JSON.stringify(payload),
          statusCode: 0,
          success: false,
          attemptCount: 0,
          maxAttempts: 5,
          nextRetryAt: new Date(),
        },
      })
    }
  } catch (e) {
    console.error('Webhook trigger error:', e)
  }
}
