'use client'

import { memo } from 'react'
import { Loader2 } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Stanje nalaganja za sledenje naročila
// ═══════════════════════════════════════════════════════════════

export const LoadingState = memo(function LoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Iskanje naročila...</p>
      </div>
    </div>
  )
})
