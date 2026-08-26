'use client'

import { memo } from 'react'
import { safeToFixed, safeNum } from '@/lib/safe-format'

interface POTotalsProps {
  subtotal: number
  vatAmount: number
  total: number
}

export const POTotals = memo(function POTotals({ subtotal, vatAmount, total }: POTotalsProps) {
  return (
    <div className="flex justify-end p-3 rounded-lg bg-muted/50">
      <div className="text-right space-y-1">
        <div className="flex justify-between gap-8 text-xs">
          <span className="text-muted-foreground">Vmesna vsota:</span>
          <span className="font-medium">&euro;{safeToFixed(subtotal, 2)}</span>
        </div>
        <div className="flex justify-between gap-8 text-xs">
          <span className="text-muted-foreground">DDV:</span>
          <span className="font-medium">&euro;{safeToFixed(vatAmount, 2)}</span>
        </div>
        <div className="flex justify-between gap-8 text-sm border-t pt-1">
          <span className="font-bold">SKUPAJ:</span>
          <span className="font-bold">&euro;{safeToFixed(total, 2)}</span>
        </div>
      </div>
    </div>
  )
})
