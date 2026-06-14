// ============================================
// IZMENE MUTACIJE — CRUD + prijava/odjava ur
// ============================================

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'

interface ShiftMutationCallbacks {
  onCloseShiftDialog: () => void
  onClearEditingShift: () => void
  onCloseDeleteDialog: () => void
  onResetClockInFields: () => void
}

export function useShiftMutations(callbacks: ShiftMutationCallbacks) {
  const queryClient = useQueryClient()

  const createShiftMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/shifts', { method: 'POST', body: JSON.stringify(data) })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Izmena uspešno ustvarjena')
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all })
      callbacks.onCloseShiftDialog()
    },
    onError: () => toast.error('Napaka pri ustvarjanju izmene'),
  })

  const updateShiftMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Izmena uspešno posodobljena')
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all })
      callbacks.onCloseShiftDialog()
      callbacks.onClearEditingShift()
    },
    onError: () => toast.error('Napaka pri posodabljanju izmene'),
  })

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/shifts/${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Izmena uspešno izbrisana')
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all })
      callbacks.onCloseDeleteDialog()
    },
    onError: () => toast.error('Napaka pri brisanju izmene'),
  })

  const clockInMutation = useMutation({
    mutationFn: async (data: { employeeId: string; jobId?: string; type?: string }) => {
      const res = await authFetch('/api/time-entries', { method: 'POST', body: JSON.stringify({ ...data, clockIn: new Date().toISOString() }) })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Uspešno prijavljen')
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      callbacks.onResetClockInFields()
    },
    onError: () => toast.error('Napaka pri prijavi'),
  })

  const clockOutMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/time-entries/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Uspešno odjavljen')
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
    },
    onError: () => toast.error('Napaka pri odjavi'),
  })

  return {
    createShiftMutation,
    updateShiftMutation,
    deleteShiftMutation,
    clockInMutation,
    clockOutMutation,
  }
}
