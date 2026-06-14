// ============================================
// DOBAVITELJI — Skupne tipi in konstante
// ============================================

export interface SupplierType {
  id: string
  name: string
  code: string
  contactPerson: string
  email: string
  phone: string
  address: string
  city: string
  postCode: string
  country: string
  businessId: string
  taxId: string
  iban: string
  bank: string
  paymentTerms: string
  deliveryDays: string
  minOrderAmount: number
  rating: number
  isActive: boolean
  _count?: { purchaseOrders: number }
  createdAt: string
}

export interface PurchaseOrderType {
  id: string
  poNumber: string
  supplierId: string
  supplier: { id: string; name: string }
  status: string
  orderDate: string
  expectedDate: string | null
  receivedDate: string | null
  subtotal: number
  vatAmount: number
  totalAmount: number
  deliveryAddress: string
  notes: string
  items: PurchaseOrderItemType[]
  createdAt: string
}

export interface PurchaseOrderItemType {
  id: string
  description: string
  inventoryItemId: string | null
  inventoryItem: { id: string; name: string } | null
  quantityOrdered: number
  quantityReceived: number
  unit: string
  unitPrice: number
  vatRate: number
  totalPrice: number
  status: string
}

// ============================================
// STATUSNE MAPE
// ============================================
export const poStatusLabels: Record<string, string> = {
  draft: 'Osnutek',
  sent: 'Poslano',
  confirmed: 'Potrjeno',
  partial: 'Delno prejeto',
  received: 'Prejeto',
  cancelled: 'Preklicano',
}

export const poStatusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  confirmed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  received: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}
