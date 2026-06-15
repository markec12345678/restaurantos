// Pomožne funkcije za /api/checks/[id]

import { db } from '@/lib/db'
import { toNum, round2, multiply, divide, subtract, add, greaterThan } from '@/lib/decimal'
import type { Prisma } from '@prisma/client'

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0]
type Decimal = Prisma.Decimal

interface ExistingCheck {
  id: string
  subtotal: Decimal | number
  tax: Decimal | number
  serviceCharge: Decimal | number
  tip: Decimal | number
  appliedDiscountId: string | null
}

// Validiraj popust — preveri isActive, veljavnost, maxUses
export async function validateDiscount(
  tx: TransactionClient,
  discountId: string,
): Promise<{ valid: boolean; error?: string; discountObj?: Awaited<ReturnType<typeof tx.discount.findUnique>> }> {
  const discountObj = await tx.discount.findUnique({ where: { id: discountId } })
  if (!discountObj) return { valid: false, error: 'Popust ni najden' }

  if (!discountObj.isActive) return { valid: false, error: 'Popust ni aktiven' }

  const now = new Date()
  if (discountObj.validFrom && now < discountObj.validFrom) {
    return { valid: false, error: 'Popust še ni veljaven' }
  }
  if (discountObj.validTo && now > discountObj.validTo) {
    return { valid: false, error: 'Popust je potekel' }
  }
  if (discountObj.maxUses !== null && discountObj.currentUses >= discountObj.maxUses) {
    return { valid: false, error: 'Popust je že bil uporabljen največkrat' }
  }

  return { valid: true, discountObj }
}

// Izračunaj popust in posodobi davčne osnove
export function calculateDiscountUpdate(
  discountObj: NonNullable<Awaited<ReturnType<TransactionClient['discount']['findUnique']>>>,
  existingCheck: ExistingCheck,
): Record<string, unknown> {
  let discount = 0
  if (discountObj.type === 'percentage') {
    discount = round2(multiply(existingCheck.subtotal, divide(discountObj.amount, 100)))
  } else if (discountObj.type === 'fixed_amount') {
    discount = toNum(discountObj.amount)
  }
  discount = Math.min(discount, toNum(existingCheck.subtotal))

  // Popust zmanjša davčno osnovo — DDV se mora preračunati (EU/FURS zahteva)
  const taxableBase = subtract(existingCheck.subtotal, discount)
  const taxRatio = greaterThan(existingCheck.subtotal, 0) ? toNum(divide(existingCheck.tax, existingCheck.subtotal)) : 0
  const recalculatedTax = round2(multiply(taxableBase, taxRatio))
  const total = round2(add(add(taxableBase, recalculatedTax), existingCheck.serviceCharge))
  const totalWithTip = round2(add(add(add(taxableBase, recalculatedTax), existingCheck.serviceCharge), existingCheck.tip))

  return { discount, tax: recalculatedTax, total, totalWithTip }
}

// Izračunaj check total brez popusta
export function calculateNoDiscountTotals(existingCheck: ExistingCheck): Record<string, unknown> {
  const total = round2(add(add(existingCheck.subtotal, existingCheck.tax), existingCheck.serviceCharge))
  const totalWithTip = round2(add(add(add(existingCheck.subtotal, existingCheck.tax), existingCheck.serviceCharge), existingCheck.tip))
  return { discount: 0, total, totalWithTip }
}

// Atomarna posodobitev currentUses znotraj transakcije
export async function incrementDiscountUsage(
  tx: TransactionClient,
  discountId: string,
  maxUses: number | null,
): Promise<boolean> {
  if (maxUses !== null) {
    const updated = await tx.discount.updateMany({
      where: { id: discountId, currentUses: { lt: maxUses } },
      data: { currentUses: { increment: 1 } },
    })
    return updated.count > 0
  }
  await tx.discount.update({
    where: { id: discountId },
    data: { currentUses: { increment: 1 } },
  })
  return true
}

// Zmanjšaj currentUses za prejšnji popust
export async function decrementDiscountUsage(tx: TransactionClient, discountId: string): Promise<void> {
  await tx.discount.updateMany({
    where: { id: discountId, currentUses: { gt: 0 } },
    data: { currentUses: { decrement: 1 } },
  })
}
