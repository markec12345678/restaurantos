// ============================================
// TIPI
// ============================================
export interface OrderItemWithMenu {
  id: string
  quantity: number
  price: number
  notes: string
  modifiersJson: string
  status: string
  menuItem: {
    id: string
    name: string
    category: { id: string; name: string; icon: string; menu: { id: string; name: string } }
  }
}

export interface EnrichedOrder {
  id: string
  orderNumber: number
  type: string
  status: string
  customerName: string
  notes: string
  createdAt: string
  waitMinutes: number
  urgency: 'normal' | 'warning' | 'critical'
  pendingCount: number
  preparingCount: number
  readyCount: number
  totalItems: number
  table: { id: string; number: number; area: string } | null
  orderItems: OrderItemWithMenu[]
}

export interface KDSData {
  orders: EnrichedOrder[]
  stats: {
    totalActive: number
    pendingOrders: number
    inProgressOrders: number
    totalItemsPending: number
    totalItemsPreparing: number
    totalItemsReady: number
    avgWaitTime: number
    criticalOrders: number
  }
}
