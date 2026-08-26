'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, Leaf, ShieldCheck, UtensilsCrossed } from 'lucide-react'

// --- Props ---

interface NutritionalStatsCardsProps {
  total: number
  withAllergens: number
}

// --- Komponenta ---

export const NutritionalStatsCards = memo(function NutritionalStatsCards({
  total,
  withAllergens,
}: NutritionalStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <UtensilsCrossed className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-muted-foreground">Skupaj jedi</span>
          </div>
          <div className="text-2xl font-bold">{total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-muted-foreground">Z alergeni</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">{withAllergens}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Leaf className="h-4 w-4 text-green-600" />
            <span className="text-xs text-muted-foreground">Brez alergenov</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{total - withAllergens}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-muted-foreground">EU skladnost</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">{withAllergens > 0 ? `${Math.round((withAllergens / Math.max(total, 1)) * 100)}%` : 'N/A'}</div>
        </CardContent>
      </Card>
    </div>
  )
})
