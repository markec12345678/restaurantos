// ============================================
// TIPI IN KONSTANTE ZA NUTRITIVNI KALKULATOR
// EU 1169/2011 compliance — alergeni in nutritivni podatki
// ============================================

import type { LucideIcon } from 'lucide-react'
import { Wheat, Fish, Egg, CircleDot, Salad, Milk, Apple, Siren, Soup } from 'lucide-react'

// Podatki o meni artiklu za nutritivni kalkulator
export interface MenuItemData {
  id: string
  name: string
  price: number
  image: string
  allergens: string
  category: { name: string }
  orderItems: { id: string }[]
}

// EU alergeni (Regulation 1169/2011 Annex II)
export const ALLERGEN_MAP: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  '1': { label: 'Žita (gluten)', icon: Wheat, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  '2': { label: 'Raki', icon: Fish, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  '3': { label: 'Jajca', icon: Egg, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  '4': { label: 'Ribe', icon: Fish, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  '5': { label: 'Arašidi', icon: CircleDot, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  '6': { label: 'Soja', icon: Salad, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  '7': { label: 'Mleko', icon: Milk, color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400' },
  '8': { label: 'Oreški', icon: Apple, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  '9': { label: 'Celer', icon: Salad, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  '10': { label: 'Gorčica', icon: Siren, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  '11': { label: 'Sezam', icon: CircleDot, color: 'bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-400' },
  '12': { label: 'Žveplov dioksid', icon: Siren, color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400' },
  '13': { label: 'Volčji bob', icon: Soup, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  '14': { label: 'Mehkužci', icon: Fish, color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' },
}
