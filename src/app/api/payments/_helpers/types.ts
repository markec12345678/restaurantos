// Pomožne funkcije za Payments API — Tipi

import { Prisma } from '@prisma/client'

export interface PaymentInput {
  checkId: string
  amount: number | Prisma.Decimal
  tipAmount: number | Prisma.Decimal
  type: string
  alternatePaymentTypeId: string | null
  cardType: string | null
  cardLast4: string | null
  authorizationCode: string | null
  giftCardId: string | null
  loyaltyAccountId: string | null
  loyaltyPointsUsed: number
  employeeId: string | null
  idempotencyKey: string | null
  // FIX P0-C3B: locationId za tenant-scoped loyalty config
  // Klicatelj naj posreduje order.locationId (ali session.locationId za cash payments)
  // TODO P0-C4: Ko bo Location model imel loyalty polja (loyaltyEnabled, pointsPerEuro, pointsValue),
  // bomo prebrali iz Location namesto RestaurantSettings.
  locationId?: string | null
}
