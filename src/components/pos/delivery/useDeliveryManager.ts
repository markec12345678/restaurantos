'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

// ============================================
// HOOK: Upravljanje dostav in online naročil
// Združuje poizvedbe, mutacije in handlerje
// ============================================

export function useDeliveryManager() {
  const queryClient = useQueryClient()

  // --- Dostave stanje ---
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDelivery, setEditingDelivery] = useState<DeliveryInfoData | null>(null)
  const [formData, setFormData] = useState<DeliveryFormData>(emptyFormData)

  // --- Online naročila stanje ---
  const [onlineFilter, setOnlineFilter] = useState('pending,in-progress,ready')
  const [detailOrder, setDetailOrder] = useState<OnlineOrder | null>(null)

  // --- Poizvedbe: dostave ---
  const { data: deliveries, isLoading } = useQuery<DeliveryInfoData[]>({
    queryKey: [...queryKeys.delivery.tracking, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await authFetch(`/api/delivery?${params}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju dostav')
      return res.json()
    },
  })

  // --- Poizvedbe: online naročila ---
  const { data: ordersData, isLoading: ordersLoading } = useQuery<{ orders: OnlineOrder[] }>({
    queryKey: [...queryKeys.delivery.onlineOrders, onlineFilter],
    queryFn: async () => {
      const res = await authFetch(`/api/orders?status=${onlineFilter}&type=delivery,takeout&limit=20&source=online`)
      if (!res.ok) return { orders: [] }
      const data = await res.json()
      return { orders: Array.isArray(data) ? data : data.orders || [] }
    },
    refetchInterval: 15000, // Auto-refresh vsakih 15s
  })

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

  // --- Izpeljani podatki ---
  const safeDeliveries = Array.isArray(deliveries) ? deliveries : []
  const activeDeliveries = safeDeliveries.filter(d => !['delivered', 'failed'].includes(d.status))
  const completedDeliveries = safeDeliveries.filter(d => ['delivered', 'failed'].includes(d.status))

  const orders = ordersData?.orders || []
  const onlineOrders = orders.filter(o => o.notes?.includes('ONLINE'))

  return {
    // Stanje
    statusFilter,
    setStatusFilter,
    dialogOpen,
    setDialogOpen,
    editingDelivery,
    formData,
    setFormData,
    onlineFilter,
    setOnlineFilter,
    detailOrder,

    // Nalaganje
    isLoading,
    ordersLoading,

    // Izpeljano
    activeDeliveries,
    completedDeliveries,
    onlineOrders,
    safeDeliveries,

    // Mutacije
    updateMutation,

    // Handlerji
    openEdit,
    handleUpdate,
    advanceStatus,
    handleOnlineNextStatus,
    handleShowDetail,
    handleDetailOpenChange,
  }
}
