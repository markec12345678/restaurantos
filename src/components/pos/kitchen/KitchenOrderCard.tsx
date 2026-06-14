'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, CheckCircle2, Flame, UtensilsCrossed } from 'lucide-react'
import { memo } from 'react'
import { format } from 'date-fns'
import { WaitTimer } from './WaitTimer'
import { KitchenOrderItem } from './KitchenOrderItem'
import type { EnrichedOrder } from './types'

// ============================================
// KOMPONENTA ZA POSAMEZNO NAROČILO
// ============================================
export const KitchenOrderCard = memo(function KitchenOrderCard({
  order,
  onItemStatusChange,
  onOrderStatusChange,
  viewMode,
  stationFilter
}: {
  order: EnrichedOrder
  onItemStatusChange: (_itemId: string, _status: string) => void
  onOrderStatusChange: (_orderId: string, _status: string) => void
  viewMode: 'cards' | 'list'
  stationFilter?: 'all' | 'kuhinja' | 'sank'
}) {
  const typeLabels: Record<string, string> = {
    'dine-in': '🍽️ Na mestu',
    'takeout': '📦 Za s seboj',
    'delivery': '🚚 Dostava',
  }

  const urgencyBorder: Record<string, string> = {
    normal: 'border-l-4 border-l-blue-400',
    warning: 'border-l-4 border-l-amber-400',
    critical: 'border-l-4 border-l-red-500',
  }

  const urgencyBg: Record<string, string> = {
    normal: '',
    warning: 'bg-amber-50/50 dark:bg-amber-900/10',
    critical: 'bg-red-50/50 dark:bg-red-900/10',
  }

  // Group items by category (food items together, drinks together)
  const foodItems = order.orderItems.filter(oi =>
    oi.menuItem.category.menu.name === 'Hrana'
  )
  const drinkItems = order.orderItems.filter(oi =>
    oi.menuItem.category.menu.name === 'Pijača'
  )

  // Filtriraj glede na postajo (kuhinja = samo hrana, šank = samo pijača)
  const displayFoodItems = stationFilter === 'sank' ? [] : foodItems
  const displayDrinkItems = stationFilter === 'kuhinja' ? [] : drinkItems

  if (viewMode === 'list') {
    return (
      <div className={`rounded-lg border bg-card ${urgencyBorder[order.urgency]} ${urgencyBg[order.urgency]} transition-all hover:shadow-md`}>
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="font-bold text-lg">#{order.orderNumber}</span>
              <Badge variant="outline" className="text-xs">
                {typeLabels[order.type] || order.type}
              </Badge>
              {order.table && (
                <Badge variant="secondary" className="text-xs">
                  🪑 Miza {order.table.number}
                </Badge>
              )}
              {order.customerName && (
                <span className="text-sm text-muted-foreground">{order.customerName}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <WaitTimer minutes={order.waitMinutes} urgency={order.urgency} />
              <div className="flex gap-1">
                {order.pendingCount > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    {order.pendingCount} čaka
                  </Badge>
                )}
                {order.preparingCount > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {order.preparingCount} pripravlja
                  </Badge>
                )}
                {order.readyCount > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {order.readyCount} pripravljeno
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-1" role="list">
            {[...displayFoodItems, ...displayDrinkItems].map(item => (
              <KitchenOrderItem key={item.id} item={item} onStatusChange={onItemStatusChange} compact />
            ))}
          </div>
          {order.notes && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400 italic bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
              📝 Opombe: {order.notes}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Cards view
  return (
    <Card className={`overflow-hidden ${urgencyBorder[order.urgency]} ${urgencyBg[order.urgency]} transition-all hover:shadow-lg`}>
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl">#{order.orderNumber}</span>
            {order.urgency === 'critical' && (
              <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" aria-label="Kritična nujnost" />
            )}
            {order.urgency === 'warning' && (
              <Clock className="h-4 w-4 text-amber-500" aria-label="Opozorilo o čaku" />
            )}
          </div>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-xs">
              {typeLabels[order.type] || order.type}
            </Badge>
            {order.table && (
              <Badge variant="secondary" className="text-xs font-semibold">
                🪑 Miza {order.table.number}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <WaitTimer minutes={order.waitMinutes} urgency={order.urgency} />
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(order.createdAt), 'HH:mm')}
          </span>
        </div>
      </div>

      {/* Customer & Notes */}
      {(order.customerName || order.notes) && (
        <div className="px-4 py-2 border-b bg-muted/10">
          {order.customerName && (
            <p className="text-sm text-muted-foreground">👤 {order.customerName}</p>
          )}
          {order.notes && (
            <p className="text-xs text-amber-700 dark:text-amber-400 italic mt-1">
              📝 {order.notes}
            </p>
          )}
        </div>
      )}

      {/* Food Items */}
      <CardContent className="p-3 space-y-2">
        {displayFoodItems.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">Hrana</span>
              <Badge variant="outline" className="text-[9px] h-4 px-1">{displayFoodItems.length}</Badge>
            </div>
            <div className="space-y-1.5" role="list">
              {displayFoodItems.map(item => (
                <KitchenOrderItem key={item.id} item={item} onStatusChange={onItemStatusChange} />
              ))}
            </div>
          </div>
        )}

        {displayDrinkItems.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-sm">🥤</span>
              <span className="text-xs font-semibold text-primary">Pijača</span>
              <Badge variant="outline" className="text-[9px] h-4 px-1">{displayDrinkItems.length}</Badge>
            </div>
            <div className="space-y-1.5" role="list">
              {displayDrinkItems.map(item => (
                <KitchenOrderItem key={item.id} item={item} onStatusChange={onItemStatusChange} />
              ))}
            </div>
          </div>
        )}

        {displayFoodItems.length === 0 && displayDrinkItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Ni artiklov</p>
        )}
      </CardContent>

      {/* Footer with progress and bulk action */}
      <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Progress bar */}
          <div
            className="flex gap-0.5"
            role="progressbar"
            aria-valuenow={order.readyCount + order.orderItems.filter(oi => oi.status === 'served').length}
            aria-valuemin={0}
            aria-valuemax={order.totalItems}
            aria-label={`Napredek: ${order.readyCount + order.orderItems.filter(oi => oi.status === 'served').length} od ${order.totalItems} artiklov končanih`}
          >
            {order.orderItems.map((item, i) => (
              <div
                key={i}
                className={`h-2 w-6 rounded-full transition-colors ${
                  item.status === 'served' ? 'bg-gray-400' :
                  item.status === 'ready' ? 'bg-emerald-500' :
                  item.status === 'preparing' ? 'bg-blue-500' :
                  'bg-yellow-400'
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {order.readyCount + (order.orderItems.filter(oi => oi.status === 'served').length)}/{order.totalItems}
          </span>
        </div>

        {order.status === 'pending' && (
          <Button
            size="sm"
            className="h-10 text-sm bg-blue-600 hover:bg-blue-700 touch-manipulation"
            onClick={() => onOrderStatusChange(order.id, 'in-progress')}
          >
            <Flame className="h-4 w-4 mr-1" />
            Začni pripravo
          </Button>
        )}
        {order.status === 'in-progress' && order.readyCount === order.totalItems && (
          <Button
            size="sm"
            className="h-10 text-sm bg-emerald-600 hover:bg-emerald-700 touch-manipulation"
            onClick={() => onOrderStatusChange(order.id, 'ready')}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Vse pripravljeno
          </Button>
        )}
      </div>
    </Card>
  )
})
