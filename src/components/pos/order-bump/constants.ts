// ============================================
// ORDER BUMP & UPSELL — Skupne konstante in tipi
// ============================================

// --- TIPI ---

export interface UpsellItem {
  id: string
  name: string
  price: number
  originalPrice?: number
  category: string
  reason: string
  type: 'add-on' | 'upgrade' | 'combo' | 'side'
  popularity: number // 0-100
  margin: number // percent
  imageEmoji: string
}

export interface OrderBumpRule {
  id: string
  name: string
  trigger: string
  suggestion: string
  type: 'add-on' | 'upgrade' | 'combo' | 'side'
  discount: number
  enabled: boolean
  conversionRate: number
  totalRevenue: number
}

// --- KONSTANTE ---

export const typeConfig = {
  'add-on': { label: 'Dodatek', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  'upgrade': { label: 'Nadgradnja', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  'combo': { label: 'Kombo', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  'side': { label: 'Priloga', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
} as const

// --- POMOZNE FUNKCIJE ---

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(amount)
}

// --- PROPS INTERFACI ZA POD-KOMPONENTE ---

export interface KpiCardsProps {
  totalPotentialRevenue: number
  avgConversion: number
  activeRules: number
  totalRules: number
  actualRevenue: number
}

export interface UpsellGridProps {
  suggestions: UpsellItem[]
  addedItems: Set<string>
  onAddSuggestion: (_id: string) => void
}

export interface RulesListProps {
  rules: OrderBumpRule[]
  onToggleRule: (_ruleId: string) => void
}
