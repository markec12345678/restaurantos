'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { BadgeCheck, Coins, Receipt, ReceiptText, ShieldCheck, TrendingUp, Wallet } from 'lucide-react'
import type { EodKpiCardsProps } from './constants'
import { formatEUR } from '@/lib/safe-format'

// ============================================
// EOD KPI CARDS - Ključni kazalniki
// ============================================
// Runda 42 (detail-pass): vsaka kartica ima akcentni zgornji rob (barvni
// kód KPI-ja), ikono, hover dvig (lift + senca) in tabular-nums številke
// (stolpci se ne "poskakujejo" ob refreshu). Vstopna animacija staggered
// (CSS animation-delay), spoštuje prefers-reduced-motion (globals.css).
// ============================================

interface KpiDef {
  label: string
  value: string
  valueClass?: string
  sub?: string | null
  subClass?: string
  icon: typeof Receipt
  accent: string // border-t barva
  iconClass: string
}

export const EodKpiCards = memo(function EodKpiCards({ data }: EodKpiCardsProps) {
  const kpis: KpiDef[] = [
    {
      label: 'Prihodek',
      value: formatEUR(data.orders.revenue),
      valueClass: 'text-emerald-600 dark:text-emerald-400',
      sub: `povp. račun ${formatEUR(data.orders.avgOrderValue)}`,
      icon: TrendingUp,
      accent: 'border-t-emerald-500',
      iconClass: 'text-emerald-500 bg-emerald-500/10',
    },
    {
      label: 'Naročila',
      value: String(data.orders.completed),
      sub: `${data.orders.cancelled} preklicanih`,
      icon: Receipt,
      accent: 'border-t-sky-500',
      iconClass: 'text-sky-500 bg-sky-500/10',
    },
    {
      label: 'Napitnine',
      value: formatEUR(data.payments.totalTips),
      valueClass: 'text-amber-600 dark:text-amber-400',
      icon: Coins,
      accent: 'border-t-amber-500',
      iconClass: 'text-amber-500 bg-amber-500/10',
    },
    {
      label: 'Neto dobiček',
      value: formatEUR(data.netProfit),
      valueClass: data.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
      icon: Wallet,
      accent: data.netProfit >= 0 ? 'border-t-teal-500' : 'border-t-red-500',
      iconClass: data.netProfit >= 0 ? 'text-teal-500 bg-teal-500/10' : 'text-red-500 bg-red-500/10',
    },
    {
      label: 'FURS overjeno',
      value: String(data.furs.verified),
      sub: data.furs.failed > 0 ? `${data.furs.failed} neuspešnih` : null,
      subClass: data.furs.failed > 0 ? 'text-red-500' : undefined,
      icon: data.furs.failed > 0 ? ShieldCheck : BadgeCheck,
      accent: data.furs.failed > 0 ? 'border-t-red-500' : 'border-t-violet-500',
      iconClass: data.furs.failed > 0 ? 'text-red-500 bg-red-500/10' : 'text-violet-500 bg-violet-500/10',
    },
    {
      label: 'Stroški',
      value: formatEUR(data.expenses.total),
      valueClass: 'text-red-600 dark:text-red-400',
      icon: ReceiptText,
      accent: 'border-t-rose-500',
      iconClass: 'text-rose-500 bg-rose-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon
        return (
          <Card
            key={kpi.label}
            className={`border-t-2 ${kpi.accent} card-lift transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 animate-fade-in-up`}
            style={{ animationDelay: `${Math.min(idx * 40, 200)}ms` }}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${kpi.iconClass}`} aria-hidden="true">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className={`mt-0.5 text-xl font-bold tabular-nums ${kpi.valueClass ?? ''}`}>{kpi.value}</p>
              {kpi.sub ? (
                <p className={`text-[9px] mt-0.5 ${kpi.subClass ?? 'text-muted-foreground'}`}>{kpi.sub}</p>
              ) : null}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
})
