// ============================================
// DECIMAL ROUNDING — Zaokroževanje in Prisma pretvorbe
// ============================================

import { Prisma } from '@prisma/client'
import type { DecimalLike } from './types'
import { toDec } from './convert'

/** Zaokroži na 2 decimalni mesti (za EUR zneske). */
export function round2(val: DecimalLike): number {
  return toDec(val).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber()
}

/** Zaokroži na 3 decimalna mesta (za količine). */
export function round3(val: DecimalLike): number {
  return toDec(val).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP).toNumber()
}

/**
 * Pripne Decimal vrednost v Prisma update data.
 * FIX BUG-2: Preskoči number round-trip — ohrani Decimal natančnost.
 */
export function toPrismaDecimal(val: DecimalLike): Prisma.Decimal {
  return toDec(val).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}
