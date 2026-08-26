'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { toast } from 'sonner'
import type { SupplierType } from './constants'

// ============================================
// Mutacije za dobavitelje in nabavna naročila
// ============================================

export interface UseSupplierMutationsParams {
  editingSupplier: SupplierType | null
  setDialogOpen: (_: boolean) => void
  setEditingSupplier: (_: SupplierType | null) => void
  setPoDialogOpen: (_: boolean) => void
}

export function useSupplierMutations({
  editingSupplier,
  setDialogOpen,
  setEditingSupplier,
  setPoDialogOpen,
}: UseSupplierMutationsParams) {
  const queryClient = useQueryClient()

  const saveSupplierMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (editingSupplier) {
        const res = await authFetch(`/api/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Napaka pri posodabljanju')
        return res.json()
      } else {
        const res = await authFetch('/api/suppliers', {
          method: 'POST',
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Napaka pri ustvarjanju')
        return res.json()
      }
    },
    onSuccess: () => {
      toast.success(editingSupplier ? 'Dobavitelj posodobljen' : 'Dobavitelj ustvarjen')
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all })
      setDialogOpen(false)
      setEditingSupplier(null)
    },
    onError: () => toast.error('Napaka pri shranjevanju'),
  })

  const createPOMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/purchase-orders', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri ustvarjanju naročila')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Nabavno naročilo ustvarjeno')
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
      setPoDialogOpen(false)
    },
    onError: () => toast.error('Napaka pri ustvarjanju naročila'),
  })

  return { saveSupplierMutation, createPOMutation }
}
