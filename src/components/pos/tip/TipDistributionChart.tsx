'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'
import type { TipPoolData } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

interface TipDistributionChartProps {
  pool: TipPoolData
}

export const TipDistributionChart = memo(function TipDistributionChart({
  pool,
}: TipDistributionChartProps) {
  if (pool.distributions.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Pregled distribucije
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pool.distributions.map((d) => {
            const pct = pool.totalTips > 0 ? (d.amount / pool.totalTips) * 100 : 0
            return (
              <div key={d.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{d.employeeName}</span>
                  <span className="text-muted-foreground">{safeToFixed(pct, 1)}%</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                  <div className="h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-600" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
})
