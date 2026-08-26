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
    method: 'recipe' | 'direct'
  }>
  lowStockAlerts: Array<{
    inventoryItemId: string
    name: string
    currentQty: number
    minQty: number
  }>
  errors: Array<{
    inventoryItemId?: string
    name?: string
    error: string
  }>
}
