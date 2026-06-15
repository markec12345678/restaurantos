'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PeriodType } from '../constants'

// ============================================
// Navigacija po datumih za poročilo po obdobju
// ============================================

interface PeriodReportHeaderProps {
  period: PeriodType
  refDate: string
  setRefDate: (_d: string) => void
  navigateDate: (_dir: number) => void
  periodLabel: string
}

export const PeriodReportHeader = memo(function PeriodReportHeader({
  period: _period,
  refDate,
  setRefDate,
  navigateDate,
  periodLabel,
}: PeriodReportHeaderProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <Button variant="outline" size="icon" aria-label="Nazaj" onClick={() => navigateDate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="text-center min-w-48">
        <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="text-center w-40 mx-auto" aria-label="Datum poročila" />
        <p className="text-sm text-muted-foreground mt-1">{periodLabel}</p>
      </div>
      <Button variant="outline" size="icon" aria-label="Naprej" onClick={() => navigateDate(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
})
