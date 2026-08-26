// Recalculation helpers for order/check totals

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'

// Preračunaj zneske naročila po voidu
export async function recalculateOrderTotals(orderItemId: string, orderId: string) {
  const allItems = await db.orderItem.findMany({
    where: { orderId },
  })

  let newSubtotal = 0
  let newTax = 0
  for (const item of allItems) {
    if (!item.voided) {
      const itemBase = toNum(item.price) * item.quantity
      const itemVat = toNum(item.vatAmount) > 0 ? toNum(item.vatAmount) : (itemBase * toNum(item.vatRate) / 100)
      newSubtotal += itemBase
      newTax += itemVat
    }
  }

  const order = await db.order.findUnique({ where: { id: orderId } })
  const discount = toNum(order?.discount)
  const cappedDiscount = Math.min(discount, newSubtotal)
  const newTotal = newSubtotal + newTax - cappedDiscount

  await db.order.update({
    where: { id: orderId },
    data: {
      subtotal: Math.round(newSubtotal * 100) / 100,
      tax: Math.round(newTax * 100) / 100,
      discount: cappedDiscount,
      total: Math.max(0, Math.round(newTotal * 100) / 100),
      totalWithTip: Math.max(0, Math.round(newTotal * 100) / 100) + toNum(order?.tip),
    },
  })
}

// Preračunaj totale čeka po voidu
export async function recalculateCheckTotals(checkId: string) {
  const linkedCheck = await db.check.findUnique({
    where: { id: checkId },
    include: { orderItems: true },
  })
  if (!linkedCheck) return

  let checkSubtotal = 0
  let checkTax = 0
  for (const oi of linkedCheck.orderItems) {
    if (oi.voided) continue
    const itemBase = toNum(oi.price) * oi.quantity
    const itemVat = toNum(oi.vatAmount) > 0 ? toNum(oi.vatAmount) : (itemBase * (toNum(oi.vatRate) / 100))
    checkSubtotal += itemBase
    checkTax += itemVat
  }
  const checkDiscount = toNum(linkedCheck.discount)
  const checkTotal = round2(checkSubtotal + checkTax + toNum(linkedCheck.serviceCharge) - checkDiscount)
  const checkTotalWithTip = round2(checkTotal + toNum(linkedCheck.tip))

  await db.check.update({
    where: { id: linkedCheck.id },
    data: {
      subtotal: round2(checkSubtotal),
      tax: round2(checkTax),
      total: checkTotal,
      totalWithTip: checkTotalWithTip,
    },
  })
}
