'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { toastTierUpgrade } from './tierUpgradeToast'

/** R61: odgovor PUT /api/loyalty/[id] lahko nosi tierUpgrade flag */
interface LoyaltyPutResponse {
  tierUpgrade?: { from: string; to: string } | null
}

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
      // R143 #30 (MODEL A canon): račun zvestobe je vezan na lokacijo. Super-admin
      // (sea brez lokacije) MORA podati izrecno lokacijo — ruta jo bere iz
      // ?locationId= (resolveTenantLocationIdOrThrow), body locationId pa NI del
      // createLoyaltySchema. Location-bound adminu je ?locationId neškodljiv
      // (resolver ga ignorira, seja je avtoritativna).
      const { locationId, ...body } = data
      const qs = typeof locationId === 'string' && locationId.trim()
        ? `?locationId=${encodeURIComponent(locationId.trim())}`
        : ''
      const res = await authFetch(`/api/loyalty${qs}`, { method: 'POST', body: JSON.stringify(body) })
      if (!res.ok) {
        // R143: povrni točno sporočilo strežnika (npr. 'locationId je obvezen…')
        const err = await res.json().catch(() => null) as { error?: string } | null
        throw new Error(err?.error || 'Napaka pri ustvarjanju računa')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Zvestobni račun uspešno ustvarjen')
      queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.all })
      onCloseDialog()
    },
    onError: (e: Error) => { toast.error(e.message || 'Napaka pri ustvarjanju zvestobnega računa') },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/loyalty/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Napaka pri posodabljanju računa')
      return res.json()
    },
    onSuccess: (result: LoyaltyPutResponse) => {
      toast.success('Zvestobni račun uspešno posodobljen')
      // RUNDA 61: celebrate ob samodejnem povišanju (ročni vnos točk/preimenovanja)
      if (result?.tierUpgrade) toastTierUpgrade(result.tierUpgrade.to)
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
    onSuccess: (result: LoyaltyPutResponse) => {
      toast.success('Točke uspešno prilagojene')
      // RUNDA 61: samodejno povišanje nivoja ob prilagoditvi (zaključitev toka)
      if (result?.tierUpgrade) toastTierUpgrade(result.tierUpgrade.to)
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
      // RUNDA 69: pokaži razlog zavrnitve (guard 409: "Račun ima N transakcij…")
      // namesto generične napake — API in dialog delita isti guard lib.
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || 'Napaka pri brisanju računa')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Zvestobni račun uspešno izbrisan')
      queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.all })
      onCloseDeleteDialog()
      onClearDeleteTarget()
    },
    onError: (e: Error) => { toast.error(e.message || 'Napaka pri brisanju zvestobnega računa') },
  })

  return {
    createMutation,
    updateMutation,
    adjustMutation,
    deleteMutation,
  }
}
