// ============================================
// TIPI IN KONSTANTE ZA AI PRIPOROČILA
// ============================================

import type { LucideIcon } from 'lucide-react'
import { ThumbsUp, DollarSign, CalendarDays, ArrowUpRight, TrendingUp } from 'lucide-react'

export interface MenuItemData {
  id: string
  name: string
  price: number
  image: string
  vatRate: number
  allergens: string
  category: { name: string; menu: { name: string } }
  salesCategory?: { name: string }
  orderItems: { id: string; quantity: number; createdAt: string }[]
}

export interface Recommendation {
  item: MenuItemData
  score: number
  reasons: string[]
  category: 'popular' | 'profitable' | 'seasonal' | 'upsell' | 'trending'
}

export const CATEGORY_CONFIG: Record<string, { label: string; icon: LucideIcon; color: string; desc: string }> = {
  popular: { label: 'Popularne', icon: ThumbsUp, color: 'text-green-600 bg-green-100 dark:bg-green-900/30', desc: 'Najbolj prodajane jedi' },
  profitable: { label: 'Profitabilne', icon: DollarSign, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30', desc: 'Najvišja marža' },
  seasonal: { label: 'Sezonske', icon: CalendarDays, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30', desc: 'Glede na sezono/uro' },
  upsell: { label: 'Upsell', icon: ArrowUpRight, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30', desc: 'Priložnost za večjo prodajo' },
  trending: { label: 'Trendi', icon: TrendingUp, color: 'text-red-600 bg-red-100 dark:bg-red-900/30', desc: 'Rastoča prodaja' },
}
