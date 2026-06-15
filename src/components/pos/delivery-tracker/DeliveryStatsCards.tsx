'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Truck, CheckCircle2, Clock } from 'lucide-react'

interface DeliveryStatsCardsProps {
  activeCount: number
  deliveredCount: number
  avgDeliveryTime: string
}

export const DeliveryStatsCards = memo(function DeliveryStatsCards({ activeCount, deliveredCount, avgDeliveryTime }: DeliveryStatsCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm text-muted-foreground">Aktivne</p>
              <p className="text-2xl font-bold">{activeCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Dostavljene</p>
              <p className="text-2xl font-bold">{deliveredCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Povp. čas</p>
              <p className="text-2xl font-bold">{avgDeliveryTime}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
