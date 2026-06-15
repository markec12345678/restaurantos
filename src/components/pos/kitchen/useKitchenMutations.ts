'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { soundManager } from './kitchen-sound'
import { useCallback } from 'react'

// ============================================
// KITCHEN MUTATIONS — Status posodobitve naročil in artiklov
// ============================================

export function useKitchenMutations(soundEnabled: boolean) {
  const queryClient = useQueryClient()

  const itemStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await authFetch(`/api/order-items/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update item')
      return res.json()
    },
    onSuccess: (_, variables) => {
      if (variables.status === 'ready' && soundEnabled) {
        soundManager.playItemReady()
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: () => {
      toast.error('Napaka pri posodobitvi statusa')
    },
  })

  const orderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await authFetch(`/api/orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update order')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Status naročila posodobljen')
    },
  })

  const handleItemStatusChange = useCallback((itemId: string, status: string) => {
    itemStatusMutation.mutate({ id: itemId, status })
  }, [itemStatusMutation])

  const handleOrderStatusChange = useCallback((orderId: string, status: string) => {
    orderStatusMutation.mutate({ id: orderId, status })
  }, [orderStatusMutation])

  return { handleItemStatusChange, handleOrderStatusChange }
}
