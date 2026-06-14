// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Tipi za sledenje naročila
// ═══════════════════════════════════════════════════════════════

/** Posamezen artikel v naročilu */
export interface OrderItem {
  id: string
  menuItem: { name: string }
  quantity: number
  status: string
}

/** Polni podatki naročila za sledenje */
export interface OrderData {
  id: string
  orderNumber: number
  type: string
  status: string
  total: number
  customerName: string
  createdAt: string
  estimatedReady?: string
  orderItems: OrderItem[]
  table?: { number: number }
  location?: { name: string; address: string; phone: string }
}
