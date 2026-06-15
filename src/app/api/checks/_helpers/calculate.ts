// Pomožne funkcije za Checks API
// Izračuni zneskov, validacija popustov

import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'

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
