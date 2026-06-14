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

// Oznake vrste naročila
export const TYPE_LABELS: Record<string, string> = {
  'dine-in': '🍽️ Na mestu',
  'takeout': '📦 Za s seboj',
  'delivery': '🚚 Dostava',
}

// Obrobe nujnosti
export const URGENCY_BORDER: Record<string, string> = {
  normal: 'border-l-4 border-l-blue-400',
  warning: 'border-l-4 border-l-amber-400',
  critical: 'border-l-4 border-l-red-500',
}

// Ozadja nujnosti
export const URGENCY_BG: Record<string, string> = {
  normal: '',
  warning: 'bg-amber-50/50 dark:bg-amber-900/10',
  critical: 'bg-red-50/50 dark:bg-red-900/10',
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
