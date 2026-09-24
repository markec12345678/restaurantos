'use client'

import { memo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2, Plus } from 'lucide-react'
import { PERIOD_LABELS } from './constants'
import type { WasteHeaderProps } from './constants'
import { WasteRecordDialog } from './WasteRecordDialog'

// ============================================
// GLAVA SLEDENJA ODPADKOM (+ zabeležba odpada, R119)
// ============================================
export const WasteHeader = memo(function WasteHeader({
  period,
  onPeriodChange,
  onRecorded,
}: WasteHeaderProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
          <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Sledenje odpadkom</h2>
          <p className="text-sm text-muted-foreground">Odpadki so razknjiženi iz zaloge (waste ledger)</p>
        </div>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <Button size="sm" variant="destructive" onClick={() => setDialogOpen(true)} aria-label="Zabeleži nov odpad">
          <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
          Zabeleži odpad
        </Button>
        {(['week', 'month', 'quarter'] as const).map(p => (
          <Button key={p} variant={period === p ? 'default' : 'outline'} size="sm" onClick={() => onPeriodChange(p)} aria-label={`Izberi obdobje: ${PERIOD_LABELS[p]}`}>
            {PERIOD_LABELS[p]}
          </Button>
        ))}
      </div>
      <WasteRecordDialog open={dialogOpen} onOpenChange={setDialogOpen} onRecorded={onRecorded} />
    </div>
  )
})
