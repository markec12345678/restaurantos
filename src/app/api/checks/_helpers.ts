// Pomožne funkcije za Checks API
// Izračuni zneskov, validacija popustov, preračun izvornih čekov, transakcije

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'

// ─── Tipi za transakcijo ─────────────────────────────────────

export interface OrderItemBrief {
  id: string
  checkId: string | null
}

// ─── Tipi ────────────────────────────────────────────────────

export interface CheckOrderItem {
  id: string
  checkId: string | null
  check?: { id: string; paymentStatus: string } | null
  voided: boolean
  price: Parameters<typeof toNum>[0]
  quantity: number
  vatAmount: Parameters<typeof toNum>[0]
  vatRate: Parameters<typeof toNum>[0]
}

// ─── Izračun zneskov za ček ──────────────────────────────────

export function calculateCheckAmounts(checkOrderItems: CheckOrderItem[]): {
  subtotal: number
  tax: number
} {
  let subtotal = 0
  let tax = 0
  for (const oi of checkOrderItems) {
    const itemBase = toNum(oi.price) * oi.quantity
    const itemVat = toNum(oi.vatAmount) > 0
      ? toNum(oi.vatAmount)
      : (toNum(oi.price) * oi.quantity * toNum(oi.vatRate) / 100)
    subtotal += itemBase
    tax += itemVat
  }
  return { subtotal, tax }
}

// ─── Validacija in izračun popusta ───────────────────────────

export interface DiscountValidation {
  discount: number
  discountId: string | null
  error: string | null
}

export async function validateAndCalculateDiscount(
  appliedDiscountId: string | null | undefined,
  subtotal: number
): Promise<DiscountValidation> {
  if (!appliedDiscountId) {
    return { discount: 0, discountId: null, error: null }
  }

  const discountObj = await db.discount.findUnique({ where: { id: appliedDiscountId } })
  if (!discountObj) {
    return { discount: 0, discountId: null, error: null }
  }

  // FIX MEDIUM: Preveri, da je popust aktiven in v veljavnem obdobju
  if (!discountObj.isActive) {
    return { discount: 0, discountId: null, error: 'Popust ni aktiven' }
  }
  const now = new Date()
  if (discountObj.validFrom && now < discountObj.validFrom) {
    return { discount: 0, discountId: null, error: 'Popust še ni veljaven' }
  }
  if (discountObj.validTo && now > discountObj.validTo) {
    return { discount: 0, discountId: null, error: 'Popust je potekel' }
  }
  if (discountObj.maxUses !== null && discountObj.currentUses >= discountObj.maxUses) {
    return { discount: 0, discountId: null, error: 'Popust je že bil uporabljen največkrat' }
  }

  let discount = 0
  if (discountObj.type === 'percentage') {
    discount = subtotal * (toNum(discountObj.amount) / 100)
  } else if (discountObj.type === 'fixed_amount') {
    discount = toNum(discountObj.amount)
  }
  discount = Math.min(discount, subtotal)

  return { discount, discountId: discountObj.id, error: null }
}

// ─── Preračun davka ob popustu ───────────────────────────────

export function recalculateTaxWithDiscount(
  subtotal: number,
  tax: number,
  discount: number
): { taxableBase: number; recalculatedTax: number; total: number } {
  const taxableBase = subtotal - discount
  const taxRatio = subtotal > 0 ? tax / subtotal : 0
  const recalculatedTax = Math.round(taxableBase * taxRatio * 100) / 100
  const total = taxableBase + recalculatedTax
  return { taxableBase, recalculatedTax, total }
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
