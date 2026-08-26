'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import {
  type DeliveryInfoData,
  type DeliveryFormData,
  type OnlineOrder,
  emptyFormData,
  deliveryToFormData,
  getNextDeliveryStatus,
} from './constants'
import { useDeliveryFetch } from './useDeliveryFetch'

// ============================================
// HOOK: Upravljanje dostav in online naročil
// Združuje poizvedbe, mutacije in handlerje
// ============================================

export function useDeliveryManager() {
  const queryClient = useQueryClient()
  const fetchState = useDeliveryFetch()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDelivery, setEditingDelivery] = useState<DeliveryInfoData | null>(null)
  const [formData, setFormData] = useState<DeliveryFormData>(emptyFormData)
  const [detailOrder, setDetailOrder] = useState<OnlineOrder | null>(null)

  // --- Mutacije: posodobi dostavo ---
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/delivery/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Napaka pri posodobitvi dostave')
      return res.json()
    },
    onSuccess: () => { toast.success('Dostava posodobljena'); queryClient.invalidateQueries({ queryKey: queryKeys.delivery.tracking }); setDialogOpen(false) },
    onError: () => toast.error('Napaka pri posodobitvi'),
  })

  // --- Mutacije: posodobi status online naročila ---
  const updateOnlineStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await authFetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Status posodobljen')
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.onlineOrders })
    },
    onError: () => toast.error('Napaka pri posodobitvi'),
  })

  // --- Handlerji: dostave ---
  const openEdit = useCallback((delivery: DeliveryInfoData) => {
    setEditingDelivery(delivery)
    setFormData(deliveryToFormData(delivery))
    setDialogOpen(true)
  }, [])

  const handleUpdate = useCallback(() => {
    if (!editingDelivery) return
    if (!formData.address.trim()) {
      toast.error('Naslov je obvezen')
      return
    }
    updateMutation.mutate({
      id: editingDelivery.id,
      ...formData,
      packagingFee: parseFloat(formData.packagingFee) || 0,
      deliveryFee: parseFloat(formData.deliveryFee) || 0,
    })
  }, [editingDelivery, formData, updateMutation])

  const advanceStatus = useCallback((delivery: DeliveryInfoData) => {
    const next = getNextDeliveryStatus(delivery.status)
    if (next) {
      updateMutation.mutate({ id: delivery.id, status: next })
    }
  }, [updateMutation])

  // --- Handlerji: online naročila ---
  const handleOnlineNextStatus = useCallback((id: string, status: string) => {
    updateOnlineStatusMutation.mutate({ id, status })
  }, [updateOnlineStatusMutation])

  const handleShowDetail = useCallback((order: OnlineOrder) => {
    setDetailOrder(order)
  }, [])

  const handleDetailOpenChange = useCallback((open: boolean) => {
    if (!open) setDetailOrder(null)
  }, [])

  return {
    ...fetchState,
    dialogOpen,
    setDialogOpen,
    editingDelivery,
    formData,
    setFormData,
    detailOrder,
    updateMutation,
    openEdit,
    handleUpdate,
    advanceStatus,
    handleOnlineNextStatus,
    handleShowDetail,
    handleDetailOpenChange,
  }
}
