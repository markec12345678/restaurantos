'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Napredni kuhinjski pripravljalni vrstni red
// Toast Kitchen + Kitchen Display System (KDS) Pro
// Prednostne vrste, časi priprave, sledenje kurzov, alarmi
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { ChefHat, Clock, Flame, CheckCircle2, Bell, RefreshCw, LayoutGrid, ListOrdered } from 'lucide-react'
import { useState, useEffect, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import type { KitchenOrder, ViewMode } from './prep-queue/constants'

// Lazy-loaded podkomponente
const PrepQueueStats = dynamic(() => import('./prep-queue/PrepQueueStats').then(m => ({ default: m.PrepQueueStats })), { ssr: false })
const OrderColumn = dynamic(() => import('./prep-queue/OrderColumn').then(m => ({ default: m.OrderColumn })), { ssr: false })

export const KitchenPrepQueue = memo(function KitchenPrepQueue() {
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
      // Enostaven zvočni signal (uporabi Web Audio API)
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

  // Handler za preklop pogleda
  const handleViewModeToggle = useCallback(() => {
    setViewMode(prev => prev === 'grid' ? 'list' : 'grid')
  }, [])

  // Handler za preklop zvoka
  const handleSoundToggle = useCallback(() => {
    setSoundEnabled(prev => !prev)
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 overflow-y-auto h-full p-1 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-primary" />
            Kuhinjski pripravljalni vrsti red
          </h2>
          <p className="text-sm text-muted-foreground">Napredni KDS s prednostnimi vrstami in časi priprave</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={soundEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={handleSoundToggle}
            className="gap-1"
            aria-label={soundEnabled ? 'Izklopi zvočni alarm' : 'Vklopi zvočni alarm'}
          >
            <Bell className="h-3 w-3" />
            {soundEnabled ? 'Zvon' : 'Tiho'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewModeToggle}
            className="gap-1"
            aria-label={viewMode === 'grid' ? 'Preklopi na seznam' : 'Preklopi na mrežo'}
          >
            {viewMode === 'grid' ? <LayoutGrid className="h-3 w-3" /> : <ListOrdered className="h-3 w-3" />}
            {viewMode === 'grid' ? 'Mreža' : 'Seznam'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1" aria-label="Osveži podatke">
            <RefreshCw className="h-3 w-3" />
            Osveži
          </Button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <PrepQueueStats stats={stats} />

      {/* ═══════════════════════════════════════════════════════════
          TRI STOLPCI: Čakajoča | V pripravi | Pripravljena
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ČAKAJOČA NAROČILA */}
        <OrderColumn
          title="ČAKAJOČA"
          count={pendingOrders.length}
          dotColor="bg-yellow-500"
          emptyIcon={Clock}
          emptyText="Ni čakajočih naročil"
          orders={pendingOrders}
          viewMode={viewMode}
          onItemStatus={handleItemStatus}
          onOrderStatus={handleOrderToPreparing}
        />

        {/* V PRIPRAVI */}
        <OrderColumn
          title="V PRIPRAVI"
          count={preparingOrders.length}
          dotColor="bg-blue-500"
          emptyIcon={Flame}
          emptyText="Ni naročil v pripravi"
          orders={preparingOrders}
          viewMode={viewMode}
          onItemStatus={handleItemStatus}
          onOrderStatus={handleOrderToReady}
        />

        {/* PRIPRAVLJENA */}
        <OrderColumn
          title="PRIPRAVLJENA"
          count={readyOrders.length}
          dotColor="bg-emerald-500"
          emptyIcon={CheckCircle2}
          emptyText="Ni pripravljenih naročil"
          orders={readyOrders}
          viewMode={viewMode}
          onItemStatus={handleItemStatus}
          onOrderStatus={(orderId) => {
            const order = readyOrders.find(o => o.id === orderId)
            if (order) handleOrderToCompleted(orderId, order.orderNumber)
          }}
        />
      </div>
    </div>
  )
})
