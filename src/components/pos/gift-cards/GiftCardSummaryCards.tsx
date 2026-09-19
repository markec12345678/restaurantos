'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CreditCard, CheckCircle2, Wallet, TrendingUp } from 'lucide-react'
import { slCount, NEAKTIVNA_KARTICA_FORMS } from '@/lib/sl-plural'
import { formatCurrency } from './constants'

// --- Props ---

interface GiftCardSummaryCardsProps {
  totalCards: number
  activeCards: number
  totalBalanceOutstanding: number
  totalLoadedThisMonth: number
}

// --- Komponenta ---
// RUNDA 45: detail-pass v dizajn jeziku R42–R45 (EOD KPI reference):
//  • akcentni zgornji rob per KPI (sky/emerald/amber/teal)
//  • barvne ikonske plosčice (rounded-md, zgoraj desno)
//  • tabular-nums številci (stolpci ne poskakujejo)
//  • staggered animate-fade-in-up (40 ms inkrement, respektuje
//    prefers-reduced-motion iz globals.css)
//  • card-lift hover (dvig + senca)
//  • sub-metapodatki (izpeljane metrike, ne samo oznake)

interface KpiDef {
  label: string
  value: string
  sub: string
  accent: string
  iconClass: string
  valueClass?: string
  icon: typeof CreditCard
}

export const GiftCardSummaryCards = memo(function GiftCardSummaryCards({
  totalCards,
  activeCards,
  totalBalanceOutstanding,
  totalLoadedThisMonth,
}: GiftCardSummaryCardsProps) {
  const inactiveCards = Math.max(0, totalCards - activeCards)
  const activeSharePct = totalCards > 0 ? Math.round((activeCards / totalCards) * 100) : 0
  const avgPerCard = activeCards > 0 ? totalBalanceOutstanding / activeCards : 0
  const loadedSharePct =
    totalBalanceOutstanding > 0 && totalLoadedThisMonth > 0
      ? Math.round((totalLoadedThisMonth / totalBalanceOutstanding) * 100)
      : 0

  const kpis: KpiDef[] = [
    {
      label: 'Skupaj kartic',
      value: String(totalCards),
      sub: slCount(inactiveCards, NEAKTIVNA_KARTICA_FORMS),
      accent: 'border-sky-500',
      iconClass: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',
      icon: CreditCard,
    },
    {
      label: 'Aktivne kartice',
      value: String(activeCards),
      sub: `${activeSharePct} % vseh kartic`,
      accent: 'border-emerald-500',
      iconClass: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
      valueClass: 'text-emerald-700 dark:text-emerald-400',
      icon: CheckCircle2,
    },
    {
      label: 'Stanje izdatka',
      value: formatCurrency(totalBalanceOutstanding),
      sub:
        activeCards > 0
          ? `povp. ${formatCurrency(avgPerCard)} na aktivno kartico`
          : 'ni aktivnih kartic',
      accent: 'border-amber-500',
      iconClass: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
      valueClass: 'text-amber-700 dark:text-amber-400',
      icon: Wallet,
    },
    {
      label: 'Naloženo ta mesec',
      value: formatCurrency(totalLoadedThisMonth),
      sub:
        loadedSharePct > 0
          ? `+${loadedSharePct} % trenutnega izdatka`
          : 'brez polnilnega prometa ta mesec',
      accent: 'border-teal-500',
      iconClass: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
      valueClass: 'text-teal-700 dark:text-teal-400',
      icon: TrendingUp,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon
        return (
          <Card
            key={kpi.label}
            className={`border-t-2 ${kpi.accent} card-lift transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 animate-fade-in-up`}
            style={{ animationDelay: `${Math.min(idx * 40, 200)}ms` }}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {kpi.label}
                </p>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${kpi.iconClass}`}
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${kpi.valueClass ?? ''}`}>
                {kpi.value}
              </p>
              <p className="text-[10px] mt-0.5 text-muted-foreground">{kpi.sub}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
})
