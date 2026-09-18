'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Users, UserCheck, Coins, CircleDollarSign } from 'lucide-react'
import { formatPoints } from './constants'

// --- Props ---

interface LoyaltySummaryCardsProps {
  totalAccounts: number
  activeAccounts: number
  totalPointsIssued: number
  totalPointsRedeemed: number
}

// --- Komponenta ---
// R44 stil pass (design jezik R42/R43): akcentni zgornji rob per KPI,
// barvne ikonske plosčice, tabular-nums (stolpci ne poskakujejo),
// staggered vstopna animacija (40 ms, respektuje prefers-reduced-motion),
// hover lift + senca.

interface KpiDef {
  value: number | string
  label: string
  icon: React.ElementType
  accent: string
  tile: string
  valueClass: string
  delay: string
}

export const LoyaltySummaryCards = memo(function LoyaltySummaryCards({
  totalAccounts,
  activeAccounts,
  totalPointsIssued,
  totalPointsRedeemed,
}: LoyaltySummaryCardsProps) {
  const kpis: KpiDef[] = [
    {
      value: totalAccounts,
      label: 'Skupaj računov',
      icon: Users,
      accent: 'bg-violet-500',
      tile: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
      valueClass: '',
      delay: '0ms',
    },
    {
      value: activeAccounts,
      label: 'Aktivni računi',
      icon: UserCheck,
      accent: 'bg-emerald-500',
      tile: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
      valueClass: 'text-emerald-700 dark:text-emerald-400',
      delay: '40ms',
    },
    {
      value: formatPoints(totalPointsIssued),
      label: 'Izdane točke',
      icon: Coins,
      accent: 'bg-amber-500',
      tile: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
      valueClass: 'text-amber-700 dark:text-amber-400',
      delay: '80ms',
    },
    {
      value: formatPoints(totalPointsRedeemed),
      label: 'Unovčene točke',
      icon: CircleDollarSign,
      accent: 'bg-sky-500',
      tile: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',
      valueClass: 'text-sky-700 dark:text-sky-400',
      delay: '120ms',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <Card key={kpi.label} className="card-lift relative overflow-hidden transition-all duration-300 animate-fade-in-up" style={{ animationDelay: kpi.delay }}>
            <div className={`absolute inset-x-0 top-0 h-1 ${kpi.accent}`} aria-hidden="true" />
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${kpi.tile}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className={`text-2xl font-bold tabular-nums leading-none ${kpi.valueClass}`}>{kpi.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground truncate">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
})
