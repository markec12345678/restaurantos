'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type ShiftType, statusLabels } from '../constants'

// ============================================
// HOOK: Mutacije in handlerji za razpored
// ============================================

export function useSchedulerMutations() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<ShiftType | null>(null)
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copySourceDate, setCopySourceDate] = useState('')

  const saveMutation = useMutation({
    mutationFn: async (formData: Record<string, unknown>) => {
      if (editingShift) {
        const res = await authFetch(`/api/shifts/${editingShift.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        })
        if (!res.ok) throw new Error('Napaka pri posodabljanju')
        return res.json()
      } else {
        const res = await authFetch('/api/shifts', {
          method: 'POST',
          body: JSON.stringify(formData),
        })
        if (!res.ok) throw new Error('Napaka pri ustvarjanju')
        return res.json()
      }
    },
    onSuccess: () => {
      toast.success(editingShift ? 'Izmena posodobljena' : 'Izmena ustvarjena')
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.schedule })
      setDialogOpen(false)
      setEditingShift(null)
    },
    onError: () => toast.error('Napaka pri shranjevanju'),
  })
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/shifts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Izmena izbrisana')
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.schedule })
    },
  })
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await authFetch(`/api/shifts/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: (_, vars) => {
      toast.success(`Status: ${statusLabels[vars.status]}`)
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.schedule })
    },
  })
  const copyWeekMutation = useMutation({
    mutationFn: async ({ sourceDate, targetWeekStart }: { sourceDate: string; targetWeekStart: string }) => {
      const res = await authFetch('/api/shifts', {
        method: 'POST',
        body: JSON.stringify({ action: 'copy_week', sourceDate, targetWeekStart }),
      })
      if (!res.ok) throw new Error('Napaka pri kopiranju')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Teden kopiran!')
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.schedule })
      setCopyDialogOpen(false)
    },
  })

  return {
    dialogOpen, setDialogOpen,
    editingShift, setEditingShift,
    copyDialogOpen, setCopyDialogOpen,
    copySourceDate, setCopySourceDate,
    saveMutation, deleteMutation, statusMutation, copyWeekMutation,
  }
}
