// Pomožne funkcije za Checks API
// Izračuni zneskov, validacija popustov
//
// ─── R207 (issue #151 korak 2, §18): DECIMAL MIGRACIJA ───
// calculateCheckAmounts je prej akumuliral `subtotal += itemBase` v JS float.
// Kanon P1-8 pravi: "vsa aritmetika gre skozi Prisma.Decimal". Zdaj se vsote
// akumulirajo v Prisma.Decimal (točno za 2dp vhode) — pretvorba v number je
// izključno na API meji. Pisalna meja ostaja zaščitena z round2(...) v
// R181 recalc kanonu (transaction.ts) — obnašanje na pisalni meji je
// nespremenjeno (parity dokaz: tests/unit/lib/r151-financial-chain-pins.test.ts
// §18). To je bila dokumentirana kanon-divergenca (NE potrjen defekt — pri
// 2dp vhodih in realističnih velikostih odmika na pisalni meji ni bilo);
// divergenca je z migracijo odpravljena v izvoru.

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { toNum, toDec } from '@/lib/decimal'

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
  // R207 §18: akumulacija v Prisma.Decimal — vsota 2dp vrednosti je v
  // Decimal TOČNA (ni float akumulacijskega odmika). Kontrakt nespremenjen:
  // { subtotal: number, tax: number } (number = izključno API meja).
  let subtotal = new Prisma.Decimal(0)
  let tax = new Prisma.Decimal(0)
  for (const oi of checkOrderItems) {
    const price = toDec(oi.price)
    const qty = toDec(oi.quantity)
    const itemBase = price.times(qty)
    const itemVat = toDec(oi.vatAmount).gt(0)
      ? toDec(oi.vatAmount)
      : price.times(qty).times(toDec(oi.vatRate)).dividedBy(100)
    subtotal = subtotal.plus(itemBase)
    tax = tax.plus(itemVat)
  }
  return { subtotal: subtotal.toNumber(), tax: tax.toNumber() }
}

// ─── Validacija in izračun popusta ───────────────────────────

export interface DiscountValidation {
  discount: number
  discountId: string | null
  error: string | null
}

// R181 CK-5: opcijski `client` — znotraj pisalnega kanona se validacija
// izvede proti TX-FRESH podatkom (isti klient kot create/link/recalc),
// zunaj tx ostane privzeti `db` (UX pre-flight).
export async function validateAndCalculateDiscount(
  appliedDiscountId: string | null | undefined,
  subtotal: number,
  locationId?: string,
  client: Prisma.TransactionClient = db as Prisma.TransactionClient
): Promise<DiscountValidation> {
  if (!appliedDiscountId) {
    return { discount: 0, discountId: null, error: null }
  }

  // BUG-HUNT FIX 2026-09-19: locationId scope — popust druge lokacije ni uporabljiv
  // (Discount.locationId je NOT NULL po MODEL A). findFirst ohranja staro
  // semantiko "ni najden → brez popusta" namesto findUnique + ročni filter.
  const discountObj = await client.discount.findFirst({
    where: { id: appliedDiscountId, ...(locationId ? { locationId } : {}) },
  })
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
