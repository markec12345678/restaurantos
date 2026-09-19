'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { errorSl } from '@/lib/error-messages'

// ============================================
// HOOK: Mutacije za menije, artikle in kategorije
// ============================================

// RUNDA 68 FIX (MODEL A): seja brez dodeljene lokacije (admin / demo zaposleni
// brez locationId) MORA pri POST /api/menus in /api/modifier-groups podati
// izrecen ?locationId — sicer API vrne 400 "locationId je obvezen". UI ne ve,
// ali seja ima lokacijo, zato PONUDBO vedno pripne prvo aktivno lokacijo;
// če seja lokacijo IMA, jo strežnik vseeno uporabi (scope ima prednost pred
// query parametrom — resolveWriteLocationId: session scope → candidates).
// Vzorec MultiLocationDashboard (?locationId=) je že bil v uporabi za GET-e.
let cachedLocationParam: string | null = null
async function ensureLocationParam(): Promise<string> {
  if (cachedLocationParam !== null) return cachedLocationParam
  try {
    const res = await authFetch('/api/locations')
    if (!res.ok) return (cachedLocationParam = '')
    const json = await res.json()
    const list = Array.isArray(json) ? json : (json.locations ?? [])
    const first = list.find((l: { isActive?: boolean }) => l.isActive !== false) || list[0]
    cachedLocationParam = first?.id ? `?locationId=${first.id}` : ''
  } catch {
    cachedLocationParam = ''
  }
  return cachedLocationParam
}

interface UseMenuMutationsCallbacks {
  onCloseItemDialog: () => void
  onClearEditingItem: () => void
  onCloseCatDialog: () => void
  onCloseMenuDialog: () => void
  onCloseModGroupDialog: () => void
}

export function useMenuMutations({
  onCloseItemDialog,
  onClearEditingItem,
  onCloseCatDialog,
  onCloseMenuDialog,
  onCloseModGroupDialog,
}: UseMenuMutationsCallbacks) {
  const queryClient = useQueryClient()

  // Ustvari meni
  const createMenuMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      // RUNDA 68 FIX: + ?locationId (MODEL A — seja brez lokacije sicer 400)
      const loc = await ensureLocationParam()
      const res = await authFetch(`/api/menus${loc}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri ustvarjanju menija') }
      return res.json()
    },
    onSuccess: () => { toast.success('Meni ustvarjen'); queryClient.invalidateQueries({ queryKey: queryKeys.menus.all }); onCloseMenuDialog() },
    onError: (err: Error) => { toast.error(errorSl(err, 'Napaka pri ustvarjanju menija')) },
  })

  // RUNDA 67: posodobi meni (PUT /api/menus/[id] že obstaja — UI je manjal)
  const updateMenuMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/menus/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri posodabljanju menija') }
      return res.json()
    },
    onSuccess: () => { toast.success('Meni posodobljen'); queryClient.invalidateQueries({ queryKey: queryKeys.menus.all }); onCloseMenuDialog() },
    onError: (err: Error) => { toast.error(errorSl(err, 'Napaka pri posodabljanju menija')) },
  })

  // RUNDA 67: izbriši meni (DELETE z zaščito menu-guard: artikli → 409)
  const deleteMenuMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/menus/${id}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri brisanju menija') }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Meni izbrisan')
      // kaskada: kategorije gredo tudi → invalidiraj OBE poizvedbi
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
    onError: (err: Error) => { toast.error(errorSl(err, 'Napaka pri brisanju menija')) },
  })

  // Ustvari artikel
  const createItemMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/menu-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri ustvarjanju artikla') }
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel ustvarjen'); queryClient.invalidateQueries({ queryKey: queryKeys.menuItems.all }); onCloseItemDialog() },
    onError: (err: Error) => { toast.error(errorSl(err, 'Napaka pri ustvarjanju artikla')) },
  })

  // Posodobi artikel
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/menu-items/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri posodabljanju artikla') }
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel posodobljen'); queryClient.invalidateQueries({ queryKey: queryKeys.menuItems.all }); onCloseItemDialog(); onClearEditingItem() },
    onError: (err: Error) => { toast.error(errorSl(err, 'Napaka pri posodabljanju artikla')) },
  })

  // Izbriši artikel
  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/menu-items/${id}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri brisanju artikla') }
      return res.json()
    },
    onSuccess: () => { toast.success('Artikel izbrisan'); queryClient.invalidateQueries({ queryKey: queryKeys.menuItems.all }) },
    onError: (err: Error) => { toast.error(errorSl(err, 'Napaka pri brisanju artikla')) },
  })

  // Preklopi razpoložljivost
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: boolean }) => {
      const res = await authFetch(`/api/menu-items/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isAvailable }) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri spreminjanju razpoložljivosti') }
      return res.json()
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.menuItems.all }) },
    onError: (err: Error) => { toast.error(errorSl(err, 'Napaka pri spreminjanju razpoložljivosti')) },
  })

  // Ustvari kategorijo
  const createCatMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri ustvarjanju kategorije') }
      return res.json()
    },
    onSuccess: () => { toast.success('Kategorija ustvarjena'); queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }); onCloseCatDialog() },
    onError: (err: Error) => { toast.error(errorSl(err, 'Napaka pri ustvarjanju kategorije')) },
  })

  // RUNDA 66: posodobi kategorijo (PUT /api/categories/[id]) — ime/ikona/barva
  // + premik med meniji (menuId). Toast uspeha + invalidacija kategorij.
  const updateCatMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/categories/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri posodabljanju kategorije') }
      return res.json()
    },
    onSuccess: () => { toast.success('Kategorija posodobljena'); queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }); onCloseCatDialog() },
    onError: (err: Error) => { toast.error(errorSl(err, 'Napaka pri posodabljanju kategorije')) },
  })

  // RUNDA 66: izbriši kategorijo (DELETE /api/categories/[id]) — API blokira
  // brisanje z artikli (409 + slovensko sporočilo iz category-guard).
  const deleteCatMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/categories/${id}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri brisanju kategorije') }
      return res.json()
    },
    onSuccess: () => { toast.success('Kategorija izbrisana'); queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }) },
    onError: (err: Error) => { toast.error(errorSl(err, 'Napaka pri brisanju kategorije')) },
  })

  // RUNDA 68: ustvari skupino dodatkov (POST /api/modifier-groups)
  const createModGroupMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      // RUNDA 68 FIX: + ?locationId (MODEL A — seja brez lokacije sicer 400;
      // ujeto v produkciji E2E te runde!)
      const loc = await ensureLocationParam()
      const res = await authFetch(`/api/modifier-groups${loc}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri ustvarjanju skupine dodatkov') }
      return res.json()
    },
    onSuccess: () => { toast.success('Skupina dodatkov ustvarjena'); queryClient.invalidateQueries({ queryKey: queryKeys.modifierGroups.all }); onCloseModGroupDialog() },
    onError: (err: Error) => { toast.error(errorSl(err, 'Napaka pri ustvarjanju skupine dodatkov')) },
  })

  // RUNDA 68: posodobi skupino dodatkov (PUT /api/modifier-groups/[id] že obstaja — UI je mankal)
  const updateModGroupMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/modifier-groups/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri posodabljanju skupine dodatkov') }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Skupina dodatkov posodobljena')
      // Artikli nosijo vezave na skupine (modifierGroups include) → invalidiraj OBE
      queryClient.invalidateQueries({ queryKey: queryKeys.modifierGroups.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.menuItems.all })
    },
    onError: (err: Error) => { toast.error(errorSl(err, 'Napaka pri posodabljanju skupine dodatkov')) },
  })

  // RUNDA 68: izbriši skupino dodatkov (DELETE z zaščito modifier-guard: pripeti artikli → 409)
  const deleteModGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/modifier-groups/${id}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Napaka pri brisanju skupine dodatkov') }
      return res.json()
    },
    onSuccess: () => { toast.success('Skupina dodatkov izbrisana'); queryClient.invalidateQueries({ queryKey: queryKeys.modifierGroups.all }) },
    onError: (err: Error) => { toast.error(errorSl(err, 'Napaka pri brisanju skupine dodatkov')) },
  })

  return {
    createMenuMutation,
    updateMenuMutation,
    deleteMenuMutation,
    createItemMutation,
    updateItemMutation,
    deleteItemMutation,
    toggleAvailabilityMutation,
    createCatMutation,
    updateCatMutation,
    deleteCatMutation,
    createModGroupMutation,
    updateModGroupMutation,
    deleteModGroupMutation,
  }
}
