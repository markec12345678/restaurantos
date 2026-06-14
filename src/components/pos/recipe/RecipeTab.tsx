'use client'

import { memo } from 'react'
import type { RecipeItemData, MenuItemData, RecipeGroups } from './constants'
import { MenuItemList } from './MenuItemList'
import { RecipeDetail } from './RecipeDetail'

// ============================================
// TIPI PROPS
// ============================================
interface RecipeTabProps {
  /** Skupine receptov po menijih */
  recipeGroups: RecipeGroups
  /** Iskalni niz */
  search: string
  /** Posodobi iskalni niz */
  onSearchChange: (_value: string) => void
  /** ID izbranega meni artikla */
  selectedMenuItemId: string
  /** Posodobi izbrani meni artikel */
  onSelectedMenuItemIdChange: (_id: string) => void
  /** Podatki o izbranem artiklu */
  selectedItem: MenuItemData | null
  /** Recepti za izbrani artikel */
  selectedRecipes: RecipeItemData[]
  /** Skupni strošek na porcijo za izbrani artikel */
  selectedTotalCost: number
  /** Odpri dialog za dodajanje sestavine */
  onOpenAddDialog: (_menuItemId?: string) => void
  /** Odpri dialog za urejanje sestavine */
  onOpenEditDialog: (_item: RecipeItemData) => void
  /** Izbriši sestavino */
  onDeleteRecipe: (_id: string) => void
}

// ============================================
// GLAVNI TAB: RECEPTI PO JEDEH
// ============================================
export const RecipeTab = memo(function RecipeTab(props: RecipeTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-280px)]">
      {/* Levo: seznam meni artiklov */}
      <MenuItemList
        recipeGroups={props.recipeGroups}
        search={props.search}
        selectedMenuItemId={props.selectedMenuItemId}
        onSearchChange={props.onSearchChange}
        onSelectedMenuItemIdChange={props.onSelectedMenuItemIdChange}
      />

      {/* Desno: podrobnosti recepta */}
      <RecipeDetail
        selectedItem={props.selectedItem}
        selectedRecipes={props.selectedRecipes}
        selectedTotalCost={props.selectedTotalCost}
        onOpenAddDialog={props.onOpenAddDialog}
        onOpenEditDialog={props.onOpenEditDialog}
        onDeleteRecipe={props.onDeleteRecipe}
      />
    </div>
  )
})
