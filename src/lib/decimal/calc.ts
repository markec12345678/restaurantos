// ============================================
// DECIMAL CALC — Finančni izračuni (DDV, popusti, abs, max, min)
// ============================================

import { Prisma } from '@prisma/client'
import type { DecimalLike } from './types'
import { toDec } from './convert'
import { round2 } from './rounding'
import { multiply, divide } from './arithmetic'

/** Absolutna vrednost Decimal. */
export function abs(val: DecimalLike): Prisma.Decimal {
  return toDec(val).abs()
}

/** Maximum dveh Decimal vrednosti. */
export function max(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  return toDec(a).greaterThan(toDec(b)) ? toDec(a) : toDec(b)
}

/** Minimum dveh Decimal vrednosti. */
export function min(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  return toDec(a).lessThan(toDec(b)) ? toDec(a) : toDec(b)
}

/**
 * Izračunaj DDV znesek iz osnove in stopnje.
 * Vrne zaokrožen znesek na 2 decimalni mesti.
 */
export function calcVat(base: DecimalLike, rate: DecimalLike): number {
  return round2(multiply(base, divide(rate, 100)))
}

/**
 * Izračunaj popust: znesek ali odstotek od osnove.
 */
export function calcDiscount(base: DecimalLike, discountAmount: DecimalLike, discountType: 'percentage' | 'fixed_amount' = 'fixed_amount'): number {
  if (discountType === 'percentage') {
    return round2(multiply(base, divide(discountAmount, 100)))
  }
  return round2(discountAmount)
}
