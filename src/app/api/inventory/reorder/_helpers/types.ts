// ============================================
// PAMETNO NAROČANJE ZALOGE — Tipi
// ============================================
// R129 (epic #115 P1-07): ReorderSuggestion je razširjen s kanonskimi
// polji iz '@/lib/reorder/canon' (status/dataStatus/factors + viri podatkov).
// STARA polja ostanejo nespremenjena (UI ReorderTab konsumira strukturno).
// ============================================

import type {
  ReorderStatus,
  DataStatus,
  LeadTimeSource,
  SafetyStockSource,
  ReorderPointSource,
} from '@/lib/reorder/canon'

export interface ReorderSuggestion {
  // --- kompatibilna polja (obstoječi UI tok) ---
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
  // --- R129 kanon (explainable reorder) ---
  status: ReorderStatus
  dataStatus: DataStatus
  factors: string[]
  reorderPoint: number
  reorderPointSource: ReorderPointSource
  safetyStock: number | null
  safetyStockSource: SafetyStockSource
  leadTimeDays: number
  leadTimeSource: LeadTimeSource
  openPoQty: number
  openPos: Array<{ poNumber: string; expectedDate: string | null }>
  expectedDelivery: string | null
  unitPrice: number
  // --- R130 (epic #115 P1-08): vir enotne cene — zgodovina dobavitelja
  // OVERIDE-a costPerUnit; brez zgodovine 'item-cost' (back-compat: unitPrice
  // ostane costPerUnit, nova polja so čisto aditivna).
  unitPriceSource: 'supplier-history' | 'item-cost'
  /** ISO čas zadnjega opažanja cene; null pri 'item-cost'. */
  unitPriceAsOf: string | null
  itemId: string
  name: string
  avgDailyUsage: number
  recentUsage: number
  trend: 'increasing' | 'decreasing' | 'stable'
  isLowStock: boolean
  daysUntilEmpty: number
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
