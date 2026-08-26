'use client'
// ============================================
// POD-HOOK: Mutacije za vizualni tloris
// Ustvari in izbriši mize
// ============================================

import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'

interface UseFloorPlanMutationsCallbacks {
  onDialogClose: () => void
  onClearSelectedTableId: () => void
}

export function useFloorPlanMutations({
  onDialogClose,
  onClearSelectedTableId,
}: UseFloorPlanMutationsCallbacks) {
  const queryClient = useQueryClient()

  // Ustvari mizo
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/tables', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Miza ustvarjena')
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      onDialogClose()
    },
  })

  // Izbriši mizo
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/tables/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Miza izbrisana')
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
    },
  })

  const handleDeleteTable = useCallback((id: string) => {
    deleteMutation.mutate(id)
    onClearSelectedTableId()
  }, [deleteMutation, onClearSelectedTableId])

  return {
    createMutation,
    deleteMutation,
    handleDeleteTable,
  }
}
