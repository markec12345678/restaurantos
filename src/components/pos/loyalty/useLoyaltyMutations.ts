'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'

// ============================================
// HOOK: Mutacije za zvestobni program
// ============================================

interface UseLoyaltyMutationsCallbacks {
  onCloseDialog: () => void
  onClearEditingAccount: () => void
  onCloseAdjustDialog: () => void
  onClearAdjustAccount: () => void
  onResetAdjustData: () => void
  onCloseDeleteDialog: () => void
  onClearDeleteTarget: () => void
}

export function useLoyaltyMutations({
  onCloseDialog,
  onClearEditingAccount,
  onCloseAdjustDialog,
  onClearAdjustAccount,
  onResetAdjustData,
  onCloseDeleteDialog,
  onClearDeleteTarget,
}: UseLoyaltyMutationsCallbacks) {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/loyalty', { method: 'POST', body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Napaka pri ustvarjanju računa')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Zvestobni račun uspešno ustvarjen')
      queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.all })
      onCloseDialog()
    },
    onError: () => { toast.error('Napaka pri ustvarjanju zvestobnega računa') },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/loyalty/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Napaka pri posodabljanju računa')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Zvestobni račun uspešno posodobljen')
      queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.all })
      onCloseDialog()
      onClearEditingAccount()
    },
    onError: () => { toast.error('Napaka pri posodabljanju zvestobnega računa') },
  })

  const adjustMutation = useMutation({
    mutationFn: async ({ id, transaction, ...data }: { id: string; transaction: Record<string, unknown> } & Record<string, unknown>) => {
      const res = await authFetch(`/api/loyalty/${id}`, { method: 'PUT', body: JSON.stringify({ ...data, transaction }) })
      if (!res.ok) throw new Error('Napaka pri prilagajanju točk')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Točke uspešno prilagojene')
      queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.all })
      onCloseAdjustDialog()
      onClearAdjustAccount()
      onResetAdjustData()
    },
    onError: () => { toast.error('Napaka pri prilagajanju točk') },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/loyalty/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka pri brisanju računa')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Zvestobni račun uspešno izbrisan')
      queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.all })
      onCloseDeleteDialog()
      onClearDeleteTarget()
    },
    onError: () => { toast.error('Napaka pri brisanju zvestobnega računa') },
  })

  return {
    createMutation,
    updateMutation,
    adjustMutation,
    deleteMutation,
  }
}
