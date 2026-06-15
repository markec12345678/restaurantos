// Pomožne funkcije za online naročila — Ustvarjanje naročila v transakciji

import { db } from '@/lib/db'
import { DELIVERY_FEE_VAT_RATE } from './schemas'
import { createDeliveryInfo } from './create-delivery-info'
import { validateDiscount } from './validate-discount'
import { deductInventory } from './deduct-inventory'
import { upsertGuest } from './upsert-guest'
import type { CreateOnlineOrderInput } from './create-order-types'
export type { CreateOnlineOrderInput } from './create-order-types'
import { extractCustomerData, buildOrderNotes } from './create-order-utils'

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
  const { customerName, customerPhone, customerEmail, customerNotes, deliveryAddress } = extractCustomerData(customer, orderType)
  const actualDeliveryFee_final = orderType === 'delivery' ? actualDeliveryFee : 0

  // Ustvari naročilo + zaloga + ček + dostava v transakciji
  const order = await db.$transaction(async (tx) => {
    const deliveryInfoId = await createDeliveryInfo(tx, customer, actualDeliveryFee)

    // FIX TOCTOU: Validate discount INSIDE the transaction
    const discount = await validateDiscount(tx, promoCode, subtotal)

    // FIX: Delivery fee is subject to VAT in Slovenia/EU
    const deliveryFeeVat = actualDeliveryFee_final * (DELIVERY_FEE_VAT_RATE / 100)
    const totalTax = totalVat + deliveryFeeVat
    const total = Math.max(0, subtotal + totalTax + actualDeliveryFee_final - discount)

    const orderNotes = buildOrderNotes({
      orderType, deliveryAddress, customerNotes, paymentMethod, customer, promoCode, discount,
    })

    const newOrder = await tx.order.create({
      data: {
        orderNumber: nextOrderNumber, type: orderType, status: 'pending',
        subtotal, tax: totalTax, discount, total, totalWithTip: total,
        customerName, customerPhone, customerEmail, notes: orderNotes,
        paymentMethod: paymentMethod === 'cash' ? 'gotovina' : paymentMethod === 'card' ? 'kartica' : 'mobilno',
        paymentStatus: 'unpaid', paidAt: null,
        diningOptionId: diningOption!.id, deliveryInfoId,
        inventoryDeducted: false, locationId: locationId || null,
        orderItems: { create: orderItemsData },
      },
      include: { orderItems: true },
    })

    const check = await tx.check.create({
      data: {
        checkNumber: nextCheckNumber, orderId: newOrder.id,
        subtotal, tax: totalTax, discount,
        serviceCharge: actualDeliveryFee_final,
        total: subtotal + totalTax + actualDeliveryFee_final - discount,
        tip: 0, totalWithTip: subtotal + totalTax + actualDeliveryFee_final - discount,
        paymentStatus: 'unpaid',
        paymentMethod: paymentMethod === 'cash' ? 'cash' : paymentMethod === 'card' ? 'card' : 'mobile',
        orderItems: { connect: newOrder.orderItems.map(oi => ({ id: oi.id })) },
      },
    })

    if (paymentMethod !== 'cash') {
      await tx.payment.create({
        data: {
          checkId: check.id, amount: total, tipAmount: 0,
          type: paymentMethod === 'card' ? 'card' : 'mobile',
          status: 'pending',
        },
      })
    }

    await tx.orderItem.updateMany({ where: { orderId: newOrder.id }, data: { checkId: check.id } })
    await deductInventory(tx, items, menuItemMap, nextOrderNumber, newOrder.id)
    await tx.order.update({ where: { id: newOrder.id }, data: { inventoryDeducted: true } })
    await upsertGuest(tx, customerName, customerPhone, customerEmail, total)

    return newOrder
  })

  return { order, customerName, customerPhone, deliveryAddress }
}
