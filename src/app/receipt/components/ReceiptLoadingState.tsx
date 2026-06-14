'use client'

import { memo } from 'react'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Stanje nalaganja računa
// ═══════════════════════════════════════════════════════════════

export const ReceiptLoadingState = memo(function ReceiptLoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mx-auto" />
        <p className="mt-4 text-amber-800">Nalagam racun...</p>
      </div>
    </div>
  )
})
