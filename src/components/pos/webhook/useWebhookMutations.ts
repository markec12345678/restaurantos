// ============================================
// WEBHOOK MUTACIJE — CRUD + test
// ============================================

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'

interface WebhookMutationCallbacks {
  onCloseDialog: () => void
  onClearEditingItem: () => void
  onCloseDeleteDialog: () => void
  onClearDeleteTarget: () => void
}

export function useWebhookMutations(callbacks: WebhookMutationCallbacks) {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/webhooks', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Spletna kljuka uspešno ustvarjena')
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all })
      callbacks.onCloseDialog()
    },
    onError: () => toast.error('Napaka pri ustvarjanju spletne kljuke'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/webhooks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Spletna kljuka uspešno posodobljena')
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all })
      callbacks.onCloseDialog()
      callbacks.onClearEditingItem()
    },
    onError: () => toast.error('Napaka pri posodabljanju spletne kljuke'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/webhooks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Spletna kljuka uspešno izbrisana')
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all })
      callbacks.onCloseDeleteDialog()
      callbacks.onClearDeleteTarget()
    },
    onError: () => toast.error('Napaka pri brisanju spletne kljuke'),
  })

  return {
    createMutation,
    updateMutation,
    deleteMutation,
  }
}
