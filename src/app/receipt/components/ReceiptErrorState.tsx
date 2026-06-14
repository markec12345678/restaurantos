'use client'

import { memo } from 'react'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Stanje napake / račun ni na voljo
// ═══════════════════════════════════════════════════════════════

interface ReceiptErrorStateProps {
  error: string
}

export const ReceiptErrorState = memo(function ReceiptErrorState({ error }: ReceiptErrorStateProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center">
      <div className="text-center bg-white rounded-2xl shadow-lg p-8 mx-4 max-w-md">
        <div className="text-4xl mb-4">&#x1F4C4;</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Racun ni na voljo</h2>
        <p className="text-gray-500">{error || 'Racun s tem ID-jem ne obstaja'}</p>
      </div>
    </div>
  )
})
