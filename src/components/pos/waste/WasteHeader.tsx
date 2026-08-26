'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { PERIOD_LABELS } from './constants'
import type { WasteHeaderProps } from './constants'

// ============================================
// GLAVA SLEDENJA ODPADKOM
// ============================================
export const WasteHeader = memo(function WasteHeader({
  period,
  onPeriodChange,
}: WasteHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
          <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Sledenje odpadkom</h2>
          <p className="text-sm text-muted-foreground">Analiza odpadkov in izgub v kuhinji</p>
        </div>
      </div>
      <div className="flex gap-2">
        {(['week', 'month', 'quarter'] as const).map(p => (
          <Button key={p} variant={period === p ? 'default' : 'outline'} size="sm" onClick={() => onPeriodChange(p)} aria-label={`Izberi obdobje: ${PERIOD_LABELS[p]}`}>
            {PERIOD_LABELS[p]}
          </Button>
        ))}
      </div>
    </div>
  )
})
