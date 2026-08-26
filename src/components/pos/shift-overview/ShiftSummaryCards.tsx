'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { UserCheck, Coffee, Clock, Timer } from 'lucide-react'
import type { ShiftSummaryCardsProps } from './constants'

// Povzetek izmen — števci za stanja zaposlenih
export const ShiftSummaryCards = memo(function ShiftSummaryCards({
  clockedInCount,
  onBreakCount,
  scheduledCount,
  totalHoursToday,
}: ShiftSummaryCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-3 text-center">
          <UserCheck className="h-5 w-5 text-green-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{clockedInCount}</p>
          <p className="text-xs text-muted-foreground">Na delu</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Coffee className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{onBreakCount}</p>
          <p className="text-xs text-muted-foreground">Na odmoru</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Clock className="h-5 w-5 text-blue-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{scheduledCount}</p>
          <p className="text-xs text-muted-foreground">Načrtovani</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Timer className="h-5 w-5 text-purple-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{Math.round(totalHoursToday * 10) / 10}h</p>
          <p className="text-xs text-muted-foreground">Ure danes</p>
        </CardContent>
      </Card>
    </div>
  )
})
