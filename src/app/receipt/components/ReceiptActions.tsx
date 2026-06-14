'use client'

import { memo } from 'react'
import { Printer, Share2 } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Akcijski gumbi (natisni, deli)
// ═══════════════════════════════════════════════════════════════

interface ReceiptActionsProps {
  receiptNumber: string
}

export const ReceiptActions = memo(function ReceiptActions({
  receiptNumber,
}: ReceiptActionsProps) {
  return (
    <div className="flex gap-2 mt-4">
      <button
        onClick={() => window.print()}
        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white shadow-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors touch-manipulation min-h-[48px]"
        aria-label="Natisni racun"
      >
        <Printer className="w-4 h-4" /> Natisni
      </button>
      <button
        onClick={() => {
          if (navigator.share) {
            navigator.share({
              title: `Racun ${receiptNumber}`,
              url: window.location.href,
            })
          }
        }}
        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors touch-manipulation min-h-[48px]"
        aria-label="Deli racun"
      >
        <Share2 className="w-4 h-4" /> Deli
      </button>
    </div>
  )
})
