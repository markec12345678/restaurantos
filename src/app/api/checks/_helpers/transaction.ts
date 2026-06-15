// Transakcijske pomožne funkcije za Checks API

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { calculateCheckAmounts } from './calculate'

// ─── Tipi za transakcijo ─────────────────────────────────────

export interface OrderItemBrief {
  id: string
  checkId: string | null
}

// ─── Preračun izvornih čekov po prenosa artiklov ─────────────

export async function recalculateAffectedChecks(
  orderId: string,
  newCheckId: string,
  reassignedItemIds: string[]
): Promise<void> {
  if (reassignedItemIds.length === 0) return

  const affectedChecks = await db.check.findMany({
    where: {
      orderId,
      id: { not: newCheckId },
    },
    include: { orderItems: true },
  })

  for (const affectedCheck of affectedChecks) {
    if (affectedCheck.orderItems.length === 0) continue
    const { subtotal: newSubtotal, tax: newTax } = calculateCheckAmounts(
      affectedCheck.orderItems.filter(oi => !oi.voided).map(oi => ({
        id: oi.id,
        checkId: oi.checkId,
        check: null,
        voided: oi.voided,
        price: oi.price,
        quantity: oi.quantity,
        vatAmount: oi.vatAmount,
        vatRate: oi.vatRate,
      }))
    )
    const newDiscount = toNum(affectedCheck.discount)
    const newTotal = round2(newSubtotal + newTax + toNum(affectedCheck.serviceCharge) - newDiscount)
    const newTotalWithTip = round2(newTotal + toNum(affectedCheck.tip))

    await db.check.update({
      where: { id: affectedCheck.id },
      data: {
        subtotal: round2(newSubtotal),
        tax: round2(newTax),
        total: newTotal,
        totalWithTip: newTotalWithTip,
      },
    })
  }
}

// ─── Transakcijske pomožne funkcije ──────────────────────────

export async function applyDiscountAtomic(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  discountId: string | null
): Promise<void> {
  if (!discountId) return
  const discountObj = await tx.discount.findUnique({ where: { id: discountId } })
  if (!discountObj) return

  if (discountObj.maxUses !== null) {
    const updated = await tx.discount.updateMany({
      where: { id: discountObj.id, currentUses: { lt: discountObj.maxUses } },
      data: { currentUses: { increment: 1 } },
    })
    if (updated.count === 0) {
      throw new Error('Popust je že bil uporabljen največkrat')
    }
  } else {
    await tx.discount.update({
      where: { id: discountObj.id },
      data: { currentUses: { increment: 1 } },
    })
  }
}

export async function linkOrderItemsToCheck(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  checkId: string,
  orderItemIds: string[],
  allOrderItems: OrderItemBrief[]
): Promise<void> {
  if (orderItemIds.length > 0) {
    await tx.orderItem.updateMany({
      where: { id: { in: orderItemIds } },
      data: { checkId },
    })
  } else {
    // Poveži vse nepovezane OrderItem-e tega naročila
    const unassignedItems = allOrderItems.filter(oi => !oi.checkId)
    if (unassignedItems.length > 0) {
      await tx.orderItem.updateMany({
        where: { id: { in: unassignedItems.map(oi => oi.id) } },
        data: { checkId },
      })
    }
  }
}
