'use client'

import { memo } from 'react'

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
      <div className="flex justify-between text-muted-foreground">
        <span>Vmesna vsota (brez DDV)</span>
        <span>€{subtotal.toFixed(2)}</span>
      </div>
      {/* Multi-DDV prikaz po stopnjah */}
      {Object.entries(vatBreakdown).map(([rate, data]) => (
        <div key={rate} className="flex justify-between text-muted-foreground">
          <span>DDV {rate}%</span>
          <span>€{data.vat.toFixed(2)} <span className="text-[9px] opacity-60">(osn. €{data.base.toFixed(2)})</span></span>
        </div>
      ))}
      <div className="flex justify-between text-muted-foreground font-medium">
        <span>Skupaj DDV</span>
        <span>€{totalTax.toFixed(2)}</span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between text-emerald-600">
          <span>Popust</span>
          <span>-€{discount.toFixed(2)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-base pt-1">
        <span>Skupaj z DDV</span>
        <span>€{Math.max(0, total).toFixed(2)}</span>
      </div>
    </div>
  )
})
