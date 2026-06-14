'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Receipt } from 'lucide-react'
import type { TaxReportData } from './constants'

interface TaxReportHeaderProps {
  data: TaxReportData
  period: 'month' | 'quarter' | 'year'
  onPeriodChange: (_period: 'month' | 'quarter' | 'year') => void
}

export const TaxReportHeader = memo(function TaxReportHeader({
  data,
  period,
  onPeriodChange,
}: TaxReportHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
          <Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Davčno poročilo</h2>
          <p className="text-sm text-muted-foreground">DDV poročilo za FURS — {data.period}</p>
        </div>
      </div>
      <div className="flex gap-2">
        {(['month', 'quarter', 'year'] as const).map(p => (
          <Button key={p} variant={period === p ? 'default' : 'outline'} size="sm" onClick={() => onPeriodChange(p)}>
            {p === 'month' ? 'Mesec' : p === 'quarter' ? 'Četrtletje' : 'Leto'}
          </Button>
        ))}
      </div>
    </div>
  )
})
