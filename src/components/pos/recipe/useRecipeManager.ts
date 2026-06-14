'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { RecipeItemData, AddFormState, EditFormState, MenuItemData, InventoryData } from './constants'
import { useRecipeMutations } from './useRecipeMutations'

// ============================================
// HOOK: Upravljanje receptov
// Združuje poizvedbe, izračune in handlerje
// ============================================

export function useRecipeManager() {
  const [activeTab, setActiveTab] = useState('recipes')
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [filterMenu, setFilterMenu] = useState('all')

  // Dodajanje sestavine dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addForm, setAddForm] = useState<AddFormState>({
    menuItemId: '', inventoryItemId: '', quantityPerServing: '', unit: '', notes: ''
  })

  // Urejanje sestavine dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<RecipeItemData | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>({ quantityPerServing: '', unit: '', notes: '' })

  // ============================================
  // QUERIES
  // ============================================
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

  // ============================================
  // MUTATIONS
  // ============================================
  const { addMutation, editMutation, deleteMutation } = useRecipeMutations({
    onCloseAddDialog: () => setAddDialogOpen(false),
    onCloseEditDialog: () => setEditDialogOpen(false),
    onClearEditItem: () => setEditItem(null),
  })

  // ============================================
  // IZRAČUNI
  // ============================================

  // Skupine receptov po menijih
  const recipeGroups = useMemo(() => {
    if (!recipes || !menuItems) return { hrana: [], pijaca: [] }
    const hranaItems = menuItems.filter(mi => mi.category?.menu?.name === 'Hrana')
    const pijacaItems = menuItems.filter(mi => mi.category?.menu?.name === 'Pijaca')

    const groupItems = (items: MenuItemData[]) => items.map(mi => {
      const itemRecipes = recipes.filter(r => r.menuItemId === mi.id)
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
    if (!menuItems || !recipes) return []
    return menuItems.map(mi => {
      const itemRecipes = recipes.filter(r => r.menuItemId === mi.id)
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
    if (!selectedMenuItemId || !menuItems) return null
    return menuItems.find(mi => mi.id === selectedMenuItemId)
  }, [selectedMenuItemId, menuItems])

  const selectedRecipes = useMemo(() => {
    if (!selectedMenuItemId || !recipes) return []
    return recipes.filter(r => r.menuItemId === selectedMenuItemId)
  }, [selectedMenuItemId, recipes])

  const selectedTotalCost = selectedRecipes.reduce((sum, r) => sum + r.costPerServing, 0)

  // ============================================
  // HANDLERJI
  // ============================================
  const openAddDialog = (menuItemId?: string) => {
    setAddForm({
      menuItemId: menuItemId || selectedMenuItemId || '',
      inventoryItemId: '',
      quantityPerServing: '',
      unit: '',
      notes: '',
    })
    setAddDialogOpen(true)
  }

  const openEditDialog = (item: RecipeItemData) => {
    setEditItem(item)
    setEditForm({
      quantityPerServing: String(item.quantityPerServing),
      unit: item.unit,
      notes: item.notes,
    })
    setEditDialogOpen(true)
  }

  return {
    // Stanja
    activeTab, setActiveTab,
    selectedMenuItemId, setSelectedMenuItemId,
    search, setSearch,
    filterMenu, setFilterMenu,
    addDialogOpen, setAddDialogOpen,
    addForm, setAddForm,
    editDialogOpen, setEditDialogOpen,
    editItem, setEditItem,
    editForm, setEditForm,

    // Podatki
    recipes, menuItems, inventoryItems, sortedInventoryItems,

    // Izračuni
    recipeGroups,
    filteredMarginData, marginStats,
    selectedItem, selectedRecipes, selectedTotalCost,

    // Mutacije
    addMutation, editMutation, deleteMutation,

    // Handlerji
    openAddDialog, openEditDialog,
  }
}
