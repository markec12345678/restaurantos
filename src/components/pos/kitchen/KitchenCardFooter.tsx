'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Flame } from 'lucide-react'
import type { EnrichedOrder } from './types'

// ============================================
// NOGA KARTICE — vrstica napredka in dejanja
// ============================================
export const KitchenCardFooter = memo(function KitchenCardFooter({
  order,
  onOrderStatusChange,
}: {
  order: EnrichedOrder
  onOrderStatusChange: (_orderId: string, _status: string) => void
}) {
  const servedCount = order.orderItems.filter(oi => oi.status === 'served').length
  const completedCount = order.readyCount + servedCount

  return (
    <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {/* Progress bar */}
        <div
          className="flex gap-0.5"
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={order.totalItems}
          aria-label={`Napredek: ${completedCount} od ${order.totalItems} artiklov končanih`}
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
          {completedCount}/{order.totalItems}
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
  )
})
