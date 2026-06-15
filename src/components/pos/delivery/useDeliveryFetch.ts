'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import {
  type DeliveryInfoData,
  type OnlineOrder,
} from './constants'

// ============================================
// HOOK: Poizvedbe za dostave in online naročila
// ============================================

export function useDeliveryFetch() {
  // --- Dostave stanje ---
  const [statusFilter, setStatusFilter] = useState('all')

  // --- Online naročila stanje ---
  const [onlineFilter, setOnlineFilter] = useState('pending,in-progress,ready')

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
    refetchInterval: 15000,
  })

  // --- Izpeljani podatki ---
  const safeDeliveries = Array.isArray(deliveries) ? deliveries : []
  const activeDeliveries = safeDeliveries.filter(d => !['delivered', 'failed'].includes(d.status))
  const completedDeliveries = safeDeliveries.filter(d => ['delivered', 'failed'].includes(d.status))

  const orders = ordersData?.orders || []
  const onlineOrders = orders.filter(o => o.notes?.includes('ONLINE'))

  return {
    statusFilter,
    setStatusFilter,
    onlineFilter,
    setOnlineFilter,
    isLoading,
    ordersLoading,
    activeDeliveries,
    completedDeliveries,
    onlineOrders,
    safeDeliveries,
  }
}
