'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { STORNO_REASONS, CANCEL_REASONS } from './constants'
import type { StornoDialogProps } from './constants'

// ============================================
// HOOK: Storno & Cancel mutations
// ============================================
export function useStornoMutations(
  order: StornoDialogProps['order'],
  selectedReason: string | null,
  customReason: string,
  resetAndClose: () => void,
  onStornoComplete?: () => void,
) {
  const queryClient = useQueryClient()

  const stornoMutation = useMutation({
    mutationFn: async () => {
      if (!order) return null
      const reasonText = selectedReason === 'other'
        ? customReason
        : STORNO_REASONS.find(r => r.id === selectedReason)?.name

      // FIX NAPAKA 5 (HTTP 403): FURS storno zahteva admin dovoljenje.
      // Če uporabnik ni admin (403), storno delaj brez FURS (ročno).
      // authFetch vrže napako na non-OK response, zato ujamemo v try/catch.
      let fursResult: { success?: boolean; message?: string } | null = null
      try {
        const fursRes = await authFetch('/api/furs', {
          method: 'PUT',
          body: JSON.stringify({ orderId: order.id, reason: reasonText, reasonCode: selectedReason }),
        })
        fursResult = await fursRes.json()
      } catch (err) {
        // FIX NAPAKA 5: Ujemi 403 error (uporabnik nima admin dovoljenja)
        const errWithStatus = err as Error & { status?: number }
        const errStatus = errWithStatus.status
        const errMsg = err instanceof Error ? err.message : 'Napaka'
        toast.warning(
          errStatus === 403
            ? 'FURS overjanje zahteva admin dovoljenje. Storno brez FURS.'
            : `FURS storno ni uspel (${errMsg}). Naročilo posodobljeno ročno.`,
          { duration: 5000 }
        )
        // Nadaljuj z ročnim stornom
        const orderRes = await authFetch(`/api/orders/${order.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            paymentStatus: 'storno', status: 'cancelled',
            cancelReason: `STORNO (brez FURS): ${reasonText}`,
          }),
        })
        if (!orderRes.ok) throw new Error('Napaka pri rocnem storniranju naročila')
        return { success: true, message: 'Storno izveden brez FURS overjanja', isSimulation: true }
      }

      return fursResult
    },
    onSuccess: (result) => {
      toast.success(result?.message || 'Storno račun uspešno ustvarjen')
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: ['receipt'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.cashRegister.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      onStornoComplete?.()
      resetAndClose()
    },
    onError: (err: Error) => {
      toast.error(`Napaka pri storniranju: ${err.message}`)
    },
  })

  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      if (!order) return null
      const reasonText = selectedReason === 'other'
        ? customReason
        : CANCEL_REASONS.find(r => r.id === selectedReason)?.name || customReason

      const res = await authFetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled', cancelReason: reasonText || 'Preklicano' }),
      })
      if (!res.ok) throw new Error('Napaka pri preklicu naročila')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Naročilo preklicano')
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
      onStornoComplete?.()
      resetAndClose()
    },
    onError: () => {
      toast.error('Napaka pri preklicu naročila')
    },
  })

  return { stornoMutation, cancelOrderMutation }
}
