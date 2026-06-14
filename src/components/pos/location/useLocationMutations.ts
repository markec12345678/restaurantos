'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { LocationFormRow, DeliveryZoneFormRow } from '@/lib/types'

// ============================================
// HOOK: Mutacije za lokacije in cone dostave
// ============================================

interface UseLocationMutationsCallbacks {
  onHideForm: () => void
  onResetForm: () => void
  onHideZoneForm: () => void
  onResetZoneForm: () => void
}

export function useLocationMutations({
  onHideForm,
  onResetForm,
  onHideZoneForm,
  onResetZoneForm,
}: UseLocationMutationsCallbacks) {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async (data: LocationFormRow) => {
      const res = await authFetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri ustvarjanju')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.locations.all })
      onHideForm()
      onResetForm()
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await authFetch(`/api/locations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.locations.all }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/locations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka pri brisanju')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.locations.all }),
  })

  const createZoneMutation = useMutation({
    mutationFn: async (data: DeliveryZoneFormRow) => {
      const res = await authFetch('/api/delivery-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.zones })
      onHideZoneForm()
      onResetZoneForm()
    },
  })

  const deleteZoneMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/delivery-zones/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.delivery.zones }),
  })

  return {
    createMutation,
    toggleActiveMutation,
    deleteMutation,
    createZoneMutation,
    deleteZoneMutation,
  }
}
