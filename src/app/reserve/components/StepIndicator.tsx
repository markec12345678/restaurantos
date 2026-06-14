'use client'

import { memo } from 'react'
import type { ReservationStep } from '../types'

// =====================================================================
// Indikator korakov rezervacije
// =====================================================================

interface StepIndicatorProps {
  step: ReservationStep
}

export const StepIndicator = memo(function StepIndicator({ step }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      {[
        { num: 1, label: 'Podatki', active: step === 'details' },
        { num: 2, label: 'Potrditev', active: step === 'confirm' },
        { num: 3, label: 'Potrjeno', active: false },
      ].map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
            s.active ? 'bg-primary text-primary-foreground' : i < (step === 'confirm' ? 1 : 0) ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
          }`}>
            {s.num}
          </div>
          <span className={`text-sm font-medium hidden sm:inline ${s.active ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
          {i < 2 && <div className="w-8 h-0.5 bg-muted" />}
        </div>
      ))}
    </div>
  )
})
