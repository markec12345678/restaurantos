'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { marginColor } from './constants'
import type { MarginStats } from './constants'

interface MarginStatsCardsProps {
  stats: MarginStats
}

export const MarginStatsCards = memo(function MarginStatsCards({ stats }: MarginStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Povprečna marža</p>
          <p className={`text-2xl font-bold ${marginColor(stats.avgMargin)}`}>
            {stats.avgMargin.toFixed(1)}%
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Artikli z maržo &lt;40%</p>
          <p className="text-2xl font-bold text-red-600">{stats.below40}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Brez recepta/normativa</p>
          <p className="text-2xl font-bold text-amber-600">{stats.noRecipe}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Skupaj artiklov</p>
          <p className="text-2xl font-bold">{stats.totalItems}</p>
        </CardContent>
      </Card>
    </div>
  )
})
