// ═══════════════════════════════════════════════════════════════
// Tipi za natakarjevo tablico (/waiter)
// ═══════════════════════════════════════════════════════════════

export interface ReadyItem {
  name: string
  quantity: number
}

export interface WaiterNotification {
  id: string
  orderId: string
  orderNumber: number
  tableName: string | null
  tableNumber: number | null
  waiterName: string | null
  itemName: string
  itemQuantity: number
  allReady: boolean
  readyCount: number
  totalItems: number
  readyItems: ReadyItem[]
  timestamp: number
  acknowledged: boolean
}

export interface OrderItem {
  id: string
  name: string
  quantity: number
  status: string
  price: number
  notes: string | null
  station: string | null
  course: number
  modifiers: { name: string; priceDelta: number }[]
}

export interface Order {
  id: string
  orderNumber: number
  type: string
  status: string
  table: { id: string; number: number; name: string | null } | null
  employee: { id: string; name: string }
  items: OrderItem[]
  total: number
  subtotal: number
  vatAmount: number
  firedAt: string | null
  createdAt: string
  notes: string | null
}
