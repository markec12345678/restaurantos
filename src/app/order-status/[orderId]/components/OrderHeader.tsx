'use client'

import { memo } from 'react'
import { UtensilsCrossed, RefreshCw } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Glava strani za sledenje naročila
// ═══════════════════════════════════════════════════════════════

interface OrderHeaderProps {
  onRefresh: () => void
}

export const OrderHeader = memo(function OrderHeader({ onRefresh }: OrderHeaderProps) {
  return (
    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b sticky top-0 z-10">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">RestaurantOS</span>
        </div>
        <button onClick={onRefresh} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="h-3 w-3" />
          Osveži
        </button>
      </div>
    </div>
  )
})
