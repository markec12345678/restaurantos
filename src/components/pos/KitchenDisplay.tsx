'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useKitchenWebSocket } from '@/lib/websocket-client'
import { queryKeys } from '@/lib/query-keys'
import { KDSData, type KdsFilterStatus } from './kitchen/types'
import { soundManager } from './kitchen/kitchen-sound'
import { useFullscreen } from './kitchen/use-fullscreen'
import { useKitchenMutations } from './kitchen/useKitchenMutations'
import { useKdsBumpedStore, getVisibleReadyOrders } from './kitchen/bumped-store'

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
  const [soundEnabled, setSoundEnabled] = useState(() => soundManager.isEnabled())
  const [filterStatus, setFilterStatus] = useState<KdsFilterStatus>('all')
  const [stationFilter, setStationFilter] = useState<'all' | 'kuhinja' | 'sank'>('all')
  const prevOrdersRef = useRef<string[]>([])
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

  const { handleItemStatusChange, handleOrderStatusChange } = useKitchenMutations(soundEnabled)
  // R26-b Toast vzorec: bump = odjemalska display akcija; Recall vrne bumpana naročila
  const bumpedAt = useKdsBumpedStore(s => s.bumpedAt)
  const bumpOrder = useKdsBumpedStore(s => s.bump)
  const recallAll = useKdsBumpedStore(s => s.recallAll)

  const { connected: wsConnected, lastEvent: wsLastEvent } = useKitchenWebSocket({
    onEvent: (msg) => {
      if (msg.type === 'NEW_ORDER') {
        toast.info(`\uD83C\uDF7D\uFE0F Novo naročilo!`, { duration: 3000 })
      }
      if (msg.type === 'ORDER_CANCELLED' && soundEnabled) {
        soundManager.playUrgent()
      }
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.kitchen.all,
    queryFn: async () => {
      const res = await authFetch('/api/kitchen')
      if (!res.ok) return { orders: [], readyOrders: [], stats: { totalActive: 0, pendingOrders: 0, inProgressOrders: 0, readyOrdersCount: 0, totalItemsPending: 0, totalItemsPreparing: 0, totalItemsReady: 0, avgWaitTime: 0, criticalOrders: 0 } } as KDSData
      return res.json() as Promise<KDSData>
    },
    refetchInterval: wsConnected ? 30000 : 5000,
  })

  useEffect(() => {
    if (wsLastEvent) {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
    }
  }, [wsLastEvent, queryClient])

  useEffect(() => {
    if (!data?.orders) return
    const currentOrderIds = data.orders.map(o => o.id)
    const newOrders = currentOrderIds.filter(id => !prevOrdersRef.current.includes(id))
    if (newOrders.length > 0 && prevOrdersRef.current.length > 0) {
      if (soundEnabled) soundManager.playNewOrder()
      toast.info(`\uD83C\uDF7D\uFE0F ${newOrders.length > 1 ? `${newOrders.length} nova naročila` : 'Novo naročilo'}!`, { duration: 3000 })
    }
    const urgentOrders = data.orders.filter(o => o.urgency === 'critical')
    if (urgentOrders.length > 0 && soundEnabled) {
      const veryUrgent = urgentOrders.filter(o => o.waitMinutes >= 25)
      if (veryUrgent.length > 0) soundManager.playUrgent()
    }
    prevOrdersRef.current = currentOrderIds
  }, [data?.orders, soundEnabled])

  const handleToggleSound = useCallback(() => {
    const enabled = soundManager.toggle()
    setSoundEnabled(enabled)
  }, [])

  // R26-b: ready "pick-up shelf" — bumpani so skriti
  const visibleReadyOrders = useMemo(
    () => getVisibleReadyOrders(data?.readyOrders, bumpedAt),
    [data?.readyOrders, bumpedAt]
  )
  const bumpedCount = useMemo(
    () => Math.max(0, (data?.readyOrders?.length || 0) - visibleReadyOrders.length),
    [data?.readyOrders, visibleReadyOrders.length]
  )

  const filteredOrders = useMemo(() => {
    if (filterStatus === 'ready') return visibleReadyOrders
    return (data?.orders || []).filter(order => {
      if (filterStatus === 'all') return true
      return order.status === filterStatus
    })
  }, [data?.orders, visibleReadyOrders, filterStatus])

  const { urgentOrders, warningOrders, normalOrders } = useMemo(() => ({
    urgentOrders: filterStatus === 'ready' ? [] : filteredOrders.filter(o => o.urgency === 'critical'),
    warningOrders: filterStatus === 'ready' ? [] : filteredOrders.filter(o => o.urgency === 'warning'),
    normalOrders: filterStatus === 'ready' ? [] : filteredOrders.filter(o => o.urgency === 'normal'),
  }), [filteredOrders, filterStatus])

  const stats = data?.stats

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <KitchenHeader
        stats={stats} stationFilter={stationFilter} onStationFilterChange={setStationFilter}
        soundEnabled={soundEnabled} onToggleSound={handleToggleSound} viewMode={viewMode} onViewModeChange={setViewMode}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })}
        isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen}
        filterStatus={filterStatus} onFilterStatusChange={setFilterStatus}
        filteredOrdersCount={filteredOrders.length} pendingOrdersCount={stats?.pendingOrders || 0} inProgressOrdersCount={stats?.inProgressOrders || 0}
        readyOrdersCount={visibleReadyOrders.length}
        bumpedCount={bumpedCount} onRecallAll={recallAll}
      />
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <KitchenMainContent
          isLoading={isLoading} viewMode={viewMode} filteredOrders={filteredOrders}
          urgentOrders={urgentOrders} warningOrders={warningOrders} normalOrders={normalOrders}
          readyOrders={filterStatus === 'all' || filterStatus === 'ready' ? visibleReadyOrders : []}
          onItemStatusChange={handleItemStatusChange} onOrderStatusChange={handleOrderStatusChange}
          onBumpOrder={bumpOrder}
          stationFilter={stationFilter} wsConnected={wsConnected}
          filterStatus={filterStatus}
        />
      </div>
      {stats && <KitchenFooter stats={stats} wsConnected={wsConnected} />}
    </div>
  )
})
