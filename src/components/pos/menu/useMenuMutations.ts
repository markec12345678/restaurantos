'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'

// ============================================
// HOOK: Mutacije za menije, artikle in kategorije
// ============================================

interface UseMenuMutationsCallbacks {
  onCloseItemDialog: () => void
  onClearEditingItem: () => void
  onCloseCatDialog: () => void
  onCloseMenuDialog: () => void
}

export function useMenuMutations({
  onCloseItemDialog,
  onClearEditingItem,
  onCloseCatDialog,
  onCloseMenuDialog,
}: UseMenuMutationsCallbacks) {
  const queryClient = useQueryClient()

  // Ustvari meni
  const createMenuMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/menus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri ustvarjanju menija') }
      return res.json()
    },
    onSuccess: () => { toast.success('Meni ustvarjen'); queryClient.invalidateQueries({ queryKey: queryKeys.menus.all }); onCloseMenuDialog() },
    onError: (err: Error) => { toast.error(err.message || 'Napaka pri ustvarjanju menija') },
  })

  // Ustvari artikel
  const createItemMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/menu-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri ustvarjanju artikla') }
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel ustvarjen'); queryClient.invalidateQueries({ queryKey: queryKeys.menuItems.all }); onCloseItemDialog() },
    onError: (err: Error) => { toast.error(err.message || 'Napaka pri ustvarjanju artikla') },
  })

  // Posodobi artikel
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/menu-items/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri posodabljanju artikla') }
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel posodobljen'); queryClient.invalidateQueries({ queryKey: queryKeys.menuItems.all }); onCloseItemDialog(); onClearEditingItem() },
    onError: (err: Error) => { toast.error(err.message || 'Napaka pri posodabljanju artikla') },
  })

  // Izbriši artikel
  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/menu-items/${id}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri brisanju artikla') }
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel izbrisan'); queryClient.invalidateQueries({ queryKey: queryKeys.menuItems.all }) },
    onError: (err: Error) => { toast.error(err.message || 'Napaka pri brisanju artikla') },
  })

  // Preklopi razpoložljivost
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: boolean }) => {
      const res = await authFetch(`/api/menu-items/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isAvailable }) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri spreminjanju razpoložljivosti') }
      return res.json()
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.menuItems.all }) },
    onError: (err: Error) => { toast.error(err.message || 'Napaka pri spreminjanju razpoložljivosti') },
  })

  // Ustvari kategorijo
  const createCatMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri ustvarjanju kategorije') }
      return res.json()
    },
    onSuccess: () => { toast.success('Kategorija ustvarjena'); queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }); onCloseCatDialog() },
  })

  return {
    createMenuMutation,
    createItemMutation,
    updateItemMutation,
    deleteItemMutation,
    toggleAvailabilityMutation,
    createCatMutation,
  }
}
