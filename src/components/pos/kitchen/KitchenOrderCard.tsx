'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, UtensilsCrossed } from 'lucide-react'
import { memo } from 'react'
import { format } from 'date-fns'
import { WaitTimer } from './WaitTimer'
import { KitchenOrderItem } from './KitchenOrderItem'
import { KitchenOrderListRow } from './KitchenOrderListRow'
import { KitchenCardFooter } from './KitchenCardFooter'
import { TYPE_LABELS, URGENCY_BORDER, URGENCY_BG } from './types'
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
  // FIX PrepStation routing: Filtriraj artikle po prepStation.type namesto
  // po category/menu imenu. Prej je bil filter po 'Hrana'/'Pijača' kar ni
  // delovalo ker menu.name je 'Glavni meni'.
  // Sedaj: preverja menuItem.prepStation.type:
  // - 'kitchen' → kuhinjski artikli (kuhinja filter)
  // - 'bar' → šank artikli (šank filter)
  // - če prepStation ni nastavljen, fallback na category ime
  const allItems = Array.isArray(order.orderItems) ? order.orderItems : []

  const foodItems = allItems.filter(oi => {
    const stationType = (oi.menuItem as { prepStation?: { type?: string } })?.prepStation?.type
    const stationName = (oi.menuItem as { prepStation?: { name?: string } })?.prepStation?.name
    // Če ima prepStation.type='kitchen' ali če ni nastavljen → kuhinja
    return stationType === 'kitchen' || (!stationType && stationName !== 'Bar')
  })
  const drinkItems = allItems.filter(oi => {
    const stationType = (oi.menuItem as { prepStation?: { type?: string } })?.prepStation?.type
    const stationName = (oi.menuItem as { prepStation?: { name?: string } })?.prepStation?.name
    // Če ima prepStation.type='bar' ali prepStation.name='Bar' → šank
    return stationType === 'bar' || stationName === 'Bar'
  })

  // Filtriraj glede na postajo
  const displayFoodItems = stationFilter === 'sank' ? [] : foodItems
  const displayDrinkItems = stationFilter === 'kuhinja' ? [] : drinkItems

  // Seznamski prikaz
  if (viewMode === 'list') {
    return (
      <KitchenOrderListRow
        order={order}
        displayItems={[...displayFoodItems, ...displayDrinkItems]}
        onItemStatusChange={onItemStatusChange}
      />
    )
  }

  // Kartični prikaz
  return (
    <Card className={`overflow-hidden ${URGENCY_BORDER[order.urgency]} ${URGENCY_BG[order.urgency]} transition-all hover:shadow-lg`}>
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
              {TYPE_LABELS[order.type] || order.type}
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
      <KitchenCardFooter order={order} onOrderStatusChange={onOrderStatusChange} />
    </Card>
  )
})
