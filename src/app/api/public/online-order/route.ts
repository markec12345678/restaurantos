
// =====================================================================
// ONLINE ORDER API - Spletna naročila z dostavo ali prevzemom
// Podpora za: delivery, takeout z online plačilom
// Ekvivalent Toast Online Ordering za slovenski trg
// FIX CRITICAL: Skupni rate limiter modul
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getClientIp, ONLINE_ORDER_LIMIT } from '@/lib/rate-limit'
import { toNum, isPositive, calcVat, calcDiscount } from '@/lib/decimal'
import { logger } from '@/lib/logger'
import { handleRouteError, validateRequest } from '@/lib/api-utils'
const onlineOrderItemSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  // FIX BUG-06: price in vatRate se IGNORIRAJO — strežnik uporabi ceno iz baze
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
  // FIX Q02 CRITICAL: deliveryFee ODSTRANJEN iz klientne sheme — strežnik izračuna iz cone dostave
  // Prejšnja koda je dovolila klientu, da pošlje poljuben deliveryFee, kar omogoča price tampering
  // deliveryFee: z.number().min(0).default(0), // ODNSTRANJENO — varnostna luknja
  promoCode: z.string().max(50).optional(),
  // FIX MEDIUM: discountId ODSTRANJEN iz javne sheme — notranji ID naj ne bo izpostavljen
  // Popust se išče po promoCode (naravni ključ za javne uporabnike)
  // discountId: z.string().optional(), // ODNSTRANJENO — varnostna luknja (ID enumeration)
  locationId: z.string().optional(),
})

const DELIVERY_FEE = 2.50
const DELIVERY_FEE_VAT_RATE = 22 // Slovenian standard VAT rate for delivery fees (EU/SI requirement)
const MIN_ORDER_AMOUNT = 10.00

export async function POST(req: Request) {
  // FIX CRITICAL: Rate limiting — skupni modul
  const clientIp = getClientIp(req)
  const rateCheck = checkRateLimit('online-order', clientIp, ONLINE_ORDER_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Preveč naročil. Poskusite znova čez nekaj minut.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 120000) / 1000)) } }
    )
  }

  try {
    // FIX: Check if restaurant is open before accepting online orders
    // FIX MEDIUM: Fail-CLOSED, ne fail-open — če nastavitv ni mogoče prebrati, ZAPRI naročila
    try {
      // FIX: Uporabi OpeningHours model (ne Configuration, ki ne obstaja v Prisma shemi)
      const hours = await db.openingHours.findMany({ where: {} })
      if (hours && hours.length > 0) {
        // FIX MEDIUM: Uporabi slovenski čas (CET/CEST), ne strežnikov lokalni čas
        const slovenianTime = new Date().toLocaleString('en-US', { timeZone: 'Europe/Ljubljana' })
        const now = new Date(slovenianTime)
        const dayOfWeek = now.getDay()
        const todayHours = hours.find(h => h.dayOfWeek === dayOfWeek)
        if (!todayHours || todayHours.isClosed) {
          return NextResponse.json({ error: 'Restavracija je trenutno zaprta.' }, { status: 403 })
        }
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        if (todayHours.openTime && currentTime < todayHours.openTime) {
          return NextResponse.json({ error: 'Restavracija še ni odprta.' }, { status: 403 })
        }
        if (todayHours.closeTime && currentTime > todayHours.closeTime) {
          return NextResponse.json({ error: 'Restavracija je že zaprta.' }, { status: 403 })
        }
      }
    } catch (configError: unknown) {
      // FIX MEDIUM: Fail-CLOSED — če nastavitve ni mogoče prebrati, blokiraj naročila
      // Varnostno načelo: raje zavrnemo naročilo kot pa sprejmemo, ko smo zaprti
      logger.error('API', '[ONLINE-ORDER] Napaka pri preverjanju odpiralnega časa:', configError)
      return NextResponse.json({ error: 'Ni mogoče preveriti odpiralnega časa. Poskusite znova.' }, { status: 503 })
    }

    const { data, error: validationError } = await validateRequest(req, onlineOrderSchema)
    if (validationError) return validationError

    const { orderType, items, paymentMethod, customer, promoCode, locationId } = data

    // FIX: Do NOT check minimum order amount here — itemsSubtotal is 0 before calculation!
    // The check will be done AFTER server-side price calculation (line 103-106 below)
    let itemsSubtotal = 0

    // Pridobi menu iteme iz DB (strežniška cena, NE klientova!)
    const menuItemIds = [...new Set(items.map(i => i.menuItemId))]
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuItemIds }, isAvailable: true },
      include: { recipeItems: { include: { inventoryItem: true } } },
    })
    const menuItemMap = new Map(menuItems.map(mi => [mi.id, mi]))

    // FIX BUG-06: Subtotal iz strežniških cen, NE klientovih
    itemsSubtotal = items.reduce((sum, i) => {
      const mi = menuItemMap.get(i.menuItemId)
      return sum + (mi ? toNum(mi.price) * i.quantity : 0)
    }, 0)

    // Ponovno preveri minimum za dostavo s strežniškimi cenami
    if (orderType === 'delivery' && itemsSubtotal < MIN_ORDER_AMOUNT) {
      return NextResponse.json({ error: `Minimalno naročilo za dostavo je €${MIN_ORDER_AMOUNT.toFixed(2)}` }, { status: 400 })
    }

    if (menuItems.length !== menuItemIds.length) {
      const foundIds = new Set(menuItems.map(m => m.id))
      const missing = menuItemIds.filter(id => !foundIds.has(id))
      return NextResponse.json({ error: 'Nekateri artikli niso na voljo', unavailableItems: missing }, { status: 400 })
    }

    // FIX Q02 CRITICAL: deliveryFee se izračuna strežniško iz cone dostave — NE iz klienta
    // Prejšnja koda je uporabila deliveryFee iz klienta, kar je omogočalo price tampering
    let actualDeliveryFee = 0
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
        return NextResponse.json({
          error: 'Na ta naslov ne dostavljamo. Izberite prevzem na lokaciji.',
          deliverable: false,
        }, { status: 400 })
      }

      if (matchingZone && itemsSubtotal < toNum(matchingZone.minOrderAmount)) {
        return NextResponse.json({
          error: `Minimalno naročilo za cono "${matchingZone.name}" je €${toNum(matchingZone.minOrderAmount).toFixed(2)}`,
        }, { status: 400 })
      }

      // Izračunaj dostavno iz cone — strežniško, NE klientno
      // FIX D-13 LOW: Uporabi freeDeliveryAbove iz cone — brezplačna dostava nad pragom
      if (matchingZone && isPositive(matchingZone.freeDeliveryAbove) && itemsSubtotal >= toNum(matchingZone.freeDeliveryAbove)) {
        actualDeliveryFee = 0 // Brezplačna dostava nad pragom
      } else {
        // FIX CRITICAL: Prejšnja koda je uporabila `||` kar obrne 0 kot falsy
        // Ko cona dostave ima deliveryFee=0 (brezplačna dostava), se zamenja s privzeto 2.50€
        actualDeliveryFee = matchingZone ? toNum(matchingZone.deliveryFee) : DELIVERY_FEE
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
    // FIX Q04 MEDIUM: Če counter ne deluje, VRNI NAPAKO namesto neatomskega fallbacka
    let nextOrderNumber: number
    try {
      const counter = await db.counter.upsert({
        where: { name: 'orderNumber' },
        update: { value: { increment: 1 } },
        create: { name: 'orderNumber', value: 1 },
      })
      nextOrderNumber = counter.value
    } catch (counterErr: unknown) {
      logger.error('API', '[ONLINE-ORDER] Counter upsert failed — ZAVRNI naročilo (neatomska operacija):', counterErr)
      return NextResponse.json({ error: 'Napaka pri generiranju številke naročila. Poskusite znova.' }, { status: 503 })
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
    } catch (checkCounterErr: unknown) {
      // FIX LOW: Prejšnji fallback na 1 je lahko ustvaril podvojene checkNumberje
      // kar krši @@unique([orderId, checkNumber]) omejitev. Zavrni namesto tega.
      logger.error('API', '[ONLINE-ORDER] Check number counter failed — ZAVRNI:', checkCounterErr)
      return NextResponse.json({ error: 'Napaka pri generiranju številke čeka. Poskusite znova.' }, { status: 503 })
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
      // FIX HIGH: Dodaj ceno modifikatorjev k subtotal — prejšnja koda je ignorirala modifikatorje
      // Online naročila z modifikatorji (npr. dodaten sir €2) so zaračunala manj kot prikazano
      let modifierTotal = 0
      const parsedModifiers: Array<{ name?: string; price?: number; id?: string }> = (() => {
        try { return JSON.parse(item.modifiersJson || '[]') } catch { return [] }
      })()
      // FIX CRITICAL: Fetch modifier prices from DB — do NOT trust client prices (price tampering)
      const modifierIds = parsedModifiers.filter(m => m.id).map(m => m.id as string)
      const dbModifiers = modifierIds.length > 0
        ? await db.modifier.findMany({ where: { id: { in: modifierIds } } })
        : []
      const modifierPriceMap = new Map(dbModifiers.map(m => [m.id, m.price]))
      for (const mod of parsedModifiers) {
        const dbPrice = mod.id ? modifierPriceMap.get(mod.id as string) : null
        if (dbPrice !== undefined && dbPrice !== null) {
          modifierTotal += toNum(dbPrice) * qty // Use DB price (trusted)
        } else {
          // FIX CRITICAL: REJECT modifiers without DB price match — ne zaupaj klientu!
          logger.warn('API', `[ONLINE ORDER] Modifier "${mod.name}" rejected — no DB price match (possible price tampering)`)
        }
      }
      const itemBase = toNum(menuItem.price) * qty + modifierTotal
      const itemVat = calcVat(itemBase, menuItem.vatRate)
      subtotal += itemBase
      totalVat += itemVat

      orderItemsData.push({
        menuItemId: menuItem.id,
        quantity: qty,
        price: toNum(menuItem.price),
        vatRate: toNum(menuItem.vatRate),
        vatAmount: itemVat,
        notes: item.notes,
        modifiersJson: item.modifiersJson,
      })
    }

    const actualDeliveryFee_final = orderType === 'delivery' ? actualDeliveryFee : 0
    // FIX TOCTOU: Discount validation and total calculation moved INSIDE the transaction
    // to prevent race condition where discount expires between validation and order creation

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

    // orderNotes will be constructed inside the transaction after discount validation

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

      // FIX TOCTOU: Validate discount INSIDE the transaction — prevents race condition
      // where discount expires between validation and order creation.
      // Atomically claim discount usage slot before calculating the discount amount.
      // FIX MEDIUM: Išči po promoCode namesto po internem discountId — prepreči ID enumeration
      let discount = 0
      if (promoCode) {
        const discountObj = await tx.discount.findFirst({
          where: {
            promoCode: promoCode.trim().toUpperCase(),
            isActive: true,
            triggerType: 'promo_code',
          },
        })
        if (discountObj) {
          const now = new Date()
          const isWithinValidity = (!discountObj.validFrom || now >= discountObj.validFrom) &&
                                    (!discountObj.validTo || now <= discountObj.validTo)
          if (isWithinValidity) {
            // Atomically increment usage ONLY if under maxUses — prevents over-redemption
            const claimed = await tx.discount.updateMany({
              where: { id: discountObj.id, currentUses: { lt: discountObj.maxUses ?? Infinity } },
              data: { currentUses: { increment: 1 } },
            })
            if (claimed.count > 0) {
              // Successfully claimed a usage slot — discount is valid
              if (discountObj.type === 'percentage') {
                discount = calcDiscount(subtotal, discountObj.amount, 'percentage')
              } else if (discountObj.type === 'fixed_amount') {
                discount = toNum(discountObj.amount)
              }
              discount = Math.min(discount, subtotal)
            }
            // If claimed.count === 0, discount was exhausted by concurrent requests — discount stays 0
          }
        }
      }

      // FIX: Delivery fee is subject to VAT in Slovenia/EU (DDV obveznost za dostavo)
      const deliveryFeeVat = actualDeliveryFee_final * (DELIVERY_FEE_VAT_RATE / 100)
      const totalTax = totalVat + deliveryFeeVat
      const total = Math.max(0, subtotal + totalTax + actualDeliveryFee_final - discount)

      // Build orderNotes with transactionally-validated discount
      const orderNotes = [
        orderType === 'delivery' ? `ONLINE DOSTAVA → ${deliveryAddress}` : 'ONLINE PREVZEM',
        customerNotes ? `Opombe: ${customerNotes}` : '',
        paymentMethod === 'cash' ? 'PLAČILO: Gotovina ob prevzemu' : `PLAČILO: ${paymentMethod === 'card' ? 'Kartica' : 'Mobilno'}`,
        'preferredTime' in customer && customer.preferredTime ? `Želen čas: ${customer.preferredTime}` : '',
        promoCode ? `PROMO: ${promoCode} (-€${discount.toFixed(2)})` : '',
      ].filter(Boolean).join(' | ')

      const newOrder = await tx.order.create({
        data: {
          orderNumber: nextOrderNumber,
          type: orderType,
          status: 'pending',
          subtotal,
          tax: totalTax,
          discount,
          total,
          totalWithTip: total,
          customerName,
          customerPhone,
          customerEmail,
          notes: orderNotes,
          paymentMethod: paymentMethod === 'cash' ? 'gotovina' : paymentMethod === 'card' ? 'kartica' : 'mobilno',
          // FIX QR-11 HIGH: NE označi kot 'paid' brez dejanskega plačilnega prehoda
          // Kartica/mobilno plačilo zahteva payment gateway integracijo — brez nje je status 'pending'
          paymentStatus: 'unpaid', // Vse online naročila so unpaid, dokler plačilo ni potrjeno
          paidAt: null,
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
          tax: totalTax,
          discount,
          serviceCharge: actualDeliveryFee_final,
          total: subtotal + totalTax + actualDeliveryFee_final - discount,
          tip: 0,
          totalWithTip: subtotal + totalTax + actualDeliveryFee_final - discount,
          // FIX CRITICAL: Prejšnja koda je označila Check kot 'paid' za kartico/mobilno
          // BREZ da bi bil plačilni prehod dejansko potrdil. To ustvarja lažno plačan status.
          // Brez dejanskega payment gateway potrjevanja je status 'unpaid' za VSE metode
          paymentStatus: 'unpaid',
          paymentMethod: paymentMethod === 'cash' ? 'cash' : paymentMethod === 'card' ? 'card' : 'mobile',
          orderItems: { connect: newOrder.orderItems.map(oi => ({ id: oi.id })) },
        },
      })

      // FIX QR-11: Ustvari Payment zapis z 'pending' statusom — NE 'completed' brez payment gateway
      if (paymentMethod !== 'cash') {
        await tx.payment.create({
          data: {
            checkId: check.id,
            amount: total,
            tipAmount: 0,
            type: paymentMethod === 'card' ? 'card' : 'mobile',
            status: 'pending', // Čaka na payment gateway potrditev
          },
        })

        // FIX QR-11: Ček ostane 'unpaid' dokler payment gateway ne potrdi
        // (za gotovino bo natakar potrdil plačilo ob prevzemu)
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
          const deductQty = toNum(recipe.quantityPerServing) * item.quantity
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
                previousQty: toNum(currentInvItem.quantity),
                newQty: toNum(currentInvItem.quantity) - deductQty,
                costPerUnit: toNum(currentInvItem.costPerUnit),
                totalCost: deductQty * toNum(currentInvItem.costPerUnit),
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

      // Discount usage was already atomically claimed before order creation above — no need to re-validate

      return newOrder
    })

    // Sproži webhook za novo online naročilo (ne blokiraj odziva)
    triggerWebhookAsync('order.created', {
      orderId: order.id,
      orderNumber: String(order.orderNumber),
      type: orderType,
      total: toNum(order.total),
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
        total: toNum(order.total),
        orderType,
        estimatedTime: orderType === 'delivery' ? '30-45 min' : '15-25 min',
        deliveryAddress,
        paymentMethod,
      },
    }, { status: 201 })

  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/public/online-order', [
      { match: 'INSUFFICIENT_STOCK', message: 'Artikel ni na zalogi', status: 409, extra: (parts) => ({ error: `Na žalost ${parts[1] || 'Artikel'} ni več na zalogi (${parts[2] || ''}). Prosimo, izberite drug artikel.` }) },
    ], 'Napaka pri oddaji naročila. Prosimo, poskusite znova.')
  }
}

// Async webhook trigger — ne blokiraj odziva
async function triggerWebhookAsync(event: string, payload: Record<string, unknown>) {
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
  } catch (e: unknown) {
    logger.error('API', 'Webhook trigger error:', e)
  }
}
