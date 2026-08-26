'use client'

import { useRecipeState } from './useRecipeState'
import { useRecipeQueries } from './useRecipeQueries'
import { useRecipeComputations } from './useRecipeComputations'
import { useRecipeHandlers } from './useRecipeHandlers'

// ============================================
// HOOK: Upravljanje receptov
// Združuje poizvedbe, izračune in handlerje
// ============================================

export function useRecipeManager() {
  const state = useRecipeState()
  const queries = useRecipeQueries()
  const computations = useRecipeComputations(
    queries.recipes,
    queries.menuItems,
    state.selectedMenuItemId,
    state.filterMenu,
    state.search,
  )
  const handlers = useRecipeHandlers(
    state.selectedMenuItemId,
    state.addForm,
    state.setAddDialogOpen,
    state.setEditDialogOpen,
    state.setAddForm,
    state.setEditItem,
    state.setEditForm,
  )

  return {
    // Stanja
    activeTab: state.activeTab, setActiveTab: state.setActiveTab,
    selectedMenuItemId: state.selectedMenuItemId, setSelectedMenuItemId: state.setSelectedMenuItemId,
    search: state.search, setSearch: state.setSearch,
    filterMenu: state.filterMenu, setFilterMenu: state.setFilterMenu,
    addDialogOpen: state.addDialogOpen, setAddDialogOpen: state.setAddDialogOpen,
    addForm: state.addForm, setAddForm: state.setAddForm,
    editDialogOpen: state.editDialogOpen, setEditDialogOpen: state.setEditDialogOpen,
    editItem: state.editItem, setEditItem: state.setEditItem,
    editForm: state.editForm, setEditForm: state.setEditForm,

    // Podatki
    recipes: queries.recipes, menuItems: queries.menuItems, inventoryItems: queries.inventoryItems, sortedInventoryItems: queries.sortedInventoryItems,

    // Izračuni
    recipeGroups: computations.recipeGroups,
    filteredMarginData: computations.filteredMarginData, marginStats: computations.marginStats,
    selectedItem: computations.selectedItem, selectedRecipes: computations.selectedRecipes, selectedTotalCost: computations.selectedTotalCost,

    // Mutacije
    addMutation: handlers.addMutation, editMutation: handlers.editMutation, deleteMutation: handlers.deleteMutation,

    // Handlerji
    openAddDialog: handlers.openAddDialog, openEditDialog: handlers.openEditDialog,
  }
}
