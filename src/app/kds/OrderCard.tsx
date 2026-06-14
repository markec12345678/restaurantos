'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { Clock, Flame, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { OrderKDS } from './types'
import { ElapsedTimer } from './ElapsedTimer'

// ─── Naročilna kartica ─────────────────────────────────────────

interface OrderCardProps {
  order: OrderKDS
  onBump: (_orderId: string) => void
  onBumpItem: (_orderId: string, _itemId: string) => void
  getElapsed: (_d: string | null) => number
}

export const OrderCard = memo(function OrderCard({
  order,
  onBump,
  onBumpItem,
  getElapsed,
}: OrderCardProps) {
  // FIX: Backend item statuses are lowercase
  const activeItems = order.items.filter(i => !['served', 'cancelled'].includes(i.status))
  const readyItems = activeItems.filter(i => i.status === 'ready')
  const preparingItems = activeItems.filter(i => ['fired', 'preparing', 'pending'].includes(i.status))
  const allReady = activeItems.length > 0 && readyItems.length === activeItems.length
  const elapsed = getElapsed(order.firedAt)
  const isDanger = elapsed >= 25
  const isWarning = elapsed >= 15 && !isDanger
  const typeLabels: Record<string, string> = {
    'dine-in': 'NA MESTU',
    'takeout': 'ZA SEBOJ',
    'delivery': 'DOSTAVA',
  }
  return (
    <div className={cn(
      'rounded-xl border-2 overflow-hidden transition-all shadow-md flex flex-col',
      allReady ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' :
      isDanger ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 animate-pulse' :
      isWarning ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20' :
      'border-border bg-card',
      order.priority && 'ring-2 ring-orange-500 ring-offset-2'
    )}>
      {/* Glava */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2 text-white font-bold text-sm',
        allReady ? 'bg-emerald-600' :
        isDanger ? 'bg-red-600' :
        isWarning ? 'bg-amber-600' :
        'bg-orange-600'
      )}>
        <div className="flex items-center gap-2">
          <span className="text-lg font-black">#{order.orderNumber}</span>
          {order.table && (
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">
              Miza {order.table.number}
            </span>
          )}
          <span className="text-xs opacity-80">{typeLabels[order.type] || order.type}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          <ElapsedTimer startTime={order.firedAt} />
        </div>
      </div>
      {/* Artikli */}
      <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {preparingItems.map(item => (
          <div key={item.id}
            className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white dark:bg-card border text-sm cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors touch-manipulation min-h-[44px]"
            onClick={() => onBumpItem(order.id, item.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-base">{item.quantity}x</span>
                <span className="font-semibold truncate">{item.name}</span>
              </div>
              {item.modifiers?.length > 0 && (
                <div className="ml-7 text-xs text-muted-foreground">
                  {item.modifiers.map(m => m.name).join(', ')}
                </div>
              )}
              {item.notes && (
                <div className="ml-7 text-xs text-orange-600 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {item.notes}
                </div>
              )}
            </div>
            <div className="flex-shrink-0 ml-2">
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
          </div>
        ))}
        {readyItems.map(item => (
          <div key={item.id}
            className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-sm cursor-pointer hover:bg-emerald-200 transition-colors touch-manipulation min-h-[44px]"
            onClick={() => onBumpItem(order.id, item.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-base">{item.quantity}x</span>
                <span className="font-semibold truncate line-through opacity-60">{item.name}</span>
              </div>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
        ))}
      </div>
      {/* Spodnja vrstica */}
      <div className="px-3 py-2 border-t flex items-center justify-between bg-muted/30">
        <div className="text-xs text-muted-foreground">
          {order.employee?.name || '—'}
          {order.notes && <span className="ml-2 text-orange-600 font-semibold">★ {order.notes}</span>}
        </div>
        <button
          onClick={() => onBump(order.id)}
          className={cn(
            'px-4 py-2 rounded-lg font-bold text-sm transition-all active:scale-95 touch-manipulation min-h-[44px]',
            allReady
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-orange-500 text-white hover:bg-orange-600'
          )}
        >
          {allReady ? '✓ BUMP' : 'BUMP vse'}
        </button>
      </div>
    </div>
  )
})
