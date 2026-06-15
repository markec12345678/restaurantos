'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock } from 'lucide-react'
import { KitchenOrderCard } from './KitchenOrderCard'
import type { EnrichedOrder } from './types'

interface KitchenCardsViewProps {
  urgentOrders: EnrichedOrder[]
  warningOrders: EnrichedOrder[]
  normalOrders: EnrichedOrder[]
  onItemStatusChange: (_itemId: string, _status: string) => void
  onOrderStatusChange: (_orderId: string, _status: string) => void
  stationFilter: 'all' | 'kuhinja' | 'sank'
}

export const KitchenCardsView = memo(function KitchenCardsView({
  urgentOrders,
  warningOrders,
  normalOrders,
  onItemStatusChange,
  onOrderStatusChange,
  stationFilter,
}: KitchenCardsViewProps) {
  return (
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
})
