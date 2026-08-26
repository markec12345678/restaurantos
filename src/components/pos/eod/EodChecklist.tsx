'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import type { EodChecklistProps } from './constants'

// ============================================
// EOD CHECKLIST - Predpogoji za zaključek dneva
// ============================================
export const EodChecklist = memo(function EodChecklist({
  eodChecks,
  completedChecks,
  allChecksDone,
  onToggleCash,
  onToggleChecklist,
}: EodChecklistProps) {
  return (
    <Card className={allChecksDone ? 'border-emerald-300 dark:border-emerald-800' : 'border-amber-300 dark:border-amber-800'}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Predpogoji za zaključek dneva ({completedChecks}/{eodChecks.length})
          </h3>
          <Progress value={(completedChecks / eodChecks.length) * 100} className="h-2 w-32" />
        </div>
        <div className="space-y-2">
          {eodChecks.map((check, idx) => {
            // FIX: Interaktivni kontrolni elementi za gotovino in seznam
            const isCashCheck = check.label === 'Gotovina usklajena'
            const isChecklistCheck = check.label === 'Dnevni kontrolni seznam zaključen'
            const isInteractive = isCashCheck || isChecklistCheck

            return (
              <div key={idx} className="flex items-center gap-2 text-sm">
                {isInteractive ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isCashCheck) onToggleCash()
                      if (isChecklistCheck) onToggleChecklist()
                    }}
                    className="focus:outline-none"
                    aria-label={check.label}
                  >
                    {check.done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-amber-500" />
                    )}
                  </button>
                ) : check.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-amber-500" />
                )}
                <span className={check.done ? 'line-through text-muted-foreground' : ''}>{check.label}</span>
                {isInteractive && !check.done && (
                  <span className="text-[10px] text-muted-foreground">(kliknite za potrditev)</span>
                )}
              </div>
            )
          })}
        </div>
        {!allChecksDone && (
          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Rešite vse predpogoje pred zaključkom dneva
          </p>
        )}
      </CardContent>
    </Card>
  )
})
