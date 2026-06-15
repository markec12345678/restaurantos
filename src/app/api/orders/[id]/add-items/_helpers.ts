// Helpers for POST /api/orders/[id]/add-items

import { db } from '@/lib/db'
import { toNum, round2, isPositive } from '@/lib/decimal'

/** Create order items inside a transaction, recalculating order totals */
export async function createOrderItemsAndRecalculate(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  orderId: string,
  orderItems: { menuItemId: string; quantity: number; notes?: string; modifiersJson?: string }[],
) {
  // Re-read order inside transaction for consistent state
  const currentOrder = await tx.order.findUnique({
    where: { id: orderId },
    include: { orderItems: { include: { menuItem: true } }, table: true },
  })

  if (!currentOrder) {
    throw new Error('Naročilo ni najdeno')
  }

  if (currentOrder.status === 'completed' || currentOrder.status === 'cancelled') {
    throw new Error('Naročilo je že zaključeno ali preklicano')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma OrderItem & { menuItem } from include
  const created: any[] = []

  // Preveri, da vsi artikli obstajajo
  for (const item of orderItems) {
    const menuItem = await tx.menuItem.findUnique({ where: { id: item.menuItemId } })
    if (!menuItem) {
      throw new Error(`Artikel ${item.menuItemId} ni najden`)
    }
  }

  for (const item of orderItems) {
    // Pridobi artikel za DDV stopnjo in CENO (strežniško — edini vir resnice)
    // FIX BUG 6: Uporabimo menuItem.price iz baze, NE client-sent item.price
    const menuItem = (await tx.menuItem.findUnique({ where: { id: item.menuItemId } }))!
    const vatRate = toNum(menuItem.vatRate)
    const serverPrice = toNum(menuItem.price)
    const itemBase = serverPrice * item.quantity
    const vatAmount = round2(itemBase * (vatRate / 100))

    const orderItem = await tx.orderItem.create({
      data: {
        orderId,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: serverPrice,
        notes: item.notes,
        modifiersJson: item.modifiersJson,
        status: 'pending',
        vatRate,
        vatAmount,
        // FIX BUG: Podeduj discountAmount proporcionalno od starševskega naročila
        discountAmount: isPositive(currentOrder.discount) && isPositive(currentOrder.subtotal)
          ? round2(serverPrice * item.quantity / toNum(currentOrder.subtotal) * toNum(currentOrder.discount))
          : 0,
      },
      include: { menuItem: true },
    })
    created.push(orderItem)
  }

  // Use currentOrder (from within transaction) instead of stale order
  const allItems = [...currentOrder.orderItems, ...created]
  const subtotal = allItems.reduce((sum, oi) => sum + toNum(oi.price) * oi.quantity, 0)
  // FIX HIGH: Use existing vatAmount for old items instead of recalculating
  const tax = allItems.reduce((sum, oi) => {
    if ('vatAmount' in oi && toNum(oi.vatAmount) > 0) {
      return sum + toNum(oi.vatAmount)
    }
    const rate = oi.vatRate != null ? toNum(oi.vatRate) : 22.0
    return sum + toNum(oi.price) * oi.quantity * (rate / 100)
  }, 0)
  // FIX HIGH: Recalculate discount across ALL items (old + new) proportionally
  const discount = Math.min(toNum(currentOrder.discount), subtotal)
  const total = round2(subtotal + tax - discount)
  const totalWithTip = round2(total + toNum(currentOrder.tip))

  await tx.order.update({
    where: { id: orderId },
    data: { subtotal, tax, discount, total, totalWithTip },
  })

  return created
}
