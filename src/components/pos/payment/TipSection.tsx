'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Heart } from 'lucide-react'
import { tipPresets } from './constants'

// ============================================
// IZBIRA NAPITNINE
// ============================================

interface TipSectionProps {
  tipAmount: number
  tipPercent: number
  orderTotal: number
  totalWithTip: number
  onTipPercent: (_pct: number) => void
  onCustomTip: (_val: string) => void
}

export const TipSection = memo(function TipSection({
  tipAmount,
  tipPercent,
  orderTotal: _orderTotal,
  totalWithTip,
  onTipPercent,
  onCustomTip,
}: TipSectionProps) {
  return (
    <div>
      {/* Napitnina */}
      <div className="flex items-center gap-2 mb-2">
        <Heart className="h-4 w-4 text-rose-500" />
        <span className="text-sm font-semibold">Napitnina</span>
      </div>
      <div className="flex gap-1.5 mb-2">
        {tipPresets.map(pct => (
          <button
            key={pct}
            onClick={() => onTipPercent(pct)}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              tipPercent === pct && (pct > 0 || tipAmount === 0)
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {pct === 0 ? 'Brez' : `${pct}%`}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Znesek:</span>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={tipAmount || ''}
          onChange={e => onCustomTip(e.target.value)}
          className="h-7 text-xs w-24"
          placeholder="0.00"
          aria-label="Znesek napitnine"
          autoFocus
        />
        <span className="text-xs text-muted-foreground">€</span>
      </div>
      {tipAmount > 0 && (
        <div className="flex justify-between font-bold text-base bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg mt-2">
          <span className="flex items-center gap-2"><Heart className="h-3.5 w-3.5 text-rose-500" /> Skupaj z napitnino</span>
          <span>€{totalWithTip.toFixed(2)}</span>
        </div>
      )}
    </div>
  )
})
