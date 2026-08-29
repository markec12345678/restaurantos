'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { RecipeItemData, MenuItemData, InventoryData } from '../constants'

// ============================================
// QUERIES — Poizvedbe za recepte, menije, zalogo
// ============================================

export function useRecipeQueries() {
  const { data: recipes } = useQuery<RecipeItemData[]>({
    queryKey: queryKeys.recipes.all,
    queryFn: async () => {
      const res = await authFetch('/api/recipes')
      if (!res.ok) return []
      const json = await res.json()
      return Array.isArray(json) ? json : (json.recipes ?? json.items ?? [])
    },
  })

  const { data: menuItems } = useQuery<MenuItemData[]>({
    queryKey: queryKeys.menuItems.all,
    queryFn: async () => {
      const res = await authFetch('/api/menu-items')
      if (!res.ok) return []
      const json = await res.json()
      return Array.isArray(json) ? json : (json.menuItems ?? json.items ?? [])
    },
  })

  const { data: inventoryItems } = useQuery<InventoryData[]>({
    queryKey: queryKeys.inventory.all,
    queryFn: async () => {
      const res = await authFetch('/api/inventory')
      if (!res.ok) return []
      const json = await res.json()
      return Array.isArray(json) ? json : (json.items ?? [])
    },
  })

  // FIX TypeError: r is not iterable — inventoryItems je lahko objekt (API vrača {items:[...]})
  // [...inventoryItems] crash-a če inventoryItems ni iterabilen
  const sortedInventoryItems = useMemo(() => {
    const arr = Array.isArray(inventoryItems) ? inventoryItems : []
    return [...arr].sort((a, b) => a.name.localeCompare(b.name))
  }, [inventoryItems])

  return { recipes, menuItems, inventoryItems, sortedInventoryItems }
}
