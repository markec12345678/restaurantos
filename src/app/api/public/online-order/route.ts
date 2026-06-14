
// =====================================================================
// ONLINE ORDER API - Spletna naročila z dostavo ali prevzemom
// Podpora za: delivery, takeout z online plačilom
// Ekvivalent Toast Online Ordering za slovenski trg
// FIX CRITICAL: Skupni rate limiter modul
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { toNum, calcDiscount } from '@/lib/decimal'
import { checkRateLimit, getClientIp, ONLINE_ORDER_LIMIT } from '@/lib/rate-limit'
import { handleRouteError, validateRequest } from '@/lib/api-utils'
import {
  onlineOrderSchema, DELIVERY_FEE_VAT_RATE, MIN_ORDER_AMOUNT,
  checkRestaurantOpen, calculateDeliveryFee, calculateOrderItems,
  triggerWebhookAsync,
} from './_helpers'
import type { OrderItemCalc } from './_helpers'

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
    // FIX MEDIUM: Fail-CLOSED — če nastavitv ni mogoče prebrati, ZAPRI naročila
    const openError = await checkRestaurantOpen()
    if (openError) return openError

    const { data, error: validationError } = await validateRequest(req, onlineOrderSchema)
    if (validationError) return validationError

    const { orderType, items, paymentMethod, customer, promoCode, locationId } = data

    // Pridobi menu iteme iz DB (strežniška cena, NE klientova!)
    const menuItemIds = [...new Set(items.map((i: { menuItemId: string }) => i.menuItemId))]
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuItemIds }, isAvailable: true },
      include: { recipeItems: { include: { inventoryItem: true } } },
    })
    const menuItemMap = new Map(menuItems.map(mi => [mi.id, mi]))

    // FIX BUG-06: Subtotal iz strežniških cen, NE klientovih
    const itemsSubtotal = items.reduce((sum: number, i: { menuItemId: string; quantity: number }) => {
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

    // FIX Q02 CRITICAL: deliveryFee se izračuna strežniško iz cone dostave
    let actualDeliveryFee = 0
    if (orderType === 'delivery' && 'postCode' in customer) {
      const feeResult = await calculateDeliveryFee(customer, itemsSubtotal)
      if (feeResult.error) return feeResult.error
      actualDeliveryFee = feeResult.fee
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
        where: { name: 'orderNumber' }, update: { value: { increment: 1 } }, create: { name: 'orderNumber', value: 1 },
      })
      nextOrderNumber = counter.value
    } catch (_counterErr: unknown) {
      return NextResponse.json({ error: 'Napaka pri generiranju številke naročila. Poskusite znova.' }, { status: 503 })
    }

    // Generiraj številko čeka
    let nextCheckNumber: number
    try {
      const counter = await db.counter.upsert({
        where: { name: 'checkNumber' }, update: { value: { increment: 1 } }, create: { name: 'checkNumber', value: 1 },
      })
      nextCheckNumber = counter.value
    } catch {
      return NextResponse.json({ error: 'Napaka pri generiranju številke čeka. Poskusite znova.' }, { status: 503 })
    }

    // Izračunaj zneske iz strežniških podatkov
    const { orderItemsData, subtotal, totalVat } = await calculateOrderItems(items, menuItemMap)

    const actualDeliveryFee_final = orderType === 'delivery' ? actualDeliveryFee : 0

    // Poišči ali ustvari dining option
    let diningOption = await db.diningOption.findFirst({ where: { type: orderType } })
    if (!diningOption) {
      diningOption = await db.diningOption.create({
        data: {
          name: orderType === 'delivery' ? 'Dostava' : 'Za s seboj',
          type: orderType, isActive: true,
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
    const deliveryAddress = orderType === 'delivery' && 'address' in customer
      ? `${customer.address}, ${customer.postCode} ${customer.city}` : ''

    // Ustvari naročilo + zaloga + ček + dostava v transakciji
    const order = await db.$transaction(async (tx) => {
      // Ustvari DeliveryInfo za dostavo
      let deliveryInfoId: string | undefined
      if (orderType === 'delivery' && 'address' in customer) {
        const deliveryInfo = await tx.deliveryInfo.create({
          data: {
            address: customer.address, city: customer.city, postCode: customer.postCode,
            recipientName: customer.fullName, recipientPhone: customer.phone,
            deliveryInstructions: customer.notes || '', status: 'pending',
            deliveryFee: actualDeliveryFee,
            estimatedTime: new Date(Date.now() + 30 * 60 * 1000), // 30 min od zdaj
          },
        })
        deliveryInfoId = deliveryInfo.id
      }

      // FIX TOCTOU: Validate discount INSIDE the transaction — prevents race condition
      let discount = 0
      if (promoCode) {
        const discountObj = await tx.discount.findFirst({
          where: { promoCode: promoCode.trim().toUpperCase(), isActive: true, triggerType: 'promo_code' },
        })
        if (discountObj) {
          const now = new Date()
          const isWithinValidity = (!discountObj.validFrom || now >= discountObj.validFrom) &&
                                    (!discountObj.validTo || now <= discountObj.validTo)
          if (isWithinValidity) {
            const claimed = await tx.discount.updateMany({
              where: { id: discountObj.id, currentUses: { lt: discountObj.maxUses ?? Infinity } },
              data: { currentUses: { increment: 1 } },
            })
            if (claimed.count > 0) {
              if (discountObj.type === 'percentage') discount = calcDiscount(subtotal, discountObj.amount, 'percentage')
              else if (discountObj.type === 'fixed_amount') discount = toNum(discountObj.amount)
              discount = Math.min(discount, subtotal)
            }
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
          orderNumber: nextOrderNumber, type: orderType, status: 'pending',
          subtotal, tax: totalTax, discount, total, totalWithTip: total,
          customerName, customerPhone, customerEmail, notes: orderNotes,
          paymentMethod: paymentMethod === 'cash' ? 'gotovina' : paymentMethod === 'card' ? 'kartica' : 'mobilno',
          // FIX QR-11 HIGH: NE označi kot 'paid' brez dejanskega plačilnega prehoda
          paymentStatus: 'unpaid', paidAt: null,
          diningOptionId: diningOption!.id, deliveryInfoId,
          inventoryDeducted: false, locationId: locationId || null,
          orderItems: { create: orderItemsData as OrderItemCalc[] },
        },
        include: { orderItems: true },
      })

      // Ustvari Check za plačilo
      const check = await tx.check.create({
        data: {
          checkNumber: nextCheckNumber, orderId: newOrder.id,
          subtotal, tax: totalTax, discount,
          serviceCharge: actualDeliveryFee_final,
          total: subtotal + totalTax + actualDeliveryFee_final - discount,
          tip: 0, totalWithTip: subtotal + totalTax + actualDeliveryFee_final - discount,
          // FIX CRITICAL: Brez payment gateway je status 'unpaid'
          paymentStatus: 'unpaid',
          paymentMethod: paymentMethod === 'cash' ? 'cash' : paymentMethod === 'card' ? 'card' : 'mobile',
          orderItems: { connect: newOrder.orderItems.map(oi => ({ id: oi.id })) },
        },
      })

      // FIX QR-11: Ustvari Payment zapis z 'pending' statusom
      if (paymentMethod !== 'cash') {
        await tx.payment.create({
          data: {
            checkId: check.id, amount: total, tipAmount: 0,
            type: paymentMethod === 'card' ? 'card' : 'mobile',
            status: 'pending', // Čaka na payment gateway potrditev
          },
        })
      }

      // Poveži order items s checkom
      await tx.orderItem.updateMany({ where: { orderId: newOrder.id }, data: { checkId: check.id } })

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
                inventoryItemId: recipe.inventoryItem.id, type: 'sale', quantity: -deductQty,
                previousQty: toNum(currentInvItem.quantity), newQty: toNum(currentInvItem.quantity) - deductQty,
                costPerUnit: toNum(currentInvItem.costPerUnit), totalCost: deductQty * toNum(currentInvItem.costPerUnit),
                reason: `Online naročilo #${nextOrderNumber}`, orderId: newOrder.id,
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
              phone: customerPhone, totalVisits: { increment: 1 },
              totalSpent: { increment: total }, lastVisitAt: new Date(),
            },
          })
        } else {
          await tx.guest.create({
            data: {
              firstName: customerName.split(' ')[0] || customerName,
              lastName: customerName.split(' ').slice(1).join(' ') || '-',
              email: customerEmail, phone: customerPhone,
              totalVisits: 1, totalSpent: total,
              lastVisitAt: new Date(), firstVisitAt: new Date(),
            },
          })
        }
      }

      return newOrder
    })

    // Sproži webhook za novo online naročilo (ne blokiraj odziva)
    triggerWebhookAsync('order.created', {
      orderId: order.id, orderNumber: String(order.orderNumber),
      type: orderType, total: toNum(order.total),
      customerName, customerPhone, paymentMethod, source: 'online',
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      order: {
        id: order.id, orderNumber: String(order.orderNumber), status: order.status,
        total: toNum(order.total), orderType,
        estimatedTime: orderType === 'delivery' ? '30-45 min' : '15-25 min',
        deliveryAddress, paymentMethod,
      },
    }, { status: 201 })

  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/public/online-order', [
      { match: 'INSUFFICIENT_STOCK', message: 'Artikel ni na zalogi', status: 409, extra: (parts) => ({ error: `Na žalost ${parts[1] || 'Artikel'} ni več na zalogi (${parts[2] || ''}). Prosimo, izberite drug artikel.` }) },
    ], 'Napaka pri oddaji naročila. Prosimo, poskusite znova.')
  }
}
