// ============================================
// DECIMAL UTILITY — Varna aritmetika za finančne izračune
// FIX: Po spremembi sheme Float→Decimal vrača Prisma Prisma.Decimal objekte,
// ne JS number. Ta modul zagotavlja varno pretvorbo in aritmetiko.
// ============================================

import { Prisma } from '@prisma/client'

export type DecimalLike = Prisma.Decimal | number | string | null | undefined

/**
 * Pretvori Prisma.Decimal v JS number za prikaz/aritmetiko.
 * Vrne 0 za null/undefined.
 */
export function toNum(val: DecimalLike): number {
  if (val == null) return 0
  if (val instanceof Prisma.Decimal) return val.toNumber()
  if (typeof val === 'number') return val
  return Number(val) || 0
}

/**
 * Pretvori v Prisma.Decimal za natančno aritmetiko.
 * Vrne Decimal(0) za null/undefined.
 */
export function toDec(val: DecimalLike): Prisma.Decimal {
  if (val == null) return new Prisma.Decimal(0)
  return new Prisma.Decimal(val as string | number)
}

/**
 * Varna vsota Decimal polja z uporabo Prisma.Decimal.add()
 * Prepreči string concatenation in float napake.
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

/**
 * Zaokroži na 2 decimalni mesti (za EUR zneske).
 * Uporablja Decimal.round() za natančnost.
 */
export function round2(val: DecimalLike): number {
  return toDec(val).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber()
}

/**
 * Zaokroži na 3 decimalna mesta (za količine).
 */
export function round3(val: DecimalLike): number {
  return toDec(val).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP).toNumber()
}

/**
 * Varna primerjava: ali je Decimal vrednost > 0?
 * Reši problem Decimal(0) truthy bug — Decimal(0) je JS truthy (objekt).
 */
export function isPositive(val: DecimalLike): boolean {
  return toDec(val).isPositive()
}

/**
 * Varna primerjava: ali je Decimal vrednost > drugo?
 */
export function greaterThan(a: DecimalLike, b: DecimalLike): boolean {
  return toDec(a).greaterThan(toDec(b))
}

/**
 * Varna primerjava: ali je Decimal vrednost >= drugo?
 */
export function greaterThanOrEqual(a: DecimalLike, b: DecimalLike): boolean {
  return toDec(a).greaterThanOrEqualTo(toDec(b))
}

/**
 * Varna primerjava: ali sta Decimal vrednosti enaki?
 */
export function decEquals(a: DecimalLike, b: DecimalLike): boolean {
  return toDec(a).equals(toDec(b))
}

/**
 * Varno odštevanje z uporabo Decimal aritmetike.
 */
export function subtract(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  return toDec(a).minus(toDec(b))
}

/**
 * Varno seštevanje z uporabo Decimal aritmetike.
 */
export function add(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  return toDec(a).plus(toDec(b))
}

/**
 * Varno množenje z uporabo Decimal aritmetike.
 */
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

/**
 * Absolutna vrednost Decimal.
 */
export function abs(val: DecimalLike): Prisma.Decimal {
  return toDec(val).abs()
}

/**
 * Maximum dveh Decimal vrednosti.
 */
export function max(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  return toDec(a).greaterThan(toDec(b)) ? toDec(a) : toDec(b)
}

/**
 * Minimum dveh Decimal vrednosti.
 */
export function min(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  return toDec(a).lessThan(toDec(b)) ? toDec(a) : toDec(b)
}

/**
 * Pripne Decimal vrednost v Prisma update data.
 * FIX BUG-2: Preskoči number round-trip — ohrani Decimal natančnost.
 */
export function toPrismaDecimal(val: DecimalLike): Prisma.Decimal {
  return toDec(val).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
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

/**
 * Pretvori Decimal polje v number polje za JSON serializacijo.
 * OPOMBA: Pretvori SAMO top-level polja — za gnezdene objekte uporabi deepToNumbers().
 */
export function decimalsToNumbers<T extends Record<string, unknown>>(obj: T, decimalFields: (keyof T)[]): T {
  const result = { ...obj } as Record<string, unknown>
  for (const field of decimalFields) {
    const val = result[field as string]
    if (val != null && typeof val === 'object' && 'toNumber' in val) {
      result[field as string] = (val as { toNumber: () => number }).toNumber()
    }
  }
  return result as T
}

/**
 * REKURZIVNO pretvori VSE Prisma.Decimal objekte v JS numbers.
 * Reši sistemski bug: Prisma.Decimal.toJSON() vrača string namesto number.
 * Uporabi pred NextResponse.json() na kateremkoli Prisma rezultatu.
 *
 * Primer:
 *   return NextResponse.json(deepToNumbers(order))
 *
 * Obdeluje:
 * - Prisma.Decimal objekte → number (via .toNumber())
 * - Arraye → mapira rekurzivno
 * - Objekte → mapira rekurzivno
 * - null/undefined/primitivne tipi → nespremenjeni
 * - Date objekte → nespremenjeni (ne pretvori v number)
 */
export function deepToNumbers<T>(val: T): T {
  if (val == null) return val
  // Prisma.Decimal ima .toNumber() metodo
  if (typeof val === 'object' && 'toNumber' in val && typeof (val as Record<string, unknown>).toNumber === 'function') {
    return (val as unknown as { toNumber: () => number }).toNumber() as T
  }
  if (Array.isArray(val)) {
    return val.map(deepToNumbers) as T
  }
  // FIX LOW: Preskoči specialne objekte, ki jih ne smemo rekurzivno obdelati
  if (val instanceof Date || val instanceof Map || val instanceof Set || val instanceof Buffer || ArrayBuffer.isView(val)) {
    return val
  }
  if (typeof val === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(val as Record<string, unknown>)) {
      result[key] = deepToNumbers(value)
    }
    return result as T
  }
  return val
}
