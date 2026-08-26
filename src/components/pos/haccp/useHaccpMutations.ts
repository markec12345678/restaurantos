// ============================================
// HOOK — useHaccpMutations
// Mutacije za HACCP vnose (create, update, delete)
// ============================================

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'

export interface HaccpMutationSetters {
  setDialogOpen: (_open: boolean) => void
  setEditingEntry: (_entry: null) => void
  setDeleteDialogOpen: (_open: boolean) => void
  setDeleteTarget: (_target: null) => void
}

export function useHaccpMutations(setters: HaccpMutationSetters) {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/haccp', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('HACCP vnos uspešno dodan')
      queryClient.invalidateQueries({ queryKey: queryKeys.haccp.all })
      setters.setDialogOpen(false)
    },
    onError: () => {
      toast.error('Napaka pri dodajanju HACCP vnosa')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch('/api/haccp', {
        method: 'PUT',
        body: JSON.stringify({ id, ...data }),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('HACCP vnos uspešno posodobljen')
      queryClient.invalidateQueries({ queryKey: queryKeys.haccp.all })
      setters.setDialogOpen(false)
      setters.setEditingEntry(null)
    },
    onError: () => {
      toast.error('Napaka pri posodabljanju HACCP vnosa')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/haccp?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('HACCP vnos uspešno izbrisan')
      queryClient.invalidateQueries({ queryKey: queryKeys.haccp.all })
      setters.setDeleteDialogOpen(false)
      setters.setDeleteTarget(null)
    },
    onError: () => {
      toast.error('Napaka pri brisanju HACCP vnosa')
    },
  })

  return { createMutation, updateMutation, deleteMutation }
}
