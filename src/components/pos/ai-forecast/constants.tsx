// ============================================
// AI PREDIKTIVNA ANALÍTIKA ZALOGE — Skupne konstante in tipi
// Napovedi, pametna naročila, sezonski vzorci
// ============================================

import { TrendingUp, TrendingDown, Minus, AlertTriangle, ShieldCheck, Zap, Clock } from 'lucide-react'
import type { ReactNode } from 'react'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// --- TIPI ---

export interface ForecastItem {
  inventoryItemId: string
  itemName: string
  unit: string
  currentStock: number
  minStock: number
  avgDailyUsage: number
  forecast7d: number
  forecast14d: number
  forecast30d: number
  daysUntilEmpty: number | null
  needsReorder: boolean
  suggestedOrderQty: number
  confidence: number
  seasonalityFactor: number
  trend: 'increasing' | 'decreasing' | 'stable'
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  weekdayBreakdown: { day: string; avgUsage: number }[]
  lastRestockDate: string | null
  lastRestockQty: number
}

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

// --- KONSTANTE ---

export const riskConfig: Record<string, { color: string; bgColor: string; icon: ReactNode; label: string }> = {
  critical: { color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <AlertTriangle className="h-4 w-4" />, label: 'Kritično' },
  high: { color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: <Zap className="h-4 w-4" />, label: 'Visoko' },
  medium: { color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <Clock className="h-4 w-4" />, label: 'Zmerno' },
  low: { color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <ShieldCheck className="h-4 w-4" />, label: 'Nizko' },
}

export const trendConfig: Record<string, { icon: ReactNode; color: string; label: string }> = {
  increasing: { icon: <TrendingUp className="h-4 w-4" />, color: 'text-amber-600', label: 'Narašča' },
  decreasing: { icon: <TrendingDown className="h-4 w-4" />, color: 'text-emerald-600', label: 'Pada' },
  stable: { icon: <Minus className="h-4 w-4" />, color: 'text-muted-foreground', label: 'Stabilen' },
}

// --- POMOŽNE FUNKCIJE ---

export const fmt = (n: number | null | undefined) => safeToFixed(n ?? 0, 2)
export const fmtQty = (n: number | null | undefined) => { const v = n ?? 0; return v < 1 ? safeToFixed(v, 3) : safeToFixed(v, 1) }

// --- PROPS INTERFACI ZA POD-KOMPONENTE ---

export interface SummaryCardsProps {
  summary: Record<string, number> | undefined
}

export interface ForecastTabProps {
  forecasts: ForecastItem[]
  isLoading: boolean
}

export interface ReorderTabProps {
  reorders: ReorderSuggestion[]
  isLoading: boolean
  selectedItems: Set<string>
  onToggleItem: (_id: string) => void
  onSelectAll: () => void
  onCreateReorder: () => void
  isReorderPending: boolean
}

export interface AnalysisTabProps {
  forecasts: ForecastItem[]
}
