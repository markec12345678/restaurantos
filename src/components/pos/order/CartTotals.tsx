'use client'

import { memo } from 'react'
import { formatEUR } from '@/lib/safe-format'

// --- Props ---

interface CartTotalsProps {
  subtotal: number
  vatBreakdown: Record<string, { base: number; vat: number }>
  totalTax: number
  discount: number
  total: number
}

// --- Komponenta ---

export const CartTotals = memo(function CartTotals({
  subtotal,
  vatBreakdown,
  totalTax,
  discount,
  total,
}: CartTotalsProps) {
  return (
    <div className="px-3 py-2 space-y-0.5 text-xs">
      {/* P2-UX FIX (decimalna vejica): formatEUR — "1.234,56 €" (sl-SI) namesto pike */}
      <div className="flex justify-between text-muted-foreground">
        <span>Vmesna vsota (brez DDV)</span>
        <span>{formatEUR(subtotal)}</span>
      </div>
      {/* Multi-DDV prikaz po stopnjah */}
      {Object.entries(vatBreakdown).map(([rate, data]) => (
        <div key={rate} className="flex justify-between text-muted-foreground">
          <span>DDV {rate}%</span>
          <span>{formatEUR(data.vat)} <span className="text-[9px] opacity-60">(osn. {formatEUR(data.base)})</span></span>
        </div>
      ))}
      <div className="flex justify-between text-muted-foreground font-medium">
        <span>Skupaj DDV</span>
        <span>{formatEUR(totalTax)}</span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between text-emerald-600">
          <span>Popust</span>
          <span>-{formatEUR(discount)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-base pt-1">
        <span>Skupaj z DDV</span>
        <span>{formatEUR(Math.max(0, total))}</span>
      </div>
    </div>
  )
})
