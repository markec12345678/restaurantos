'use client'

// ─── Priporočila za izboljšavo ────────────────────────────────

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Timer, Target, ArrowDownRight, Award } from 'lucide-react'
import type { RecommendationsSectionProps } from './constants'

export const RecommendationsSection = memo(function RecommendationsSection({
  employees,
  topPerformer,
}: RecommendationsSectionProps) {
  if (employees.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Priporočila za izboljšavo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Počasni natakarji */}
          {employees.filter(e => e.avgServiceTime > 0).sort((a, b) => b.avgServiceTime - a.avgServiceTime).slice(0, 2).map(emp => (
            <div key={emp.employeeId} className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
              <div className="flex items-center gap-2 mb-1">
                <Timer className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {emp.employeeName} — Počasna strežba
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Povprečni čas {emp.avgServiceTime.toFixed(0)} min je nad povprečjem. Priporočamo dodatno usposabljanje ali pomoč med vršnimi urami.
              </p>
            </div>
          ))}

          {/* Nizka upsell stopnja */}
          {employees.filter(e => e.upsellRate < 10 && e.totalOrders > 5).slice(0, 2).map(emp => (
            <div key={emp.employeeId} className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                  {emp.employeeName} — Priložnost za upsell
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Upsell stopnja {emp.upsellRate.toFixed(0)}% je nizka. Predlagamo usposabljanje za predlaganje dodatkov, prilog in pijač.
              </p>
            </div>
          ))}

          {/* Visoka stornacija */}
          {employees.filter(e => e.voidRate > 5).map(emp => (
            <div key={emp.employeeId} className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownRight className="h-4 w-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                  {emp.employeeName} — Visoka stopnja stornacij
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Stopnja stornacij {emp.voidRate.toFixed(1)}% je nad 5%. Preverite vzroke — morebiti napake pri vnosu ali težave s komunikacijo.
              </p>
            </div>
          ))}

          {/* Top performer nagrada */}
          {topPerformer && topPerformer.performanceScore >= 80 && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
              <div className="flex items-center gap-2 mb-1">
                <Award className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {topPerformer.employeeName} — Odlična nagrada
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Z oceno {topPerformer.performanceScore}/100 je {topPerformer.employeeName} vodilni izvajalec. Razmislite o nagradi ali priznanju za motivacijo!
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
