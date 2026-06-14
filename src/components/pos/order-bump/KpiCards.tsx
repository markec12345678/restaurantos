'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, Target, Zap, TrendingUp } from 'lucide-react'
import type { KpiCardsProps } from './constants'

// ============================================
// KPI KARTICE — Prikaz kljucnih kazalnikov upsell
// ============================================

export const KpiCards = memo(function KpiCards({ totalPotentialRevenue, avgConversion, activeRules, totalRules, actualRevenue }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-3 text-center">
          <DollarSign className="h-5 w-5 text-green-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(totalPotentialRevenue)}</p>
          <p className="text-xs text-muted-foreground">Potencialni prihodek</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Target className="h-5 w-5 text-blue-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{avgConversion}%</p>
          <p className="text-xs text-muted-foreground">Povprecna konverzija</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Zap className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{activeRules}/{totalRules}</p>
          <p className="text-xs text-muted-foreground">Aktivna pravila</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <TrendingUp className="h-5 w-5 text-purple-500 mx-auto mb-1" />
          <p className="text-xl font-bold">+{actualRevenue}</p>
          <p className="text-xs text-muted-foreground">Dejanski prihodek</p>
        </CardContent>
      </Card>
    </div>
  )
})
