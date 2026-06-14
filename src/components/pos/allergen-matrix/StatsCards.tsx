'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import type { StatsCardsProps } from './constants'

// ============================================
// POVZETEK KARTIC — STATISTIKA ALERGENOV
// ============================================

export const StatsCards = memo(function StatsCards({
  totalItems,
  itemsWithAllergens,
  itemsWithoutAllergens,
  topAllergen,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Skupno artiklov</p>
          <p className="text-2xl font-bold">{totalItems}</p>
        </CardContent>
      </Card>
      <Card className="border-amber-300 dark:border-amber-800">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Z alergeni</p>
          <p className="text-2xl font-bold text-amber-600">{itemsWithAllergens}</p>
        </CardContent>
      </Card>
      <Card className="border-emerald-300 dark:border-emerald-800">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Brez alergenov</p>
          <p className="text-2xl font-bold text-emerald-600">{itemsWithoutAllergens}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Najpogostejši alergen</p>
          {topAllergen && (
            <div className="flex items-center gap-2">
              <span className="text-lg">{topAllergen.icon}</span>
              <div>
                <p className="text-sm font-bold">{topAllergen.label}</p>
                <p className="text-[10px] text-muted-foreground">{topAllergen.count} artiklov</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
})
