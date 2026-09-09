// ============================================
// TIPI ZA RAZKNJIŽEVANJE ZALOGE
// ============================================

export interface StockDeductionItem {
  menuItemId: string
  quantity: number
  voided?: boolean
}

export interface StockDeductionResult {
  success: boolean
  deducted: Array<{
    inventoryItemId: string
    name: string
    quantityDeducted: number
    previousQty: number
    newQty: number
    // 'snapshot' = vračilo po snapshotu dedukcije (mirror sale vrstic — P1-19)
    method: 'recipe' | 'direct' | 'snapshot'
  }>
  lowStockAlerts: Array<{
    inventoryItemId: string
    name: string
    currentQty: number
    minQty: number
    // WS AUDIT 2026-09-09: lokacija inventory artikla — za per-location WS dostavo
    locationId?: string | null
  }>
  errors: Array<{
    inventoryItemId?: string
    name?: string
    error: string
  }>
}
