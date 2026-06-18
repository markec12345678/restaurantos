'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Split } from 'lucide-react'
import { safeToFixed, safeNum } from '@/lib/safe-format'

interface SplitPaymentTabProps {
  splitCount: number
  setSplitCount: (_val: number) => void
  totalWithTip: number
  tipAmount: number
  splitAmount: number
  isProcessing: boolean
  processPaymentIsPending: boolean
  onPaySplit: () => void
}

export const SplitPaymentTab = memo(function SplitPaymentTab({
  splitCount,
  setSplitCount,
  totalWithTip,
  tipAmount,
  splitAmount,
  isProcessing,
  processPaymentIsPending,
  onPaySplit,
}: SplitPaymentTabProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold mb-2">Število oseb</p>
        <div className="flex gap-1.5">
          {[2, 3, 4, 5, 6].map(n => (
            <button
              key={n}
              onClick={() => setSplitCount(n)}
              aria-label={`${n} oseb`}
              aria-pressed={splitCount === n}
              className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors ${
                splitCount === n
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Vsaka oseba plača</p>
          <p className="text-3xl font-bold text-primary">€{safeToFixed(splitAmount, 2)}</p>
        </div>
        <Separator />
        <div className="space-y-1">
          {Array.from({ length: splitCount }).map((_, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground">Oseba {i + 1}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">€{safeToFixed(splitAmount, 2)}</span>
              </div>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Skupaj ({splitCount} oseb)</span>
          <span className="font-bold">€{safeToFixed(totalWithTip, 2)}</span>
        </div>
        {tipAmount > 0 && (
          <div className="flex justify-between text-xs text-rose-600">
            <span>Od tega napitnina</span>
            <span>€{safeToFixed(tipAmount, 2)} (€{safeToFixed(tipAmount / splitCount, 2)}/osebo)</span>
          </div>
        )}
      </div>
      <Button
        className="w-full h-12 text-base font-bold"
        disabled={processPaymentIsPending || isProcessing}
        onClick={onPaySplit}
      >
        {processPaymentIsPending ? (
          'Obdelujem...'
        ) : (
          <>
            <Split className="h-4 w-4 mr-2" aria-hidden="true" />
            Plačaj deljeno ({splitCount}x €{safeToFixed(splitAmount, 2)})
          </>
        )}
      </Button>
    </div>
  )
})
