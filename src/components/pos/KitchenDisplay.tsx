'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useKitchenWebSocket } from '@/lib/websocket-client'
import { queryKeys } from '@/lib/query-keys'
import { KDSData } from './kitchen/types'
import { soundManager } from './kitchen/kitchen-sound'
import { useFullscreen } from './kitchen/use-fullscreen'

// Lazy-loaded podkomponente
const KitchenHeader = dynamic(() => import('./kitchen/KitchenHeader').then(m => ({ default: m.KitchenHeader })), { ssr: false })
const KitchenMainContent = dynamic(() => import('./kitchen/KitchenMainContent').then(m => ({ default: m.KitchenMainContent })), { ssr: false })
const KitchenFooter = dynamic(() => import('./kitchen/KitchenFooter').then(m => ({ default: m.KitchenFooter })), { ssr: false })

// ============================================
// GLAVNA KDS KOMPONENTA
// ============================================
export const KitchenDisplay = memo(function KitchenDisplay() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards')
  // FIX MEDIUM: Inicializiraj soundEnabled iz soundManager singletona — prepreči divergenco
  const [soundEnabled, setSoundEnabled] = useState(() => soundManager.isEnabled())
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in-progress'>('all')
  const [stationFilter, setStationFilter] = useState<'all' | 'kuhinja' | 'sank'>('all')
  const prevOrdersRef = useRef<string[]>([])
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

  // WebSocket za real-time posodobitve
  const { connected: wsConnected, lastEvent: wsLastEvent } = useKitchenWebSocket({
    onEvent: (msg) => {
      // FIX HIGH: Ne predvajaj zvoka tukaj — zvok se predvaja v useEffect spodaj
      // S tem se izognemo dvojnemu zvoku (WS + polling detection)
      if (msg.type === 'NEW_ORDER') {
        toast.info(`\uD83C\uDF7D\uFE0F Novo naročilo!`, { duration: 3000 })
      }
      if (msg.type === 'ORDER_CANCELLED' && soundEnabled) {
        soundManager.playUrgent()
      }
    },
  })

  // Fetch KDS data — uporabi polling samo kot fallback, ko WebSocket ni povezan
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.kitchen.all,
    queryFn: async () => {
      const res = await authFetch('/api/kitchen')
      return res.json() as Promise<KDSData>
    },
    // Ko je WS povezan, ne potrebujemo pogostega pollinga (samo vsakih 30s za zagotovitev)
    // Ko WS ni povezan, pollamo vsakih 5s kot fallback
    refetchInterval: wsConnected ? 30000 : 5000,
  })

  // Ob vsakem WS dogodku takoj invalidiraj poizvedbe
  useEffect(() => {
    if (wsLastEvent) {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
    }
  }, [wsLastEvent, queryClient])

  // Detect new orders for sound notification
  useEffect(() => {
    if (!data?.orders) return

    const currentOrderIds = data.orders.map(o => o.id)
    const newOrders = currentOrderIds.filter(id => !prevOrdersRef.current.includes(id))

    if (newOrders.length > 0 && prevOrdersRef.current.length > 0) {
      // New order detected!
      if (soundEnabled) {
        soundManager.playNewOrder()
      }
      toast.info(`\uD83C\uDF7D\uFE0F ${newOrders.length > 1 ? `${newOrders.length} nova naročila` : 'Novo naročilo'}!`, {
        duration: 3000,
      })
    }

    // Check for urgent orders
    const urgentOrders = data.orders.filter(o => o.urgency === 'critical')
    if (urgentOrders.length > 0 && soundEnabled) {
      // Play urgent sound for very old orders
      const veryUrgent = urgentOrders.filter(o => o.waitMinutes >= 25)
      if (veryUrgent.length > 0) {
        soundManager.playUrgent()
      }
    }

    prevOrdersRef.current = currentOrderIds
  }, [data?.orders, soundEnabled])

  // Item status mutation
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

  // Order status mutation
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

  const handleToggleSound = useCallback(() => {
    const enabled = soundManager.toggle()
    setSoundEnabled(enabled)
  }, [])

  // Filter orders by status — memoiziraj, da se ne preračuna ob vsakem renderju
  const filteredOrders = useMemo(() => {
    return (data?.orders || []).filter(order => {
      if (filterStatus === 'all') return true
      return order.status === filterStatus
    })
  }, [data?.orders, filterStatus])

  // Separate into columns by urgency for cards view — memoiziraj
  const { urgentOrders, warningOrders, normalOrders } = useMemo(() => ({
    urgentOrders: filteredOrders.filter(o => o.urgency === 'critical'),
    warningOrders: filteredOrders.filter(o => o.urgency === 'warning'),
    normalOrders: filteredOrders.filter(o => o.urgency === 'normal'),
  }), [filteredOrders])

  const stats = data?.stats

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* HEADER - Stats & Controls */}
      <KitchenHeader
        stats={stats}
        stationFilter={stationFilter}
        onStationFilterChange={setStationFilter}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        filteredOrdersCount={filteredOrders.length}
        pendingOrdersCount={stats?.pendingOrders || 0}
        inProgressOrdersCount={stats?.inProgressOrders || 0}
      />

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <KitchenMainContent
          isLoading={isLoading}
          viewMode={viewMode}
          filteredOrders={filteredOrders}
          urgentOrders={urgentOrders}
          warningOrders={warningOrders}
          normalOrders={normalOrders}
          onItemStatusChange={handleItemStatusChange}
          onOrderStatusChange={handleOrderStatusChange}
          stationFilter={stationFilter}
          wsConnected={wsConnected}
        />
      </div>

      {/* FOOTER - Live stats */}
      {stats && (
        <KitchenFooter
          stats={stats}
          wsConnected={wsConnected}
        />
      )}
    </div>
  )
})
