'use client'

import { memo } from 'react'
import { UtensilsCrossed } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Stanje napake za sledenje naročila
// ═══════════════════════════════════════════════════════════════

interface ErrorStateProps {
  error: string
}

export const ErrorState = memo(function ErrorState({ error }: ErrorStateProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <UtensilsCrossed className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-30" />
        <h1 className="text-2xl font-bold mb-2">Naročilo ni najdeno</h1>
        <p className="text-muted-foreground">{error || 'Preverite povezavo in poskusite znova.'}</p>
      </div>
    </div>
  )
})
