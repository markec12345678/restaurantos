'use client'

import { useMemo } from 'react'
import type { RecipeItemData, MenuItemData } from '../constants'

// ============================================
// IZRAČUNI — Skupine receptov, marže, izbire
// ============================================

export function useRecipeComputations(
  recipes: RecipeItemData[] | undefined,
  menuItems: MenuItemData[] | undefined,
  selectedMenuItemId: string,
  filterMenu: string,
  search: string,
) {
  // Skupine receptov po menijih
  const recipeGroups = useMemo(() => {
    // FIX: Array.isArray guard — prepreči .filter crash če bi query vrnil objekt
    const recipesArr = Array.isArray(recipes) ? recipes : []
    const menuItemsArr = Array.isArray(menuItems) ? menuItems : []
    if (recipesArr.length === 0 && menuItemsArr.length === 0) return { hrana: [], pijaca: [] }
    const hranaItems = menuItemsArr.filter(mi => mi.category?.menu?.name === 'Hrana')
    const pijacaItems = menuItemsArr.filter(mi => mi.category?.menu?.name === 'Pijaca')

    const groupItems = (items: MenuItemData[]) => items.map(mi => {
      const itemRecipes = recipesArr.filter(r => r.menuItemId === mi.id)
      const totalCost = itemRecipes.reduce((sum, r) => sum + r.costPerServing, 0)
      // Fallback na inventory costPerServing ce ni recepta
      const fallbackCost = mi.inventory?.costPerServing || 0
      const effectiveCost = totalCost > 0 ? totalCost : fallbackCost
      return {
        ...mi,
        recipes: itemRecipes,
        totalCost: effectiveCost,
        hasRecipe: itemRecipes.length > 0,
      }
    })

    return {
      hrana: groupItems(hranaItems),
      pijaca: groupItems(pijacaItems),
    }
  }, [recipes, menuItems])

  // Pregled marz - vsi artikli
  const marginData = useMemo(() => {
    // FIX: Array.isArray guard
    const recipesArr = Array.isArray(recipes) ? recipes : []
    const menuItemsArr = Array.isArray(menuItems) ? menuItems : []
    if (menuItemsArr.length === 0) return []
    return menuItemsArr.map(mi => {
      const itemRecipes = recipesArr.filter(r => r.menuItemId === mi.id)
      const recipeCost = itemRecipes.reduce((sum, r) => sum + r.costPerServing, 0)
      const fallbackCost = mi.inventory?.costPerServing || 0
      const cost = recipeCost > 0 ? recipeCost : fallbackCost
      const price = mi.price
      const marginEur = price - cost
      const marginPct = price > 0 ? (marginEur / price) * 100 : 0
      return {
        id: mi.id,
        name: mi.name,
        price,
        cost,
        marginEur,
        marginPct,
        hasRecipe: itemRecipes.length > 0 || !!mi.inventory,
        recipeCount: itemRecipes.length,
        category: mi.category?.name || '',
        menu: mi.category?.menu?.name || '',
      }
    })
  }, [menuItems, recipes])

  const filteredMarginData = useMemo(() => {
    let data = marginData
    if (filterMenu !== 'all') data = data.filter(d => d.menu === filterMenu)
    if (search) data = data.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
    return data.sort((a, b) => a.marginPct - b.marginPct)
  }, [marginData, filterMenu, search])

  const marginStats = useMemo(() => {
    if (filteredMarginData.length === 0) return null
    const withCost = filteredMarginData.filter(d => d.cost > 0)
    const avgMargin = withCost.length > 0 ? withCost.reduce((s, d) => s + d.marginPct, 0) / withCost.length : 0
    const below40 = filteredMarginData.filter(d => d.marginPct < 40 && d.cost > 0).length
    const noRecipe = filteredMarginData.filter(d => !d.hasRecipe).length
    const totalItems = filteredMarginData.length
    return { avgMargin, below40, noRecipe, totalItems, withCostCount: withCost.length }
  }, [filteredMarginData])

  // Izbran meni artikel
  const selectedItem = useMemo(() => {
    // FIX: Array.isArray guard
    if (!selectedMenuItemId || !Array.isArray(menuItems)) return null
    return menuItems.find(mi => mi.id === selectedMenuItemId)
  }, [selectedMenuItemId, menuItems])

  const selectedRecipes = useMemo(() => {
    // FIX: Array.isArray guard
    if (!selectedMenuItemId || !Array.isArray(recipes)) return []
    return recipes.filter(r => r.menuItemId === selectedMenuItemId)
  }, [selectedMenuItemId, recipes])

  const selectedTotalCost = (Array.isArray(selectedRecipes) ? selectedRecipes : []).reduce((sum, r) => sum + r.costPerServing, 0)

  return {
    recipeGroups,
    filteredMarginData,
    marginStats,
    selectedItem,
    selectedRecipes,
    selectedTotalCost,
  }
}
