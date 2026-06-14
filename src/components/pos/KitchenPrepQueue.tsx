'use client'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChefHat, Clock, Flame, CheckCircle2, Bell, RefreshCw, LayoutGrid, ListOrdered } from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useKitchenPrepQueue } from './prep-queue/useKitchenPrepQueue'

// Lazy-loaded podkomponente
const PrepQueueStats = dynamic(() => import('./prep-queue/PrepQueueStats').then(m => ({ default: m.PrepQueueStats })), { ssr: false })
const OrderColumn = dynamic(() => import('./prep-queue/OrderColumn').then(m => ({ default: m.OrderColumn })), { ssr: false })

export const KitchenPrepQueue = memo(function KitchenPrepQueue() {
  const {
    viewMode, soundEnabled,
    isLoading, refetch,
    pendingOrders, preparingOrders, readyOrders, stats,
    handleItemStatus, handleOrderToPreparing, handleOrderToReady,
    handleOrderToCompleted, handleViewModeToggle, handleSoundToggle,
  } = useKitchenPrepQueue()

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

      {/* TRI STOLPCI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
