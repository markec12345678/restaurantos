'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'

// ============================================
// TIPI
// ============================================
interface UseVoidMutationParams {
  orderItem: {
    id: string
    name: string
    quantity: number
    price: number
    vatRate: number
    voided: boolean
  } | null
  orderId: string
  onVoided?: () => void
  onClose: () => void
}

// ============================================
// HOOK ZA VOID MUTACIJO IN STATE
// ============================================
export function useVoidMutation({ orderItem, onVoided, onClose }: UseVoidMutationParams) {
  const queryClient = useQueryClient()
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null)
  const [customReason, setCustomReason] = useState('')

  // Naloži razloge za void
  const { data: voidReasons } = useQuery({
    queryKey: queryKeys.voidReasons.all,
    queryFn: async () => {
      const res = await authFetch('/api/configuration/void-reasons')
      if (!res.ok) return []
      return res.json() as Promise<{ id: string; name: string; isActive: boolean }[]>
    },
  })

  // Void mutacija
  const voidMutation = useMutation({
    mutationFn: async () => {
      if (!orderItem) return null
      const res = await authFetch(`/api/order-items/${orderItem.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          voided: true,
          voidReasonId: selectedReasonId,
          voidReasonText: customReason || voidReasons?.find(r => r.id === selectedReasonId)?.name || '',
        }),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success(`Artikel "${orderItem?.name}" je voidan (poniščen)`)
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
      onVoided?.()
      resetAndClose()
    },
    onError: () => {
      toast.error('Napaka pri poničitvi artikla')
    },
  })

  const resetAndClose = () => {
    setSelectedReasonId(null)
    setCustomReason('')
    onClose()
  }

  const canSubmit = selectedReasonId || customReason.trim().length >= 3

  return {
    voidReasons,
    selectedReasonId,
    setSelectedReasonId,
    customReason,
    setCustomReason,
    voidMutation,
    canSubmit,
    resetAndClose,
  }
}
