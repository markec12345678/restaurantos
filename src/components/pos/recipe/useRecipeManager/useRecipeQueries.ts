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
      return res.json()
    },
  })

  const { data: menuItems } = useQuery<MenuItemData[]>({
    queryKey: queryKeys.menuItems.all,
    queryFn: async () => {
      const res = await authFetch('/api/menu-items')
      return res.json()
    },
  })

  const { data: inventoryItems } = useQuery<InventoryData[]>({
    queryKey: queryKeys.inventory.all,
    queryFn: async () => {
      const res = await authFetch('/api/inventory')
      return res.json()
    },
  })

  const sortedInventoryItems = useMemo(() => inventoryItems ? [...inventoryItems].sort((a, b) => a.name.localeCompare(b.name)) : [], [inventoryItems])

  return { recipes, menuItems, inventoryItems, sortedInventoryItems }
}
