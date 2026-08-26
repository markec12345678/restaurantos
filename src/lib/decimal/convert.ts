// ============================================
// DECIMAL CONVERT — Pretvorbe Decimal ↔ number
// ============================================

import { Prisma } from '@prisma/client'
import type { DecimalLike } from './types'

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
 */
export function deepToNumbers<T>(val: T): T {
  if (val == null) return val
  if (typeof val === 'object' && 'toNumber' in val && typeof (val as Record<string, unknown>).toNumber === 'function') {
    return (val as unknown as { toNumber: () => number }).toNumber() as T
  }
  if (Array.isArray(val)) {
    return val.map(deepToNumbers) as T
  }
  // FIX WORKFLOW-46: Date → ISO string (Zod response sheme pričakujejo string, ne Date)
  if (val instanceof Date) {
    return val.toISOString() as T
  }
  if (val instanceof Map || val instanceof Set || val instanceof Buffer || ArrayBuffer.isView(val)) {
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
