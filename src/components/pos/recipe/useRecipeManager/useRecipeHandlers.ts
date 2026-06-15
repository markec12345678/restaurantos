'use client'

import { useRecipeMutations } from '../useRecipeMutations'
import type { RecipeItemData, AddFormState, EditFormState } from '../constants'

// ============================================
// HANDLERJI — Dialogi in akcije za recepte
// ============================================

export function useRecipeHandlers(
  selectedMenuItemId: string,
  addForm: AddFormState,
  setAddDialogOpen: (_open: boolean) => void,
  setEditDialogOpen: (_open: boolean) => void,
  setAddForm: (_form: AddFormState) => void,
  setEditItem: (_item: RecipeItemData | null) => void,
  setEditForm: (_form: EditFormState) => void,
) {
  const { addMutation, editMutation, deleteMutation } = useRecipeMutations({
    onCloseAddDialog: () => setAddDialogOpen(false),
    onCloseEditDialog: () => setEditDialogOpen(false),
    onClearEditItem: () => setEditItem(null),
  })

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
    addMutation,
    editMutation,
    deleteMutation,
    openAddDialog,
    openEditDialog,
  }
}
