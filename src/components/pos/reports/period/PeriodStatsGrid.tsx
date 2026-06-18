'use client'

import { memo } from 'react'
import { StatsCard } from '../../StatsCard'
import { DollarSign, ShoppingBag, TrendingUp, Receipt, Wallet, Package, AlertTriangle } from 'lucide-react'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// ============================================
// Statistična mreža za poročilo po obdobju
// ============================================

interface PeriodStatsGridProps {
  fin: {
    summary: Record<string, number>
    costs: Record<string, number>
    totalTips: number
    tipPercentage: number
  }
  fmt: (_n: number) => string
  fmtPct: (_n: number) => string
}

export const PeriodStatsGrid = memo(function PeriodStatsGrid({ fin, fmt, fmtPct }: PeriodStatsGridProps) {
  const trendText = (change: number) => {
    if (change === 0) return 'enako'
    return `${change > 0 ? '+' : ''}${safeToFixed(change, 1)}%`
  }
  return (
    <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
      <StatsCard title="Prihodek" value={fmt(fin.summary.totalRevenue)} icon={DollarSign} subtitle={trendText(fin.summary.revenueChange)} trend={fin.summary.revenueChange > 0 ? 'up' : fin.summary.revenueChange < 0 ? 'down' : 'neutral'} />
      <StatsCard title="Naročila" value={fin.summary.completedCount} icon={ShoppingBag} subtitle={trendText(fin.summary.orderChange)} trend={fin.summary.orderChange > 0 ? 'up' : fin.summary.orderChange < 0 ? 'down' : 'neutral'} />
      <StatsCard title="Povprečno" value={fmt(fin.summary.avgOrderValue)} icon={TrendingUp} />
      <StatsCard title="Davki" value={fmt(fin.summary.totalTax)} icon={Receipt} />
      <StatsCard title="Popusti" value={fmt(fin.summary.totalDiscount)} icon={DollarSign} />
      <StatsCard title="Bruto dobiček" value={fmt(fin.costs.grossProfit)} icon={TrendingUp} subtitle={fmtPct(fin.costs.grossMargin)} trend={fin.costs.grossMargin > 50 ? 'up' : 'down'} />
      <StatsCard title="Nabavni stroški" value={fmt(fin.costs.procurementCost)} icon={Package} />
      <StatsCard title="Odpisi" value={fmt(fin.costs.writeOffCost)} icon={AlertTriangle} />
      <StatsCard title="Napitnine" value={fmt(fin.totalTips || 0)} icon={Wallet} subtitle={fin.tipPercentage ? `${safeToFixed(fin.tipPercentage, 1)}%` : ''} />
    </div>
  )
})
