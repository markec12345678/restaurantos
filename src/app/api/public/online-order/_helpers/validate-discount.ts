// Pomožne funkcije za online naročila — Validacija popusta znotraj transakcije

import { db } from '@/lib/db'
import { toNum, calcDiscount } from '@/lib/decimal'

export async function validateDiscount(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  promoCode: string | undefined,
  subtotal: number,
): Promise<number> {
  if (!promoCode) return 0

  const discountObj = await tx.discount.findFirst({
    where: { promoCode: promoCode.trim().toUpperCase(), isActive: true, triggerType: 'promo_code' },
  })
  if (!discountObj) return 0

  const now = new Date()
  const isWithinValidity = (!discountObj.validFrom || now >= discountObj.validFrom) &&
                            (!discountObj.validTo || now <= discountObj.validTo)
  if (!isWithinValidity) return 0

  const claimed = await tx.discount.updateMany({
    where: { id: discountObj.id, currentUses: { lt: discountObj.maxUses ?? Infinity } },
    data: { currentUses: { increment: 1 } },
  })
  if (claimed.count === 0) return 0

  let discount = 0
  if (discountObj.type === 'percentage') discount = calcDiscount(subtotal, discountObj.amount, 'percentage')
  else if (discountObj.type === 'fixed_amount') discount = toNum(discountObj.amount)
  return Math.min(discount, subtotal)
}
