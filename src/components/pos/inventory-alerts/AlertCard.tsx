'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, Clock, ShoppingCart, TrendingDown } from 'lucide-react'
import { SEVERITY_CONFIG, type AlertCardProps } from './constants'

// Posamezna kartica opozorila
export const AlertCard = memo(function AlertCard({ alert, isAutoOrdering, onAutoOrder, onMarkRestocked }: AlertCardProps) {
  const config = SEVERITY_CONFIG[alert.severity]
  const Icon = config.icon
  const stockPercent = alert.minStock > 0
    ? Math.min(100, Math.round((alert.currentStock / alert.minStock) * 100))
    : 0

  return (
    <Card className={`${config.border} transition-all hover:shadow-md`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`h-4 w-4 ${alert.severity === 'critical' ? 'text-red-500' : alert.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} />
              <span className="font-medium truncate">{alert.itemName}</span>
              <Badge className={config.badge}>{config.label}</Badge>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Trenutna zaloga</p>
                <p className="font-semibold">{alert.currentStock} {alert.unit}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Minimalna zaloga</p>
                <p className="font-semibold">{alert.minStock} {alert.unit}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Dnevna poraba</p>
                <p className="font-semibold">{alert.dailyUsage} {alert.unit}/dan</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Dni do praznine</p>
                <p className={`font-semibold ${alert.daysUntilEmpty <= 2 ? 'text-red-600' : alert.daysUntilEmpty <= 5 ? 'text-amber-600' : 'text-blue-600'}`}>
                  {alert.daysUntilEmpty >= 999 ? '∞' : alert.daysUntilEmpty}
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Zaloga</span>
                <span>{stockPercent}% minimalne</span>
              </div>
              <Progress
                value={stockPercent}
                className={`h-2 ${stockPercent <= 25 ? '[&>div]:bg-red-500' : stockPercent <= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-green-500'}`}
                aria-valuetext={stockPercent <= 25 ? 'Kritično nizka zaloga' : stockPercent <= 50 ? 'Nizka zaloga' : 'Zadostna zaloga'}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {alert.supplier && (
                <span className="flex items-center gap-1">
                  <ShoppingCart className="h-3 w-3" />
                  {alert.supplier}
                </span>
              )}
              {alert.lastRestocked && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Zadnji naklad: {new Date(alert.lastRestocked).toLocaleDateString('sl-SI')}
                </span>
              )}
              {alert.autoOrderSuggested && (
                <span className="flex items-center gap-1 text-orange-600">
                  <TrendingDown className="h-3 w-3" />
                  Predlagano naročilo: {alert.suggestedOrderQty} {alert.unit}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {alert.autoOrderSuggested && (
              <Button
                size="sm"
                variant="default"
                onClick={() => onAutoOrder(alert)}
                disabled={isAutoOrdering}
                className="whitespace-nowrap"
                aria-label={`Naroči ${alert.suggestedOrderQty} ${alert.unit}`}
              >
                {isAutoOrdering ? (
                  <><Clock className="h-3 w-3 mr-1 animate-spin" /> Naročam...</>
                ) : (
                  <><ShoppingCart className="h-3 w-3 mr-1" /> Naroči {alert.suggestedOrderQty} {alert.unit}</>
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onMarkRestocked(alert.id)}
              className="whitespace-nowrap"
              aria-label="Označi kot nakladano"
            >
              <CheckCircle className="h-3 w-3 mr-1" /> Nakladano
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
