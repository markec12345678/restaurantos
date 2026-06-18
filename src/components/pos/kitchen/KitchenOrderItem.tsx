'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Flame, CheckCircle2, ArrowRight } from 'lucide-react'
import { memo } from 'react'
import type { OrderItemWithMenu } from './types'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// ============================================
// KOMPONENTA ZA POSAMEZNI ARTIKEL
// Ovito z memo — prepreči ponovni render vseh artiklov ob spremembi enega
// ============================================
export const KitchenOrderItem = memo(function KitchenOrderItem({
  item,
  onStatusChange,
  compact
}: {
  item: OrderItemWithMenu
  onStatusChange: (_id: string, _status: string) => void
  compact?: boolean
}) {
  const modifiers = (() => {
    try { return JSON.parse(item.modifiersJson || '[]') } catch { return [] }
  })()

  const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string; nextLabel: string; nextStatus: string }> = {
    pending: {
      color: 'text-yellow-700 dark:text-yellow-400',
      bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
      icon: <Clock className="h-4 w-4" />,
      label: 'Čaka',
      nextLabel: 'Pripravljam',
      nextStatus: 'preparing',
    },
    preparing: {
      color: 'text-blue-700 dark:text-blue-400',
      bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
      icon: <Flame className="h-4 w-4" />,
      label: 'V pripravi',
      nextLabel: 'Pripravljeno',
      nextStatus: 'ready',
    },
    ready: {
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800',
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: 'Pripravljeno',
      nextLabel: 'Postreženo',
      nextStatus: 'served',
    },
    served: {
      color: 'text-gray-500',
      bg: 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800',
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: 'Postreženo',
      nextLabel: '',
      nextStatus: '',
    },
  }

  const config = statusConfig[item.status] || statusConfig.pending

  if (compact) {
    return (
      <div className={`flex items-center justify-between p-2 rounded-lg border ${config.bg} transition-all`} role="listitem">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`flex-shrink-0 ${config.color}`} aria-hidden="true">{config.icon}</span>
          <span className="font-bold text-sm">{item.quantity}x</span>
          <span className="text-sm truncate">{item.menuItem.name}</span>
          {modifiers.length > 0 && (
            <div className="flex gap-0.5">
              {modifiers.map((m: { name: string }, i: number) => (
                <Badge key={i} variant="outline" className="text-[9px] h-4 px-1">
                  {m.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {item.status !== 'served' && (
          <Button
            size="sm"
            variant="ghost"
            className={`h-7 text-xs flex-shrink-0 ml-2 ${config.color} hover:${config.bg}`}
            onClick={() => onStatusChange(item.id, config.nextStatus)}
          >
            {config.nextLabel} <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={`p-3 rounded-lg border-2 ${config.bg} transition-all hover:shadow-sm touch-manipulation`} role="listitem">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`flex-shrink-0 ${config.color}`} aria-hidden="true">{config.icon}</span>
            <span className="font-bold text-lg">{item.quantity}x</span>
            <span className="font-semibold text-base">{item.menuItem.name}</span>
          </div>
          {modifiers.length > 0 && (
            <div className="flex flex-wrap gap-1 ml-8 mb-1">
              {modifiers.map((m: { name: string; price?: number }, i: number) => (
                <Badge key={i} variant="secondary" className="text-[10px] h-5 px-1.5">
                  {m.name}{m.price ? ` (+€${safeToFixed(m.price, 2)})` : ''}
                </Badge>
              ))}
            </div>
          )}
          {item.notes && (
            <p className="text-xs text-amber-700 dark:text-amber-400 ml-8 italic">
              📝 {item.notes}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground ml-8">
            {item.menuItem.category.icon} {item.menuItem.category.name}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <Badge className={`${config.color} ${config.bg} border-0 text-xs font-semibold`} role="status" aria-live="polite">
            {config.label}
          </Badge>
          {item.status !== 'served' && (
            <Button
              size="sm"
              className="h-10 min-w-[100px] text-sm touch-manipulation"
              onClick={() => onStatusChange(item.id, config.nextStatus)}
            >
              {config.nextLabel}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})
