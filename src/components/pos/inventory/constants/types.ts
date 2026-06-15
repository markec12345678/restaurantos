// ============================================
// TIPI za upravljanje zalog
// ============================================

export interface InventoryItemData {
  id: string
  name: string
  description: string
  image: string
  unit: string
  quantity: number
  minQuantity: number
  costPerUnit: number
  supplier: string
  category: string
  expiryDate: string | null
  servingsPerUnit: number
  servingSize: string
  costPerServing: number
  menuItemId: string | null
  menuItem?: { id: string; name: string; price: number; image: string } | null
  lastRestocked: string
}

export interface TransactionData {
  id: string
  inventoryItemId: string
  type: string
  quantity: number
  previousQty: number
  newQty: number
  costPerUnit: number
  totalCost: number
  reason: string
  note: string
  supplierDoc: string
  employeeName: string
  orderId: string | null
  createdAt: string
  inventoryItem: { name: string; unit: string; category: string }
}

export interface TransactionSummary {
  type: string
  count: number
  totalQuantity: number
  totalCost: number
}

export interface TransactionsResponse {
  transactions: TransactionData[]
  total: number
  summary: TransactionSummary[]
}

export interface ItemFormData {
  name: string
  description: string
  image: string
  unit: string
  quantity: string
  minQuantity: string
  costPerUnit: string
  supplier: string
  category: string
  expiryDate: string
  menuItemId: string
  servingsPerUnit: string
  servingSize: string
  costPerServing: string
}

export interface RestockFormData {
  quantity: string
  costPerUnit: string
  supplierDoc: string
  employeeName: string
  note: string
}

export interface WriteOffFormData {
  quantity: string
  type: string
  reason: string
  note: string
  employeeName: string
}
