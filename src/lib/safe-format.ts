// ============================================
// SAFE FORMAT — Varna pretvorba za .toFixed() klice
// Rešuje: "e.price.toFixed is not a function" na Vercelu
// ============================================

/**
 * Varno pretvori vrednost v number in formatira z decimalnimi mesti.
 * Deluje z: number, string, Prisma.Decimal, null, undefined.
 */
export function safeToFixed(val: unknown, decimals = 2): string {
  if (val == null) return '0.' + '0'.repeat(decimals)
  if (typeof val === 'number') return val.toFixed(decimals)
  if (typeof val === 'string') {
    const n = parseFloat(val)
    return isNaN(n) ? '0.' + '0'.repeat(decimals) : n.toFixed(decimals)
  }
  // Prisma.Decimal ali drug objekt s toNumber()
  if (typeof val === 'object' && val !== null && 'toNumber' in val) {
    return (val as { toNumber: () => number }).toNumber().toFixed(decimals)
  }
  return '0.' + '0'.repeat(decimals)
}

/**
 * Varno pretvori vrednost v number.
 */
export function safeNum(val: unknown): number {
  if (val == null) return 0
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = parseFloat(val)
    return isNaN(n) ? 0 : n
  }
  if (typeof val === 'object' && val !== null && 'toNumber' in val) {
    return (val as { toNumber: () => number }).toNumber()
  }
  return Number(val) || 0
}
