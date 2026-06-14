'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList, AlertTriangle, XCircle, Clock } from 'lucide-react'

interface HaccpSummaryCardsProps {
  todayCount: number
  warningCount: number
  criticalCount: number
  lastEntryTime: string
}

export const HaccpSummaryCards = memo(function HaccpSummaryCards({
  todayCount,
  warningCount,
  criticalCount,
  lastEntryTime,
}: HaccpSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{todayCount}</p>
              <p className="text-xs text-muted-foreground">Vnosi danes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={`hover:shadow-md transition-shadow ${warningCount > 0 ? 'border-amber-200 dark:border-amber-800' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{warningCount}</p>
              <p className="text-xs text-muted-foreground">Opozorila</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={`hover:shadow-md transition-shadow ${criticalCount > 0 ? 'border-red-200 dark:border-red-800' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Kritični vnosi</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">{lastEntryTime}</p>
              <p className="text-xs text-muted-foreground">Zadnji vnos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
