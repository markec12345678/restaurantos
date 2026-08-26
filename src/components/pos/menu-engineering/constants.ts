// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Skupne konstante za Menu Engineering Matrix
// Profitability (gross profit %) vs Popularity (prodaja kolicina)
// 4 kvadranti: Star, Puzzle, Plowhorse, Dog
// ═══════════════════════════════════════════════════════════════

import type { LucideIcon } from 'lucide-react'
import { Star, Puzzle, Dog, Truck } from 'lucide-react'

// ─── Tipi ──────────────────────────────────────────────────────

export interface MenuItemAnalysis {
  id: string
  name: string
  category: string
  price: number
  foodCost: number
  grossProfit: number
  grossProfitPercent: number
  quantitySold: number
  revenue: number
  popularityRank: number
  profitabilityRank: number
  quadrant: 'star' | 'puzzle' | 'plowhorse' | 'dog'
}

export interface MenuEngineeringData {
  items: MenuItemAnalysis[]
  medianPopularity: number
  medianProfitability: number
  totalItems: number
  stars: number
  puzzles: number
  plowhorses: number
  dogs: number
}

export type ViewMode = 'matrix' | 'table'

export type QuadrantKey = 'star' | 'puzzle' | 'plowhorse' | 'dog'

// ─── Konstante ─────────────────────────────────────────────────

export const QUADRANT_COLORS: Record<QuadrantKey, string> = {
  star: '#10b981',      // Emerald - visoka profitabilnost, visoka priljubljenost
  puzzle: '#3b82f6',    // Blue - visoka profitabilnost, nizka priljubljenost
  plowhorse: '#f59e0b', // Amber - nizka profitabilnost, visoka priljubljenost
  dog: '#ef4444',       // Red - nizka profitabilnost, nizka priljubljenost
}

export const QUADRANT_LABELS: Record<QuadrantKey, string> = {
  star: 'Zvezda',
  puzzle: 'Uganka',
  plowhorse: 'Delavski konj',
  dog: 'Pes',
}

export const QUADRANT_DESCRIPTIONS: Record<QuadrantKey, string> = {
  star: 'Visoka profitabilnost in priljubljenost. Ohrani in promoviraj!',
  puzzle: 'Visoka profitabilnost, nizka priljubljenost. Promoviraj in vizualno izpostavi!',
  plowhorse: 'Nizka profitabilnost, visoka priljubljenost. Povisaj ceno ali zmanjsaj porcijo!',
  dog: 'Nizka profitabilnost in priljubljenost. Premisli o odstranitvi ali redesignu!',
}

export const QUADRANT_ICONS: Record<QuadrantKey, LucideIcon> = {
  star: Star,
  puzzle: Puzzle,
  plowhorse: Truck,
  dog: Dog,
}

export const QUADRANT_ORDER: Record<QuadrantKey, number> = {
  star: 0,
  puzzle: 1,
  plowhorse: 2,
  dog: 3,
}

// ─── Pomozne funkcije ──────────────────────────────────────────

export const getProfitColorClass = (percent: number): string => {
  if (percent >= 70) return 'text-emerald-600'
  if (percent >= 50) return 'text-amber-600'
  return 'text-red-600'
}

export const getProfitWeightClass = (percent: number): string => {
  if (percent >= 70) return 'text-emerald-600 font-semibold'
  if (percent >= 50) return 'text-amber-600'
  return 'text-red-600 font-semibold'
}

// ─── Props vmesniki za podkomponente ───────────────────────────

export interface MatrixHeaderProps {
  totalItems: number
  categoryFilter: string
  onCategoryFilterChange: (_value: string) => void
  categories: string[]
  viewMode: ViewMode
  onViewModeChange: (_mode: ViewMode) => void
}

export interface QuadrantSummaryCardsProps {
  data: MenuEngineeringData | undefined
}

export interface ScatterViewProps {
  chartData: Array<MenuItemAnalysis & { x: number; y: number; z: number }>
  medianProfitability: number
  medianPopularity: number
}

export interface TableViewProps {
  filteredItems: MenuItemAnalysis[]
}

export interface MatrixTooltipProps {
  active?: boolean
  payload?: Array<{ payload: MenuItemAnalysis }>
}
