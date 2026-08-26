'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, BellRing, Package } from 'lucide-react'
import { type AlertSummaryCardsProps } from './constants'

// Povzetek kartic po resnosti
export const AlertSummaryCards = memo(function AlertSummaryCards({ criticalCount, warningCount, lowCount }: AlertSummaryCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="border-red-200 dark:border-red-800">
        <CardContent className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <BellRing className="h-4 w-4 text-red-500" />
            <span className="text-2xl font-bold text-red-600">{criticalCount}</span>
          </div>
          <p className="text-xs text-muted-foreground">Kritično</p>
        </CardContent>
      </Card>
      <Card className="border-amber-200 dark:border-amber-800">
        <CardContent className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-2xl font-bold text-amber-600">{warningCount}</span>
          </div>
          <p className="text-xs text-muted-foreground">Opozorilo</p>
        </CardContent>
      </Card>
      <Card className="border-blue-200 dark:border-blue-800">
        <CardContent className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Package className="h-4 w-4 text-blue-500" />
            <span className="text-2xl font-bold text-blue-600">{lowCount}</span>
          </div>
          <p className="text-xs text-muted-foreground">Nizka zaloga</p>
        </CardContent>
      </Card>
    </div>
  )
})
