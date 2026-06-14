'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { useState, useEffect, useCallback } from 'react'
import type { KitchenOrder, ViewMode } from './constants'

// ============================================
// HOOK: Kuhinjski pripravljalni vrstni red
// Združuje poizvedbe, mutacije in handlerje
// ============================================

export function useKitchenPrepQueue() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [soundEnabled, setSoundEnabled] = useState(true)

  const { data, isLoading, refetch } = useQuery<{
    orders: KitchenOrder[]
    stats: { pending: number; preparing: number; ready: number; avgWaitTime: number }
  }>({
    queryKey: queryKeys.kitchen.prepQueue,
    queryFn: async () => {
      const res = await authFetch('/api/dashboard')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      const dashboardData = await res.json()

      // Pretvori dashboard podatke v kuhinjske naročila
      const activeOrders = (dashboardData.recentOrders || [])
        .filter((o: { status: string }) => o.status === 'pending' || o.status === 'in-progress')

      const kitchenOrders: KitchenOrder[] = activeOrders.map((order: {
        id: string; orderNumber: number; type: string; status: string; priority?: string;
        createdAt: string; orderItems: KitchenOrder['orderItems']; table?: { number: number; name?: string };
        customerName?: string; specialInstructions?: string;
      }) => {
        const created = new Date(order.createdAt).getTime()
        const now = Date.now()
        const elapsedMinutes = Math.floor((now - created) / 60000)
        const estimatedPrepMinutes = order.orderItems?.reduce(
          (sum: number, oi: { menuItem?: { prepTime?: number } }) => sum + (oi.menuItem?.prepTime || 15), 0
        ) / Math.max(order.orderItems?.length || 1, 1)

        return {
          ...order,
          priority: order.priority || (elapsedMinutes > 30 ? 'urgent' : elapsedMinutes > 15 ? 'high' : 'normal'),
          elapsedMinutes,
          estimatedPrepMinutes: Math.round(estimatedPrepMinutes),
          status: order.status === 'in-progress' ? 'preparing' : order.status,
        }
      })

      // Razvrsti po prednosti nato po času
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
      kitchenOrders.sort((a: KitchenOrder, b: KitchenOrder) => {
        const pA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2
        const pB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2
        if (pA !== pB) return pA - pB
        return a.elapsedMinutes - b.elapsedMinutes
      })

      const pending = kitchenOrders.filter((o: KitchenOrder) => o.status === 'pending').length
      const preparing = kitchenOrders.filter((o: KitchenOrder) => o.status === 'preparing').length
      const ready = kitchenOrders.filter((o: KitchenOrder) => o.status === 'ready').length
      const avgWaitTime = kitchenOrders.length > 0
        ? kitchenOrders.reduce((s: number, o: KitchenOrder) => s + o.elapsedMinutes, 0) / kitchenOrders.length
        : 0

      return {
        orders: kitchenOrders,
        stats: { pending, preparing, ready, avgWaitTime },
      }
    },
    refetchInterval: 5000, // Osvežitev vsakih 5s
  })

  // Mutacija za posodobitev statusa artikla
  const updateItemStatus = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      const res = await authFetch(`/api/checks/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.prepQueue })
    },
  })

  // Zvočni alarm za nujna naročila
  useEffect(() => {
    if (!soundEnabled) return
    const urgentCount = data?.orders.filter(o => o.priority === 'urgent').length || 0
    if (urgentCount > 0) {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        gain.gain.value = 0.1
        osc.start()
        osc.stop(ctx.currentTime + 0.15)
      } catch {
        // Zvok ni na voljo
      }
    }
  }, [data?.orders.filter(o => o.priority === 'urgent').length, soundEnabled])

  const orders = data?.orders || []
  const stats = data?.stats

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const preparingOrders = orders.filter(o => o.status === 'preparing')
  const readyOrders = orders.filter(o => o.status === 'ready')

  const handleItemStatus = useCallback((itemId: string, status: string) => {
    updateItemStatus.mutate({ itemId, status })
  }, [updateItemStatus])

  const handleOrderToPreparing = useCallback((orderId: string) => {
    updateItemStatus.mutate({ itemId: orderId, status: 'preparing' })
  }, [updateItemStatus])

  const handleOrderToReady = useCallback((orderId: string) => {
    updateItemStatus.mutate({ itemId: orderId, status: 'ready' })
  }, [updateItemStatus])

  const handleOrderToCompleted = useCallback((orderId: string, orderNumber: number) => {
    updateItemStatus.mutate({ itemId: orderId, status: 'completed' })
    toast.success(`Naročilo #${orderNumber} zaključeno`)
  }, [updateItemStatus])

  const handleViewModeToggle = useCallback(() => {
    setViewMode(prev => prev === 'grid' ? 'list' : 'grid')
  }, [])

  const handleSoundToggle = useCallback(() => {
    setSoundEnabled(prev => !prev)
  }, [])

  return {
    viewMode, setViewMode,
    soundEnabled,
    isLoading, refetch,
    orders, stats,
    pendingOrders, preparingOrders, readyOrders,
    handleItemStatus, handleOrderToPreparing, handleOrderToReady,
    handleOrderToCompleted, handleViewModeToggle, handleSoundToggle,
  }
}
