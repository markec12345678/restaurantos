'use client'

// ─── Header z izbiro obdobja za P&L porocilo ──────────────────

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { PERIOD_LABELS, type PnlHeaderProps, type PnLPeriod } from './constants'

const PERIODS: PnLPeriod[] = ['today', 'week', 'month', 'quarter']

export const PnlHeader = memo(function PnlHeader({
  period,
  onPeriodChange,
  isProfitable,
  periodName,
}: PnlHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isProfitable ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
          {isProfitable ? (
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
          )}
        </div>
        <div>
          <h2 className="text-lg font-semibold">P&L Porocilo</h2>
          <p className="text-sm text-muted-foreground">Profit & Loss — {periodName}</p>
        </div>
      </div>
      <div className="flex gap-2">
        {PERIODS.map(p => (
          <Button
            key={p}
            variant={period === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPeriodChange(p)}
            aria-label={`Izberi obdobje ${PERIOD_LABELS[p]}`}
          >
            {PERIOD_LABELS[p]}
          </Button>
        ))}
      </div>
    </div>
  )
})
