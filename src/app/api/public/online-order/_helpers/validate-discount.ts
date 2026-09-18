// Pomožne funkcije za online naročila — Validacija popusta znotraj transakcije

import { db } from '@/lib/db'
import { toNum, calcDiscount } from '@/lib/decimal'
import { withLocationColumnFallback } from '@/lib/prisma-column-fallback'

export async function validateDiscount(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  promoCode: string | undefined,
  subtotal: number,
  locationId: string,
): Promise<number> {
  if (!promoCode) return 0

  // MODEL A: promo koda velja SAMO na lokaciji naročila (prej globalno —
  // koda druge lokacije/najemnika bi se uveljavila tudi tukaj!)
  // FIX QA runda 39: P1054 most — Discount tabela v Neonu nima locationId stolpca
  const discountObj = await withLocationColumnFallback('online-order:validateDiscount', (withLoc) =>
    tx.discount.findFirst({
      where: withLoc
        ? { promoCode: promoCode.trim().toUpperCase(), isActive: true, triggerType: 'promo_code', locationId }
        : { promoCode: promoCode.trim().toUpperCase(), isActive: true, triggerType: 'promo_code' },
    }))
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
