// ============================================
// DECIMAL COMPARE — Varna primerjava Decimal vrednosti
// ============================================

import type { DecimalLike } from './types'
import { toDec } from './convert'

/**
 * Varna primerjava: ali je Decimal vrednost > 0?
 * Reši problem Decimal(0) truthy bug — Decimal(0) je JS truthy (objekt).
 */
export function isPositive(val: DecimalLike): boolean {
  return toDec(val).isPositive()
}

/** Varna primerjava: ali je Decimal vrednost > drugo? */
export function greaterThan(a: DecimalLike, b: DecimalLike): boolean {
  return toDec(a).greaterThan(toDec(b))
}

/** Varna primerjava: ali je Decimal vrednost >= drugo? */
export function greaterThanOrEqual(a: DecimalLike, b: DecimalLike): boolean {
  return toDec(a).greaterThanOrEqualTo(toDec(b))
}

/** Varna primerjava: ali sta Decimal vrednosti enaki? */
export function decEquals(a: DecimalLike, b: DecimalLike): boolean {
  return toDec(a).equals(toDec(b))
}
