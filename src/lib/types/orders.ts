// --- Naročilni tipi ---

/** Naročilo iz API-ja */
export interface OrderRow {
  id: string
  orderNumber?: string
  status: string
  total: number
  type?: string
  createdAt: string
  updatedAt?: string
  completedAt?: string
  tableId?: string
  tableName?: string
  employeeId?: string
  employeeName?: string
  items: OrderItemRow[]
  orderItems?: OrderItemRow[]
  checks?: CheckRow[]
  payments?: PaymentRow[]
  tip?: number
  discountAmount?: number
  deliveryFee?: number
  notes?: string
  priority?: string
  [key: string]: unknown // za dodatne podatke iz API-ja
}

/** Postavka naročila */
export interface OrderItemRow {
  id: string
  menuItemId?: string
  itemName?: string
  name?: string
  quantity: number
  price: number
  unitPrice?: number
  total?: number
  status?: string
  category?: string
  notes?: string
  modifiers?: ModifierRow[]
  inventoryItemId?: string
  priority?: string
  prepTime?: number
  startedAt?: string
  specialInstructions?: string
  taxRate?: number
  [key: string]: unknown
}

/** Modifikator postavke */
export interface ModifierRow {
  id?: string
  name: string
  price?: number
  [key: string]: unknown
}

/** Račun / Check */
export interface CheckRow {
  id: string
  total: number
  tip?: number
  payments?: PaymentRow[]
  [key: string]: unknown
}

/** Plačilo */
export interface PaymentRow {
  id: string
  method: string
  amount: number
  [key: string]: unknown
}

/** Miza */
export interface TableRow {
  id: string
  name?: string
  number?: number
  seats?: number
  status?: string
  area?: string
  sectionId?: string
  [key: string]: unknown
}

/** Rezultat naročanja */
export interface OrderResultRow {
  orderId: string
  orderNumber?: string
  estimatedTime?: string
  message?: string
  order?: {
    id?: string
    orderNumber?: number | string
    [key: string]: unknown
  }
  [key: string]: unknown
}
