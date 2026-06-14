'use client'

// ============================================
// TAB: Analitika — poraba po dnevih in AI vpogledi
// ============================================

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, BarChart3, Brain, AlertTriangle, ShieldCheck } from 'lucide-react'
import type { AnalysisTabProps } from './constants'

export const AnalysisTab = memo(function AnalysisTab({ forecasts }: AnalysisTabProps) {
  return (
    <div className="space-y-4">
      {/* Poraba po dnevih za top artikle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {forecasts.slice(0, 4).map(f => (
          <Card key={f.inventoryItemId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {f.itemName} — poraba po dnevih
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-24">
                {f.weekdayBreakdown.map((wd, i) => {
                  const maxUsage = Math.max(...f.weekdayBreakdown.map(w => w.avgUsage), 0.1)
                  const heightPct = maxUsage > 0 ? (wd.avgUsage / maxUsage) * 100 : 0
                  const isWeekend = i === 0 || i >= 5
                  return (
                    <div key={wd.day} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t ${isWeekend ? 'bg-amber-400' : 'bg-primary'}`}
                        style={{ height: `${Math.max(4, heightPct)}%` }}
                      />
                      <span className="text-[9px] text-muted-foreground">{wd.day}</span>
                    </div>
                  )
                })}
              </div>
              {f.seasonalityFactor > 1.1 && (
                <p className="text-xs text-amber-600 mt-2">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  Vikend porast: {f.seasonalityFactor.toFixed(1)}x večja poraba
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Vpogledi */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Vpogledi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {forecasts.filter(f => f.trend === 'increasing').length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <TrendingUp className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Naraščajoča poraba</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {forecasts.filter(f => f.trend === 'increasing').map(f => f.itemName).join(', ')} — poraba narašča. Razmislite o povečanju zalog.
                </p>
              </div>
            </div>
          )}
          {forecasts.filter(f => f.seasonalityFactor > 1.2).length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <BarChart3 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Vikend vzorec</p>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  {forecasts.filter(f => f.seasonalityFactor > 1.2).map(f => f.itemName).join(', ')} — vikend porast večja od 20%. Priporočamo večjo zalogo za petek/soboto.
                </p>
              </div>
            </div>
          )}
          {forecasts.filter(f => f.riskLevel === 'critical').length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Nujno naročilo</p>
                <p className="text-xs text-red-700 dark:text-red-400">
                  {forecasts.filter(f => f.riskLevel === 'critical').map(f => `${f.itemName} (zmanjka čez ${f.daysUntilEmpty} dni)`).join(', ')} — naročite takoj!
                </p>
              </div>
            </div>
          )}
          {forecasts.every(f => f.riskLevel === 'low') && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Vse v redu</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">Vse zaloge so v varnem območju. Nobenih nujnih ukrepov ni potrebnih.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
})
