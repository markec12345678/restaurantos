// Pomožne funkcije za online naročila — Ustvarjanje naročila v transakciji

import { db } from '@/lib/db'
import { toNum, calcDiscount, type DecimalLike } from '@/lib/decimal'
import { DELIVERY_FEE_VAT_RATE } from './schemas'
import type { OrderItemCalc } from './order-calc'

// ─── Tipi za transakcijo ───

export interface CreateOnlineOrderInput {
  orderType: string
  items: Array<{ menuItemId: string; quantity: number; notes: string; modifiersJson: string }>
  paymentMethod: string
  customer: Record<string, unknown>
  promoCode?: string
  locationId?: string
  menuItemMap: Map<string, {
    id: string; price: DecimalLike; vatRate: DecimalLike
    recipeItems: Array<{
      quantityPerServing: DecimalLike
      inventoryItem: { id: string; quantity: DecimalLike; costPerUnit: DecimalLike } | null
    }>
  }>
  orderItemsData: OrderItemCalc[]
  subtotal: number
  totalVat: number
  actualDeliveryFee: number
  nextOrderNumber: number
  nextCheckNumber: number
}

// ─── Ustvari online naročilo znotraj transakcije ───

export async function createOnlineOrder(input: CreateOnlineOrderInput) {
  const {
    orderType, items, paymentMethod, customer, promoCode, locationId,
    menuItemMap, orderItemsData, subtotal, totalVat,
    actualDeliveryFee, nextOrderNumber, nextCheckNumber,
  } = input

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
  const customerName = customer.fullName as string
  const customerPhone = customer.phone as string
  const customerEmail = 'email' in customer ? (customer.email as string) : ''
  const customerNotes = (customer.notes as string) || ''
  const deliveryAddress = orderType === 'delivery' && 'address' in customer
    ? `${customer.address}, ${customer.postCode} ${customer.city}` : ''

  const actualDeliveryFee_final = orderType === 'delivery' ? actualDeliveryFee : 0

  // Ustvari naročilo + zaloga + ček + dostava v transakciji
  const order = await db.$transaction(async (tx) => {
    // Ustvari DeliveryInfo za dostavo
    let deliveryInfoId: string | undefined
    if (orderType === 'delivery' && 'address' in customer) {
      const deliveryInfo = await tx.deliveryInfo.create({
        data: {
          address: customer.address as string, city: customer.city as string, postCode: customer.postCode as string,
          recipientName: customer.fullName as string, recipientPhone: customer.phone as string,
          deliveryInstructions: (customer.notes as string) || '', status: 'pending',
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

  return { order, customerName, customerPhone, deliveryAddress }
}
