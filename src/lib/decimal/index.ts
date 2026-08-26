// ============================================
// DECIMAL UTILITY — Barrel export
// Varna aritmetika za finančne izračune
// ============================================

export type { DecimalLike, Prisma } from './types'

export { toNum, toDec, decimalsToNumbers, deepToNumbers } from './convert'
export { sumDecimals, sumBy, subtract, add, multiply, divide } from './arithmetic'
export { isPositive, greaterThan, greaterThanOrEqual, decEquals } from './compare'
export { round2, round3, toPrismaDecimal } from './rounding'
export { abs, max, min, calcVat, calcDiscount } from './calc'
