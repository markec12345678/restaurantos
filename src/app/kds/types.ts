// ═══════════════════════════════════════════════════════════════
// Tipi za KDS (Kitchen Display System)
// ═══════════════════════════════════════════════════════════════

export interface OrderItemKDS {
  id: string
  name: string
  quantity: number
  status: string
  notes: string | null
  category: string | null
  station: string | null
  modifiers: { name: string }[]
  firedAt: string | null
  prepTimeMinutes: number | null
}

export interface OrderKDS {
  id: string
  orderNumber: number
  type: string
  status: string
  table: { number: number; area: string } | null
  employee: { name: string } | null
  items: OrderItemKDS[]
  firedAt: string | null
  createdAt: string
  notes: string | null
  course: number | null
  priority: boolean
}
