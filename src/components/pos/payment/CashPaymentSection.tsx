'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { quickCashAmounts } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

interface CashPaymentSectionProps {
  totalWithTip: number
  cashReceived: number
  setCashReceived: (_val: number) => void
  setTipAmount: (_val: number) => void
  setTipPercent: (_val: number) => void
}

export const CashPaymentSection = memo(function CashPaymentSection({
  totalWithTip,
  cashReceived,
  setCashReceived,
  setTipAmount,
  setTipPercent,
}: CashPaymentSectionProps) {
  const cashChange = Math.max(0, cashReceived - totalWithTip)

  return (
    <div>
      <p className="text-xs font-semibold mb-1.5">Hitri zneski</p>
      <div className="flex gap-1.5 mb-2">
        {quickCashAmounts.map(amount => {
          return (
            <button
              key={amount}
              onClick={() => {
                setCashReceived(amount)
                if (amount > totalWithTip) {
                  setTipAmount(0)
                  setTipPercent(0)
                }
              }}
              aria-label={`€${amount} gotovina`}
              className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors touch-manipulation ${
                amount >= totalWithTip
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              €{amount}
            </button>
          )
        })}
      </div>
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Znesek za plačilo:</span>
          <span className="font-bold">€{safeToFixed(totalWithTip, 2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Prejeto:</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={cashReceived || ''}
            onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
            className="h-7 text-xs w-24"
            placeholder={safeToFixed(totalWithTip, 2)}
            aria-label="Prejeta gotovina"
          />
          <span className="text-xs">€</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold">Vračilo:</span>
          <span className={`font-bold ${cashChange > 0 ? 'text-emerald-700 dark:text-emerald-400' : cashReceived > 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`} aria-live="polite">€{safeToFixed(cashChange, 2)}</span>
        </div>
      </div>
    </div>
  )
})
