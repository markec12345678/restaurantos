'use client'

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCheck } from 'lucide-react'
import { KitchenOrderItem } from './KitchenOrderItem'
import { WaitTimer } from './WaitTimer'
import { TYPE_LABELS, URGENCY_BORDER, URGENCY_BG } from './types'
import type { EnrichedOrder, OrderItemWithMenu } from './types'

// ============================================
// VRSTICA SEZNAMA — kompaktni prikaz naročila
// ============================================
export const KitchenOrderListRow = memo(function KitchenOrderListRow({
  order,
  displayItems,
  onItemStatusChange,
  onBumpOrder,
}: {
  order: EnrichedOrder
  displayItems: OrderItemWithMenu[]
  onItemStatusChange: (_itemId: string, _status: string) => void
  /** R26-b: bump = odstrani gotovo naročilo z ekrana (display akcija) */
  onBumpOrder?: (_orderId: string) => void
}) {
  const isReady = order.status === 'ready'
  return (
    <div className={`rounded-lg border bg-card transition-all hover:shadow-md ${
      isReady
        ? 'border-l-4 border-l-emerald-500 ring-1 ring-emerald-400/40'
        : `${URGENCY_BORDER[order.urgency]} ${URGENCY_BG[order.urgency]}`
    }`}>
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg">#{order.orderNumber}</span>
            {isReady && (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] font-bold animate-pulse">
                PRIPRAVLJENO
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {TYPE_LABELS[order.type] || order.type}
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
            {isReady && onBumpOrder && (
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition-transform pointer-coarse:h-10"
                onClick={() => onBumpOrder(order.id)}
                aria-label={`Bump naročila #${order.orderNumber} — odstrani z ekrana`}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Bump
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-1" role="list">
          {displayItems.map(item => (
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
})
