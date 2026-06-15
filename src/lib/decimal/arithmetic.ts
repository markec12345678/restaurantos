// ============================================
// DECIMAL ARITHMETIC — Varna aritmetika za finančne izračune
// ============================================

import { Prisma } from '@prisma/client'
import type { DecimalLike } from './types'
import { toDec } from './convert'

/**
 * Varna vsota Decimal polja z uporabo Prisma.Decimal.add()
 */
export function sumDecimals(values: DecimalLike[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (sum, val) => sum.plus(toDec(val)),
    new Prisma.Decimal(0)
  )
}

/**
 * Varna vsota z uporabo accessor funkcije.
 * Primer: sumBy(orderItems, oi => oi.price)
 */
export function sumBy<T>(items: T[], accessor: (_item: T) => DecimalLike): Prisma.Decimal {
  return items.reduce<Prisma.Decimal>(
    (sum, item) => sum.plus(toDec(accessor(item))),
    new Prisma.Decimal(0)
  )
}

/** Varno odštevanje z uporabo Decimal aritmetike. */
export function subtract(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  return toDec(a).minus(toDec(b))
}

/** Varno seštevanje z uporabo Decimal aritmetike. */
export function add(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  return toDec(a).plus(toDec(b))
}

/** Varno množenje z uporabo Decimal aritmetike. */
export function multiply(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  return toDec(a).times(toDec(b))
}

/**
 * Varno deljenje z uporabo Decimal aritmetike.
 * FIX BUG-3: Vrže napako namesto tihega vračanja 0 pri deljenju z 0.
 */
export function divide(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  const divisor = toDec(b)
  if (divisor.isZero()) throw new Error('Deljenje z nič v finančnem izračunu')
  return toDec(a).dividedBy(divisor)
}
