'use client'

// ─── Header z izbiro obdobja ──────────────────────────────────

import { memo } from 'react'
import { Trophy } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PERIOD_LABELS, type PerformanceHeaderProps } from './constants'

export const PerformanceHeader = memo(function PerformanceHeader({
  period,
  onPeriodChange,
}: PerformanceHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-500" aria-label="Trofeja" />
          Učinkovitost zaposlenih
        </h2>
        <p className="text-muted-foreground text-sm">
          Analitika in ocena za {PERIOD_LABELS[period] || period}
        </p>
      </div>
      <Select value={period} onValueChange={onPeriodChange}>
        <SelectTrigger className="w-40" aria-label="Izberi obdobje">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Danes</SelectItem>
          <SelectItem value="week">Zadnji teden</SelectItem>
          <SelectItem value="month">Ta mesec</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
})
