'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChefHat, AlertTriangle, Clock, Wifi } from 'lucide-react'
import { KitchenOrderCard } from './KitchenOrderCard'
import type { EnrichedOrder } from './types'

// --- Props ---

interface KitchenMainContentProps {
  isLoading: boolean
  viewMode: 'cards' | 'list'
  filteredOrders: EnrichedOrder[]
  urgentOrders: EnrichedOrder[]
  warningOrders: EnrichedOrder[]
  normalOrders: EnrichedOrder[]
  onItemStatusChange: (_itemId: string, _status: string) => void
  onOrderStatusChange: (_orderId: string, _status: string) => void
  stationFilter: 'all' | 'kuhinja' | 'sank'
  wsConnected: boolean
}

// --- Komponenta ---

export const KitchenMainContent = memo(function KitchenMainContent({
  isLoading,
  viewMode,
  filteredOrders,
  urgentOrders,
  warningOrders,
  normalOrders,
  onItemStatusChange,
  onOrderStatusChange,
  stationFilter,
  wsConnected,
}: KitchenMainContentProps) {
  if (isLoading) {
    return (
      <div className={viewMode === 'cards'
        ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
        : 'space-y-3 max-w-4xl mx-auto'
      }>
        {[...Array(6)].map((_, i) => <Skeleton key={i} className={viewMode === 'cards' ? 'h-64' : 'h-32'} />)}
      </div>
    )
  }

  if (filteredOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <ChefHat className="h-16 w-16 opacity-20" />
        <div className="text-center">
          <p className="text-lg font-medium">Kuhinja je prosta</p>
          <p className="text-sm">Ni aktivnih naročil za pripravo</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {wsConnected ? (
            <>
              <Wifi className="h-3 w-3 text-emerald-500" />
              Real-time povezava
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"><span className="sr-only">Osveževanje</span></span>
              Samodejno osveževanje vsakih 5s
            </>
          )}
        </div>
      </div>
    )
  }

  if (viewMode === 'cards') {
    return (
      /* CARDS VIEW - Prioritized columns */
      <div className="space-y-6">
        {/* Urgent orders - always visible first */}
        {urgentOrders.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-bold text-red-600">NUJNO - Čaka več kot 20 min</h3>
              <Badge variant="destructive" className="text-xs">{urgentOrders.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {urgentOrders.map(order => (
                <KitchenOrderCard
                  key={order.id}
                  order={order}
                  onItemStatusChange={onItemStatusChange}
                  onOrderStatusChange={onOrderStatusChange}
                  viewMode="cards"
                  stationFilter={stationFilter}
                />
              ))}
            </div>
          </div>
        )}

        {/* Warning orders */}
        {warningOrders.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-amber-600">OPOZORILO - Čaka 10-20 min</h3>
              <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">{warningOrders.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {warningOrders.map(order => (
                <KitchenOrderCard
                  key={order.id}
                  order={order}
                  onItemStatusChange={onItemStatusChange}
                  onOrderStatusChange={onOrderStatusChange}
                  viewMode="cards"
                  stationFilter={stationFilter}
                />
              ))}
            </div>
          </div>
        )}

        {/* Normal orders */}
        {normalOrders.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-bold text-muted-foreground">Aktivna naročila</h3>
              <Badge variant="outline" className="text-xs">{normalOrders.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {normalOrders.map(order => (
                <KitchenOrderCard
                  key={order.id}
                  order={order}
                  onItemStatusChange={onItemStatusChange}
                  onOrderStatusChange={onOrderStatusChange}
                  viewMode="cards"
                  stationFilter={stationFilter}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  /* LIST VIEW - Compact */
  return (
    <div className="space-y-3 max-w-5xl mx-auto">
      {filteredOrders.map(order => (
        <KitchenOrderCard
          key={order.id}
          order={order}
          onItemStatusChange={onItemStatusChange}
          onOrderStatusChange={onOrderStatusChange}
          viewMode="list"
          stationFilter={stationFilter}
        />
      ))}
    </div>
  )
})
