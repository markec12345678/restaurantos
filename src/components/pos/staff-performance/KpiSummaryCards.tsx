'use client'

// ─── Skupni KPI-ji ────────────────────────────────────────────

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, Star, BarChart3, Timer, Trophy } from 'lucide-react'
import type { KpiSummaryCardsProps } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

export const KpiSummaryCards = memo(function KpiSummaryCards({
  totals,
}: KpiSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Skupni prihodek</span>
          </div>
          <p className="text-xl font-bold">€{safeToFixed(totals?.totalRevenue || 0, 2)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Star className="h-4 w-4 text-amber-600" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Skupne napitnine</span>
          </div>
          <p className="text-xl font-bold">€{safeToFixed(totals?.totalTips || 0, 2)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Skupna naročila</span>
          </div>
          <p className="text-xl font-bold">{totals?.totalOrders || 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Timer className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Povpr. čas strežbe</span>
          </div>
          <p className="text-xl font-bold">{safeToFixed(totals?.avgServiceTime || 0, 0)} min</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Trophy className="h-4 w-4 text-purple-600" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Povpr. ocena</span>
          </div>
          <p className="text-xl font-bold">{safeToFixed(totals?.avgPerformanceScore || 0, 0)}/100</p>
        </CardContent>
      </Card>
    </div>
  )
})
