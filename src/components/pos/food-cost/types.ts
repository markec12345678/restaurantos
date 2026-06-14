// ============================================
// TIPI IN KONSTANTE ZA FOOD COST CALCULATOR
// ============================================

import type { RecipeIngredientRow } from '@/lib/types'

export interface FoodCostItem {
  id: string
  name: string
  category: string
  salesCategory: string
  sellingPriceExVat: number
  vatRate: number
  sellingPriceInclVat: number
  totalIngredientCost: number
  foodCostPercent: number
  grossProfit: number
  grossMarginPercent: number
  classification: string
  suggestedPrice: number
  priceDifference: number
  ingredients: RecipeIngredientRow[]
  hasRecipe: boolean
  allergens: string
}

export interface FoodCostSummary {
  totalItems: number
  itemsWithRecipes: number
  itemsWithoutRecipes: number
  avgFoodCost: number
  avgGrossMargin: number
  stars: number
  plowhorses: number
  puzzles: number
  dogs: number
  itemsOverTarget: number
}

export const CLASSIFICATION_COLORS: Record<string, string> = {
  Star: 'bg-green-100 text-green-800 border-green-300',
  Plowhorse: 'bg-blue-100 text-blue-800 border-blue-300',
  Puzzle: 'bg-purple-100 text-purple-800 border-purple-300',
  Dog: 'bg-red-100 text-red-800 border-red-300',
}

export const CLASSIFICATION_LABELS: Record<string, string> = {
  Star: '⭐ Zvezda — Visoka marža, prodajna',
  Plowhorse: '🐴 Delni konj — Priljubljena, nižja marža',
  Puzzle: '🧩 Uganka — Visoka marža, manj prodajna',
  Dog: '🐕 Pes — Nizka marža, manj prodajna',
}

export const FILTER_OPTIONS = [
  { key: 'all', label: 'Vsi' },
  { key: 'Star', label: '⭐ Zvezde' },
  { key: 'Plowhorse', label: '🐴 Delni konji' },
  { key: 'Puzzle', label: '🧩 Uganke' },
  { key: 'Dog', label: '🐕 Psi' },
  { key: 'over_target', label: '⚠️ Nad 30%' },
  { key: 'no_recipe', label: '📝 Brez recepta' },
] as const
