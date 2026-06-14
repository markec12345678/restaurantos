// ============================================
// ZALOŽNE MUTACIJE — CRUD, nabava, razknjižba
// ============================================

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'

interface InventoryMutationCallbacks {
  onCloseDialog: () => void
  onClearEditingItem: () => void
  onCloseRestockDialog: () => void
  onCloseWriteOffDialog: () => void
}

export function useInventoryMutations(callbacks: InventoryMutationCallbacks) {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/inventory', { method: 'POST', body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Napaka pri ustvarjanju')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Artikel zaloge ustvarjen')
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
      callbacks.onCloseDialog()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Napaka pri posodobitvi')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Artikel zaloge posodobljen')
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
      callbacks.onCloseDialog()
      callbacks.onClearEditingItem()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/inventory/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka pri brisanju')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Artikel zaloge izbrisan')
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
    },
  })

  const restockMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/inventory/restock', { method: 'POST', body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Napaka') }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Nabava uspešno vnešena')
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.transactions })
      callbacks.onCloseRestockDialog()
    },
    onError: (err) => toast.error(err.message),
  })

  const writeOffMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/inventory/adjust', { method: 'POST', body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Napaka') }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Razknjižba uspešno izvedena')
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.transactions })
      callbacks.onCloseWriteOffDialog()
    },
    onError: (err) => toast.error(err.message),
  })

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    restockMutation,
    writeOffMutation,
  }
}
