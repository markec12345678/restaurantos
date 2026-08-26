// ============================================
// CENTRALIZIRANO RAZKNJIŽEVANJE ZALOGE
// Skrbi za pravilno odbiranje zaloge ob prodaji
// in vračanje ob preklicu/stornu
// ============================================

// Tipi
export type { StockDeductionItem, StockDeductionResult } from './types'

// Preverjanje razpoložljivosti
export { checkStockAvailability } from './check-availability'

// Odbiranje zaloge
export { deductStockForAddedItems } from './deduct-added'
export { deductStockForOrder } from './deduct-order'

// Vračanje zaloge
export { returnStockForOrder } from './return-stock'

// Obvestila
export { broadcastLowStockAlert } from './broadcast'
