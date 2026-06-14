'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { STORNO_REASONS, CANCEL_REASONS } from './constants'
import type { ReasonSelectorProps } from './constants'

// ============================================
// IZBIRA RAZLOGA ZA STORNO/PREKIC
// ============================================
export const ReasonSelector = memo(function ReasonSelector({
  isPaid,
  selectedReason,
  customReason,
  onReasonSelect,
  onCustomReasonChange,
}: ReasonSelectorProps) {
  const reasons = isPaid ? STORNO_REASONS : CANCEL_REASONS
  const label = isPaid ? 'Razlog za storno' : 'Razlog za preklic'
  const requiredColor = isPaid ? 'text-red-500' : 'text-amber-500'
  const activeBorder = isPaid ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
  const placeholder = isPaid ? 'Vnesite razlog za storno...' : 'Vnesite razlog za preklic...'

  return (
    <>
      <div>
        <p className="text-sm font-semibold mb-2">
          {label} <span className={requiredColor}>*</span>
          {isPaid && <span className="text-xs text-muted-foreground ml-1">(FURS zahteva)</span>}
        </p>
        <div className="space-y-1.5">
          {reasons.map((reason) => (
            <button
              key={reason.id}
              onClick={() => onReasonSelect(reason.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                selectedReason === reason.id
                  ? activeBorder
                  : 'border-border hover:bg-accent'
              }`}
              autoFocus={reason.id === reasons[0].id}
            >
              <div className="font-medium">{reason.name}</div>
              <div className="text-xs text-muted-foreground">{reason.description}</div>
            </button>
          ))}
        </div>
      </div>

      {selectedReason === 'other' && (
        <Input
          placeholder={placeholder}
          value={customReason}
          onChange={e => onCustomReasonChange(e.target.value)}
          className="h-8 text-xs"
        />
      )}
    </>
  )
})
