// ============================================
// PAMETNO NAROČANJE ZALOGE — Tipi
// ============================================

export interface ReorderSuggestion {
  inventoryItemId: string
  itemName: string
  unit: string
  supplier: string
  currentStock: number
  suggestedQty: number
  costPerUnit: number
  totalCost: number
  urgency: 'critical' | 'high' | 'medium' | 'low'
  reason: string
  lastOrderDate: string | null
  avgDeliveryDays: number
  category: string
}

export interface ReorderSummary {
  totalSuggestions: number
  totalEstimatedCost: number
  criticalCount: number
  highCount: number
  bySupplier: Record<string, number>
  byCategory: Record<string, number>
}

export interface ReorderResult {
  summary: ReorderSummary
  suggestions: ReorderSuggestion[]
}

export interface ReorderOrderResult {
  inventoryItemId: string
  itemName: string
  quantity: number
  totalCost: number
}
