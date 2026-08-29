'use client'

import { memo, useState } from 'react'
import { CheckCircle, ChevronRight, ShoppingBag, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Order } from './types'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// ─── ORDERS TAB — Seznam naročil ───────────────────────────────

interface OrdersTabProps {
  orders: Order[]
  onMarkServed: (_orderId: string, _itemIds?: string[]) => void
  getElapsed: (_d: string | null) => number
}

export const OrdersTab = memo(function OrdersTab({ orders, onMarkServed, getElapsed }: OrdersTabProps) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <ShoppingCart className="w-12 h-12 opacity-40 mb-3" />
        <p className="text-lg font-bold">Ni naročil</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
      {orders.map(order => {
        const isExpanded = expandedOrder === order.id
        // FIX WAITER CRASH: order.items je lahko undefined če API ne vrača include-a
        const orderItems = Array.isArray(order.items) ? order.items : []
        const readyItems = orderItems.filter(i => i.status === 'ready')
        const elapsed = getElapsed(order.firedAt)
        const statusColor = order.status === 'ready' ? 'bg-emerald-500' : order.status === 'in-progress' ? 'bg-blue-500' : order.status === 'pending' ? 'bg-orange-500' : 'bg-muted'

        return (
          <div key={order.id} className="rounded-xl border bg-card overflow-hidden">
            <button onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
              className="w-full flex items-center justify-between px-4 py-3 touch-manipulation min-h-[56px]">
              <div className="flex items-center gap-3">
                <div className={cn('w-2 h-8 rounded-full', statusColor)} />
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">#{order.orderNumber}</span>
                    {order.table && <span className="text-sm font-black px-2 py-0.5 rounded bg-primary/15 text-primary">Miza {order.table.number}</span>}
                    {order.type === 'TAKEOUT' && <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{order.employee?.name || '—'} · {orderItems.length} artiklov</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {readyItems.length > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {readyItems.length} pripravljenih
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{elapsed}min</span>
                <ChevronRight className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')} />
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-3 space-y-1.5 border-t pt-2">
                {orderItems.map(item => (
                  <div key={item.id} className={cn(
                    'flex items-center justify-between py-1.5 px-2.5 rounded-lg text-sm',
                    item.status === 'ready' && 'bg-emerald-50 dark:bg-emerald-950/30',
                    item.status === 'served' && 'bg-blue-50 dark:bg-blue-950/30 opacity-60',
                    item.status === 'cancelled' && 'opacity-40 line-through',
                    item.status === 'preparing' && 'bg-orange-50 dark:bg-orange-950/20',
                    item.status === 'fired' && 'bg-orange-50 dark:bg-orange-950/20',
                  )}>
                    <div>
                      <span className="font-bold">{item.quantity}x</span> {item.name}
                      {item.notes && <p className="text-[11px] text-muted-foreground ml-5">{item.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{safeToFixed(item.price * item.quantity, 2)} €</span>
                      {item.status === 'ready' && (
                        <button onClick={() => onMarkServed(order.id, [item.id])}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 touch-manipulation min-h-[36px]">
                          Postreži
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t mt-2">
                  <span className="font-bold">Skupaj: {safeToFixed(order.total, 2)} €</span>
                  {readyItems.length > 0 && (
                    <button onClick={() => onMarkServed(order.id, readyItems.map(i => i.id))}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 active:scale-95 touch-manipulation min-h-[48px]">
                      <CheckCircle className="w-4 h-4 inline mr-1" />Prevzemi vse pripravljene
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
})
