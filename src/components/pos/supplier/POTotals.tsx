'use client'

import { memo } from 'react'
import { formatEUR } from '@/lib/safe-format'

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
          <span className="font-medium">{formatEUR(subtotal)}</span>
        </div>
        <div className="flex justify-between gap-8 text-xs">
          <span className="text-muted-foreground">DDV:</span>
          <span className="font-medium">{formatEUR(vatAmount)}</span>
        </div>
        <div className="flex justify-between gap-8 text-sm border-t pt-1">
          <span className="font-bold">SKUPAJ:</span>
          <span className="font-bold">{formatEUR(total)}</span>
        </div>
      </div>
    </div>
  )
})
