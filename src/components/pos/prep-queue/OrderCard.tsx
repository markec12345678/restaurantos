'use client'

// ═══════════════════════════════════════════════════════════════
// KARTICA NAROČILA — prikaz posameznega naročila v vrstnem redu
// ═══════════════════════════════════════════════════════════════

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Clock, AlertTriangle, CheckCircle2, ChefHat, UtensilsCrossed, Zap, Package, Flame } from 'lucide-react'
import { PRIORITY_CONFIG, CATEGORY_ICONS, STATUS_LABELS, getTimeWarning } from './constants'
import type { OrderCardProps } from './constants'

export const OrderCard = memo(function OrderCard({
  order, viewMode, onItemStatus, onOrderStatus,
}: OrderCardProps) {
  const priority = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG.normal
  const timeWarning = getTimeWarning(order.elapsedMinutes)
  const progress = order.estimatedPrepMinutes > 0
    ? Math.min(100, (order.elapsedMinutes / order.estimatedPrepMinutes) * 100)
    : 0

  return (
    <Card className={`border-2 ${priority.border} ${viewMode === 'grid' ? '' : 'compact'}`}>
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">#{order.orderNumber}</span>
            <Badge className={`${priority.bg} ${priority.color} text-[10px] font-bold`}>
              {priority.label}
            </Badge>
          </div>
          <div className={`flex items-center gap-1 text-xs font-mono ${timeWarning.color}`}>
            <Clock className="h-3 w-3" />
            {order.elapsedMinutes} min
          </div>
        </div>

        {/* Table / Type info */}
        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
          {order.type === 'dine-in' && order.table ? (
            <span className="flex items-center gap-1">
              <UtensilsCrossed className="h-3 w-3" />
              Miza {order.table.number}
            </span>
          ) : order.type === 'takeout' ? (
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              Za s seboj
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Dostava
            </span>
          )}
          {order.customerName && <span>· {order.customerName}</span>}
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <Progress
            value={progress}
            className={`h-1.5 ${progress > 100 ? '[&>div]:bg-red-500' : progress > 75 ? '[&>div]:bg-amber-500' : '[&>div]:bg-blue-500'}`}
            aria-valuetext={progress > 100 ? 'Nujno — presežen čas' : progress > 75 ? 'V pripravi — skoraj končano' : 'V pripravi'}
          />
          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
            <span>{order.elapsedMinutes} min</span>
            <span>~{order.estimatedPrepMinutes} min predvideno</span>
          </div>
        </div>

        {/* Items list */}
        <div className="space-y-1.5">
          {order.orderItems?.map(item => {
            const CatIcon = CATEGORY_ICONS[item.menuItem?.category?.name || ''] || ChefHat
            return (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => {
                      const nextStatus = item.status === 'pending' ? 'preparing' : item.status === 'preparing' ? 'ready' : 'served'
                      onItemStatus(item.id, nextStatus)
                    }}
                    className={`h-2 w-2 rounded-full flex-shrink-0 cursor-pointer transition-colors ${
                      item.status === 'ready' ? 'bg-emerald-500' :
                      item.status === 'preparing' ? 'bg-blue-500' :
                      'bg-yellow-500'
                    }`}
                    title={`Klikni za napredek: ${item.status}`}
                    aria-label={`Spremeni status: ${item.status}`}
                  />
                  <CatIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs truncate">{item.quantity}x {item.menuItem?.name || 'Artikel'}</span>
                </div>
                <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">
                  {STATUS_LABELS[item.status] || item.status}
                </Badge>
              </div>
            )
          })}
        </div>

        {/* Special notes — posebna navodila */}
        {order.specialInstructions && (
          <div className="mt-2 p-1.5 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-[10px] text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              {order.specialInstructions}
            </p>
          </div>
        )}

        {/* Action button — dejanje */}
        <div className="mt-2">
          <Button
            size="sm"
            variant={order.status === 'pending' ? 'default' : order.status === 'preparing' ? 'secondary' : 'outline'}
            className="w-full text-xs gap-1"
            onClick={() => onOrderStatus(order.id)}
          >
            {order.status === 'pending' && <><Flame className="h-3 w-3" /> Začni pripravo</>}
            {order.status === 'preparing' && <><CheckCircle2 className="h-3 w-3" /> Pripravljeno</>}
            {order.status === 'ready' && <><Package className="h-3 w-3" /> Zaključi</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})
