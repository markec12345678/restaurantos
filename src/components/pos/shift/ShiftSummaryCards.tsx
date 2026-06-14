'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, Play, CheckCircle2, Timer } from 'lucide-react'
import { ShiftSummaryCardsProps } from './constants'

// ============================================
// POVZETEK IZMEN IN UR
// ============================================

export const ShiftSummaryCards = memo(function ShiftSummaryCards({
  scheduledCount,
  inProgressCount,
  completedCount,
  totalHoursToday,
}: ShiftSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{scheduledCount}</p>
              <p className="text-xs text-muted-foreground">Načrtovane</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              <Play className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{inProgressCount}</p>
              <p className="text-xs text-muted-foreground">V teku</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{completedCount}</p>
              <p className="text-xs text-muted-foreground">Zaključene</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalHoursToday.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">Ure danes</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
