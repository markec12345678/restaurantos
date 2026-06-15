'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Clock, Sun, Moon, Save, RotateCcw, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ============================================
// DAILY CHECKLIST HEADER
// ============================================

interface ChecklistHeaderProps {
  type: 'opening' | 'closing'
  onTypeChange: (_type: 'opening' | 'closing', _resetFn: () => void) => void
  resetFn: () => void
}

export const ChecklistHeader = memo(function ChecklistHeader({ type, onTypeChange, resetFn }: ChecklistHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          Kontrolni seznam
        </h2>
        <p className="text-sm text-muted-foreground">
          {type === 'opening' ? 'Odpiralni' : 'Zapiralni'} seznam za {new Date().toLocaleDateString('sl-SI')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant={type === 'opening' ? 'default' : 'outline'} size="sm" onClick={() => onTypeChange('opening', resetFn)} className="gap-1">
          <Sun className="h-3 w-3" /> Odpiranje
        </Button>
        <Button variant={type === 'closing' ? 'default' : 'outline'} size="sm" onClick={() => onTypeChange('closing', resetFn)} className="gap-1">
          <Moon className="h-3 w-3" /> Zapiranje
        </Button>
      </div>
    </div>
  )
})

// ============================================
// DAILY CHECKLIST PROGRESS CARD
// ============================================

interface ChecklistProgressProps {
  completedCount: number
  totalCount: number
  progressPct: number
  allCompleted: boolean
}

export const ChecklistProgress = memo(function ChecklistProgress({ completedCount, totalCount, progressPct, allCompleted }: ChecklistProgressProps) {
  return (
    <Card className={allCompleted ? 'border-emerald-400 dark:border-emerald-700' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {allCompleted ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Clock className="h-5 w-5 text-amber-500" />}
            <span className="font-bold">{allCompleted ? 'Zaključeno!' : `${completedCount}/${totalCount} opravljenih`}</span>
          </div>
          <Badge variant={allCompleted ? 'default' : 'secondary'}>{progressPct.toFixed(0)}%</Badge>
        </div>
        <Progress value={progressPct} className={`h-2 ${allCompleted ? '[&>div]:bg-emerald-500' : ''}`} aria-valuetext={allCompleted ? 'Zaključeno' : 'V teku'} />
      </CardContent>
    </Card>
  )
})

// ============================================
// DAILY CHECKLIST ACTIONS
// ============================================

interface ChecklistActionsProps {
  allCompleted: boolean
  onSave: () => void
  isSavePending: boolean
  onReset: () => void
}

export const ChecklistActions = memo(function ChecklistActions({ allCompleted, onSave, isSavePending, onReset }: ChecklistActionsProps) {
  return (
    <div className="flex items-center gap-3">
      <Button onClick={onSave} disabled={isSavePending} className="gap-1 flex-1">
        <Save className="h-4 w-4" />{allCompleted ? 'Zaključi seznam' : 'Shrani napredek'}
      </Button>
      <Button variant="outline" onClick={onReset} className="gap-1">
        <RotateCcw className="h-4 w-4" />Ponastavi
      </Button>
    </div>
  )
})
