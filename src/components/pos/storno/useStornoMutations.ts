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

      const fursRes = await authFetch('/api/furs', {
        method: 'PUT',
        body: JSON.stringify({ orderId: order.id, reason: reasonText, reasonCode: selectedReason }),
      })

      if (!fursRes.ok) {
        toast.warning('FURS storno ni uspel, naročilo posodobljeno ročno')
        const orderRes = await authFetch(`/api/orders/${order.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            paymentStatus: 'storno', status: 'cancelled',
            cancelReason: `STORNO (brez FURS): ${reasonText}`,
          }),
        })
        if (!orderRes.ok) throw new Error('Napaka pri rocnem storniranju naročila')
        toast.warning('Storno izveden brez FURS overjanja — račun mora biti overjen kasneje', { duration: 5000 })
        return { success: true, message: 'Storno izveden brez FURS overjanja', isSimulation: true }
      }

      return fursRes.json()
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
