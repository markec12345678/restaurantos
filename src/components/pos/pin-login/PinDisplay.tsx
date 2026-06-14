'use client'

import { memo } from 'react'
import type { PinDisplayProps } from './constants'

// ============================================
// PRIKAZ PIN PIK — Vizualizacija vnesenega PIN-a
// ============================================

export const PinDisplay = memo(function PinDisplay({ pinLength }: PinDisplayProps) {
  return (
    <div className="flex justify-center gap-2" role="status" aria-label={`Vnesenih ${pinLength} od 4 števk`}>
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          className={`h-10 w-10 rounded-lg border-2 flex items-center justify-center transition-colors ${
            i < pinLength
              ? 'border-primary bg-primary/10'
              : 'border-border'
          }`}
          aria-hidden="true"
        >
          {i < pinLength && (
            <div className="h-3 w-3 rounded-full bg-primary" />
          )}
        </div>
      ))}
    </div>
  )
})
