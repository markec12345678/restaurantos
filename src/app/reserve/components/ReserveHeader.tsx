'use client'

import { memo } from 'react'
import { UtensilsCrossed, MapPin } from 'lucide-react'
import type { RestaurantInfo } from '../types'

// =====================================================================
// Glava strani z informacijami o restavraciji
// =====================================================================

interface ReserveHeaderProps {
  restaurantInfo: RestaurantInfo | null
}

export const ReserveHeader = memo(function ReserveHeader({ restaurantInfo }: ReserveHeaderProps) {
  return (
    <header className="bg-white/80 dark:bg-card/80 backdrop-blur-md border-b sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg">{restaurantInfo?.name || 'RestaurantOS'}</h1>
            {restaurantInfo?.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />{restaurantInfo.address}
              </p>
            )}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">Rezervacija mize</div>
      </div>
    </header>
  )
})
