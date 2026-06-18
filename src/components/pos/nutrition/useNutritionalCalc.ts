'use client'

// ============================================
// HOOK: Nutritivni izračuni in filtriranje
// Izvlečeno iz NutritionalCalculator.tsx
// ============================================

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { MenuItemData } from './constants'

export function useNutritionalCalc() {
  const [search, setSearch] = useState('')
  const [allergenFilter, setAllergenFilter] = useState<string | null>(null)

  const { data: menuItems, isLoading } = useQuery({
    queryKey: queryKeys.menuItemNutrition.all,
    queryFn: async () => {
      const res = await authFetch('/api/menu-items?limit=500')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      const data = await res.json()
      return Array.isArray(data) ? data : (data.menuItems || data.items || [])
    },
  })

  const items = (Array.isArray(menuItems) ? menuItems : []) as MenuItemData[]

  const filtered = useMemo(() => {
    let result = items

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.category?.name?.toLowerCase().includes(q))
    }

    if (allergenFilter) {
      result = result.filter(i => {
        const allergens = i.allergens ? i.allergens.split(',').map(a => a.trim()) : []
        return allergens.includes(allergenFilter)
      })
    }

    return result
  }, [items, search, allergenFilter])

  // Statistike
  const stats = useMemo(() => {
    const withAllergens = items.filter(i => i.allergens && i.allergens.length > 0)
    const allergenCounts: Record<string, number> = {}
    for (const item of withAllergens) {
      const allergens = item.allergens.split(',').map(a => a.trim())
      for (const a of allergens) {
        allergenCounts[a] = (allergenCounts[a] || 0) + 1
      }
    }
    return { withAllergens: withAllergens.length, total: items.length, allergenCounts }
  }, [items])

  return {
    search,
    setSearch,
    allergenFilter,
    setAllergenFilter,
    items,
    filtered,
    stats,
    isLoading,
  }
}
