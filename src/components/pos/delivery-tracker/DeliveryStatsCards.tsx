'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Truck, CheckCircle2, Timer } from 'lucide-react'
import type { DeliveryStatsCardsProps } from './constants'

// ============================================
// DELIVERY STATS CARDS - Statistika dostav
// ============================================
export const DeliveryStatsCards = memo(function DeliveryStatsCards({
  activeCount,
  deliveredCount,
  avgDeliveryTime,
}: DeliveryStatsCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Truck className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold">{activeCount}</div>
            <div className="text-xs text-muted-foreground">Aktivne dostave</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold">{deliveredCount}</div>
            <div className="text-xs text-muted-foreground">Dostavljene</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Timer className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-bold">
              {avgDeliveryTime}
            </div>
            <div className="text-xs text-muted-foreground">Povprečen čas</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
