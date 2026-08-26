// ============================================
// RECEPT MUTACIJE — Dodaj, uredi, izbriši sestavino
// ============================================

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { AddFormState, EditFormState } from './constants'

interface RecipeMutationCallbacks {
  onCloseAddDialog: () => void
  onCloseEditDialog: () => void
  onClearEditItem: () => void
}

export function useRecipeMutations(callbacks: RecipeMutationCallbacks) {
  const queryClient = useQueryClient()

  const addMutation = useMutation({
    mutationFn: async (data: AddFormState) => {
      const res = await authFetch('/api/recipes', {
        method: 'POST',
        body: JSON.stringify({
          menuItemId: data.menuItemId,
          inventoryItemId: data.inventoryItemId,
          quantityPerServing: parseFloat(data.quantityPerServing) || 0,
          unit: data.unit,
          notes: data.notes,
        }),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Sestavina dodana')
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all })
      callbacks.onCloseAddDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const editMutation = useMutation({
    mutationFn: async (data: { id: string } & EditFormState) => {
      const res = await authFetch('/api/recipes', {
        method: 'PUT',
        body: JSON.stringify({
          id: data.id,
          quantityPerServing: parseFloat(data.quantityPerServing) || 0,
          unit: data.unit,
          notes: data.notes,
        }),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Sestavina posodobljena')
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all })
      callbacks.onCloseEditDialog()
      callbacks.onClearEditItem()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/recipes?id=${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Sestavina odstranjena')
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all })
    },
  })

  return {
    addMutation,
    editMutation,
    deleteMutation,
  }
}
