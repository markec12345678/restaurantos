'use client'

import { memo } from 'react'

// ============================================
// P&L Loading Indicator
// ============================================

export const PnlLoadingIndicator = memo(function PnlLoadingIndicator() {
  return (
    <div className="p-4 flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Nalaganje P&L poročila...</p>
      </div>
    </div>
  )
})
