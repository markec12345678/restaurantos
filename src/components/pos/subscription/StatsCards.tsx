'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import type { StatsCardsProps } from './constants'

// ============================================
// STATISTIČNE KARTICE — Prikaz statistike naročnine
// ============================================

export const StatsCards = memo(function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card><CardContent className="p-4 text-center">
        <p className="text-xs text-muted-foreground">Računi skupaj</p>
        <p className="text-xl font-bold">{stats.totalInvoices}</p>
      </CardContent></Card>
      <Card><CardContent className="p-4 text-center">
        <p className="text-xs text-muted-foreground">Plačani</p>
        <p className="text-xl font-bold text-green-600">{stats.paidInvoices}</p>
      </CardContent></Card>
      <Card><CardContent className="p-4 text-center">
        <p className="text-xs text-muted-foreground">Skupni prihodek</p>
        <p className="text-xl font-bold text-blue-600">€{(stats.totalRevenue || 0).toFixed(2)}</p>
      </CardContent></Card>
    </div>
  )
})
