// ============================================
// INTEGRACIJSKE MUTACIJE — CRUD + test + sinhronizacija
// ============================================

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'

interface MutationCallbacks {
  /** Zapri dialog po uspehu */
  onCloseDialog: () => void
  /** Ponastavi urejanje */
  onClearEdit: () => void
  /** Zapri brisanje dialog */
  onCloseDelete: () => void
  /** Ponastavi brisanje target */
  onClearDeleteTarget: () => void
}

export function useIntegrationMutations(callbacks: MutationCallbacks) {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/integrations', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Integracija uspešno ustvarjena')
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all })
      callbacks.onCloseDialog()
    },
    onError: () => toast.error('Napaka pri ustvarjanju integracije'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/integrations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Integracija uspešno posodobljena')
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all })
      callbacks.onCloseDialog()
      callbacks.onClearEdit()
    },
    onError: () => toast.error('Napaka pri posodabljanju integracije'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/integrations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Integracija uspešno izbrisana')
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all })
      callbacks.onCloseDelete()
      callbacks.onClearDeleteTarget()
    },
    onError: () => toast.error('Napaka pri brisanju integracije'),
  })

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/integrations/${id}/test`, { method: 'POST' })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: (data: { status: string; durationMs: number; error?: string; statusCode?: number }) => {
      if (data.status === 'connected') {
        toast.success('Povezava uspešna', { description: `Odziv v ${data.durationMs}ms` })
      } else {
        toast.error('Povezava ni uspela', { description: data.error || `HTTP ${data.statusCode}` })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all })
    },
    onError: () => toast.error('Napaka pri testiranju povezave'),
  })

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/integrations/${id}/sync`, { method: 'POST' })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: (data: { status: string; durationMs: number; error?: string }) => {
      if (data.status === 'success') {
        toast.success('Sinhronizacija uspešna', { description: `Trajanje: ${data.durationMs}ms` })
      } else {
        toast.error('Sinhronizacija ni uspela', { description: data.error })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all })
    },
    onError: () => toast.error('Napaka pri sinhronizaciji'),
  })

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    testMutation,
    syncMutation,
  }
}
