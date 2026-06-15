'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { PeriodType } from './constants'
import { TimeDistributionChart } from './period/TimeDistributionChart'
import { PaymentMethodChart } from './period/PaymentMethodChart'
import { CostAnalysisCard } from './period/CostAnalysisCard'
import { PeriodReportHeader } from './period/PeriodReportHeader'
import { PeriodStatsGrid } from './period/PeriodStatsGrid'
import { CategoryBreakdownCard } from './period/CategoryBreakdownCard'
import { TopItemsCard } from './period/TopItemsCard'

// ============================================
// POROČILO PO OBDOBJU — Dnevno/Tedensko/Mesečno/Letno
// ============================================

export function PeriodReport({ initialPeriod }: { initialPeriod: PeriodType }) {
  const [period] = useState<PeriodType>(initialPeriod)
  const [refDate, setRefDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const navigateDate = useCallback((dir: number) => {
    setRefDate(prev => {
      const d = new Date(prev)
      switch (period) {
        case 'daily': d.setDate(d.getDate() + dir); break
        case 'weekly': d.setDate(d.getDate() + dir * 7); break
        case 'monthly': d.setMonth(d.getMonth() + dir); break
        case 'yearly': d.setFullYear(d.getFullYear() + dir); break
      }
      return format(d, 'yyyy-MM-dd')
    })
  }, [period])
  const { data: fin, isLoading: finLoading } = useQuery({
    queryKey: queryKeys.reports.financial({ period: period, refDate: refDate }),
    queryFn: async () => {
      const res = await authFetch(`/api/reports/financial?period=${period}&date=${refDate}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })
  const periodLabel = useMemo(() => {
    if (!fin) return ''
    return fin.periodLabel || ''
  }, [fin])
  const fmt = (n: number) => `€${n.toFixed(2)}`
  const fmtPct = (n: number) => `${n.toFixed(1)}%`

  // Period description for chart title
  const chartPeriodLabel = period === 'daily' ? 'Promet po urah' : period === 'weekly' ? 'Promet po dnevih' : period === 'monthly' ? 'Promet po dnevih v mesecu' : 'Promet po mesecih'

  if (finLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    )
  }
  if (!fin) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>
  return (
    <div className="space-y-6">
      <PeriodReportHeader period={period} refDate={refDate} setRefDate={setRefDate} navigateDate={navigateDate} periodLabel={periodLabel} />
      <PeriodStatsGrid fin={fin} fmt={fmt} fmtPct={fmtPct} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TimeDistributionChart data={fin.timeDistribution} periodLabel={chartPeriodLabel} />
        <PaymentMethodChart paymentMethods={fin.paymentMethods} cashRegister={fin.cashRegister} fmt={fmt} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryBreakdownCard categoryBreakdown={fin.categoryBreakdown} />
        <TopItemsCard itemBreakdown={fin.itemBreakdown} fmt={fmt} />
      </div>
      <CostAnalysisCard
        totalRevenue={fin.summary.totalRevenue}
        procurementCost={fin.costs.procurementCost}
        cogs={fin.costs.cogs}
        writeOffCost={fin.costs.writeOffCost}
        grossProfit={fin.costs.grossProfit}
        grossMargin={fin.costs.grossMargin}
        fmt={fmt}
        fmtPct={fmtPct}
      />
    </div>
  )
}
