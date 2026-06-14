// --- Inventar in dobava ---

/** Inventarna postavka */
export interface InventoryItemRow {
  id: string
  name: string
  unit?: string
  quantity?: number
  minQuantity?: number
  costPerUnit?: number
  supplierId?: string
  category?: string
  expiryDate?: string
  [key: string]: unknown
}

/** Dobavitelj */
export interface SupplierRow {
  id: string
  name: string
  contactPerson?: string
  email?: string
  phone?: string
  leadTimeDays?: number
  rating?: number
  [key: string]: unknown
}

/** Nabavno naročilo */
export interface PurchaseOrderRow {
  id: string
  supplierId: string
  status: string
  total?: number
  createdAt: string
  deliveredAt?: string
  expectedDelivery?: string
  expectedDate?: string
  receivedDate?: string
  orderDate?: string
  items?: PurchaseOrderItemRow[]
  [key: string]: unknown
}

/** Postavka nabavnega naročila */
export interface PurchaseOrderItemRow {
  id: string
  inventoryItemId?: string
  quantity: number
  unitPrice: number
  total: number
  [key: string]: unknown
}

/** Ocena dobavitelja */
export interface SupplierScoreRow {
  id: string
  name: string
  onTimeRate: number
  qualityScore: number
  totalSpent: number
  orderCount: number
  avgDeliveryDays: number
  lastOrderDate?: string
  [key: string]: unknown
}
