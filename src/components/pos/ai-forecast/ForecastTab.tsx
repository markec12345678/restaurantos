'use client'

// ============================================
// TAB: Napovedi — seznam napovedi z indikatorji tveganja
// ============================================

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { Progress } from '@/components/ui/progress'
import { TrendingUp } from 'lucide-react'
import { riskConfig, trendConfig, fmtQty } from './constants'
import type { ForecastTabProps } from './constants'

export const ForecastTab = memo(function ForecastTab({ forecasts, isLoading }: ForecastTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
    )
  }

  if (forecasts.length === 0) {
    return <p className="text-center py-12 text-muted-foreground">Ni podatkov za napovedovanje</p>
  }

  return (
    <>
      {forecasts.map(f => {
        const risk = riskConfig[f.riskLevel] || riskConfig.low
        const trend = trendConfig[f.trend] || trendConfig.stable
        const stockPercent = f.minStock > 0 ? Math.min(100, (f.currentStock / f.minStock) * 100) : 100

        return (
          <Card key={f.inventoryItemId} className={`border-l-4 ${f.riskLevel === 'critical' ? 'border-l-red-500' : f.riskLevel === 'high' ? 'border-l-amber-500' : f.riskLevel === 'medium' ? 'border-l-blue-500' : 'border-l-emerald-500'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className={risk.bgColor}>{risk.icon} {risk.label}</Badge>
                  <div>
                    <p className="font-semibold">{f.itemName}</p>
                    <p className="text-xs text-muted-foreground">
                      Zaloga: <strong>{fmtQty(f.currentStock)}</strong> {f.unit} ·
                      Min: {fmtQty(f.minStock)} ·
                      Povp. dnevna poraba: {fmtQty(f.avgDailyUsage)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Dni do praznine</p>
                    <p className={`font-bold ${f.daysUntilEmpty !== null && f.daysUntilEmpty <= 7 ? 'text-red-600' : ''}`}>
                      {f.daysUntilEmpty !== null ? f.daysUntilEmpty : '∞'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Napoved 7d</p>
                    <p className="font-semibold">{fmtQty(f.forecast7d)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Trend</p>
                    <div className={`flex items-center gap-1 ${trend.color}`}>{trend.icon} {trend.label}</div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Zaupanje</p>
                    <p className="font-medium">{Math.round(f.confidence * 100)}%</p>
                  </div>
                  {f.seasonalityFactor > 1.15 && (
                    <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                      <TrendingUp className="h-3 w-3 mr-1" /> Vikend porast ({safeToFixed(f.seasonalityFactor, 1)}x)
                    </Badge>
                  )}
                </div>
              </div>
              {/* Vrstica ravni zaloge */}
              <div className="mt-2">
                <Progress
                  value={stockPercent}
                  className={`h-2 ${stockPercent < 30 ? '[&>div]:bg-red-500' : stockPercent < 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
                  aria-valuetext={stockPercent < 30 ? 'Zmanjkuje' : stockPercent < 70 ? 'Zadostna zaloga' : 'Presežek'}
                />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </>
  )
})
