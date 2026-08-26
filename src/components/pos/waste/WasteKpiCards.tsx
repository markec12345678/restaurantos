'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, Package, Percent, TrendingDown } from 'lucide-react'
import type { WasteKpiCardsProps } from './constants'

// ============================================
// KPI KARTICE ODPADKOV
// ============================================
export const WasteKpiCards = memo(function WasteKpiCards({
  summary,
  isOnTarget,
  formatCurrency: fmtCurrency,
}: WasteKpiCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <Card className={isOnTarget ? '' : 'border-red-200 dark:border-red-800'}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground">Skupaj odpadki</span>
          </div>
          <p className="text-xl font-bold text-red-600">{fmtCurrency(summary.totalWasteCost)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Količina</span>
          </div>
          <p className="text-xl font-bold">{summary.totalWasteItems}</p>
        </CardContent>
      </Card>
      <Card className={isOnTarget ? '' : 'border-amber-200 dark:border-amber-800'}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Percent className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Stopnja odpadkov</span>
          </div>
          <p className={`text-xl font-bold ${isOnTarget ? 'text-green-600' : 'text-amber-600'}`}>{summary.currentWasteRate}%</p>
          <p className="text-xs text-muted-foreground">Cilj: &le;{summary.wasteTarget}%</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Food Cost %</span>
          </div>
          <p className="text-xl font-bold">{summary.foodCostPercentage}%</p>
        </CardContent>
      </Card>
    </div>
  )
})
