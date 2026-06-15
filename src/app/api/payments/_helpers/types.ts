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
}
