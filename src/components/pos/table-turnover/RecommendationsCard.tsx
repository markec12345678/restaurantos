'use client'

// ─── Priporočila za optimizacijo ───────────────────────────────
import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, TrendingUp, Timer, Users, CheckCircle2, Zap } from 'lucide-react'
import type { RecommendationsCardProps } from './constants'

export const RecommendationsCard = memo(function RecommendationsCard({ analytics }: RecommendationsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          Priporočila za optimizacijo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {analytics.slowTableRate > 20 && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700 dark:text-red-400">Visoka stopnja počasnih miz</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {analytics.slowTableRate.toFixed(0)}% miz je zasedenih več kot 90 minut. Razmislite o boljšem razporejanju miz ali spodbujanju hitrejšega obračuna.
              </p>
            </div>
          )}
          {analytics.occupancyRate > 85 && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Visoka zasedenost</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Zasedenost {analytics.occupancyRate.toFixed(0)}% — razmislite o čakalnem seznamu ali dodanih mizah. Povečajte dostavo za razbremenitev.
              </p>
            </div>
          )}
          {analytics.turnoverRate < 1.5 && analytics.occupiedTables > 0 && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-1">
                <Timer className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">Nizek obračun</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Povprečen obračun {analytics.turnoverRate.toFixed(1)}x na mizo je nizek. Predlagamo hitrejše postreženje, prednaročanje in upsell za povečanje vrednosti.
              </p>
            </div>
          )}
          {analytics.capacityUtilization < 50 && (
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-700 dark:text-purple-400">Nizka izraba kapacitete</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Izraba kapacitete {analytics.capacityUtilization.toFixed(0)}% — veliko prostih mest. Predlagamo promocije za privabljanje večjih skupin ali happy hour ponudbe.
              </p>
            </div>
          )}
          {analytics.occupancyRate < 100 && analytics.slowTableRate < 20 && analytics.turnoverRate >= 1.5 && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Odlična optimizacija</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Zasedenost in obračun sta v optimalnem razmerju. Nadaljujte z dobrim delom in spremljajte trende čez teden.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
