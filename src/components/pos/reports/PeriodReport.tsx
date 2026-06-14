'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatsCard } from '../StatsCard'
import { DollarSign, ShoppingBag, TrendingUp, Receipt, Wallet, Package, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { PeriodType } from './constants'
import { TimeDistributionChart } from './period/TimeDistributionChart'
import { PaymentMethodChart } from './period/PaymentMethodChart'
import { CostAnalysisCard } from './period/CostAnalysisCard'

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
  const trendText = (change: number) => {
    if (change === 0) return 'enako'
    return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
  }

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
      {/* Navigacija po datumih */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" aria-label="Nazaj" onClick={() => navigateDate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center min-w-48">
          <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="text-center w-40 mx-auto" aria-label="Datum poročila" />
          <p className="text-sm text-muted-foreground mt-1">{periodLabel}</p>
        </div>
        <Button variant="outline" size="icon" aria-label="Naprej" onClick={() => navigateDate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {/* Kazalci */}
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
        <StatsCard
          title="Prihodek"
          value={fmt(fin.summary.totalRevenue)}
          icon={DollarSign}
          subtitle={trendText(fin.summary.revenueChange)}
          trend={fin.summary.revenueChange > 0 ? 'up' : fin.summary.revenueChange < 0 ? 'down' : 'neutral'}
        />
        <StatsCard
          title="Naročila"
          value={fin.summary.completedCount}
          icon={ShoppingBag}
          subtitle={trendText(fin.summary.orderChange)}
          trend={fin.summary.orderChange > 0 ? 'up' : fin.summary.orderChange < 0 ? 'down' : 'neutral'}
        />
        <StatsCard
          title="Povprečno"
          value={fmt(fin.summary.avgOrderValue)}
          icon={TrendingUp}
        />
        <StatsCard
          title="Davki"
          value={fmt(fin.summary.totalTax)}
          icon={Receipt}
        />
        <StatsCard
          title="Popusti"
          value={fmt(fin.summary.totalDiscount)}
          icon={DollarSign}
        />
        <StatsCard
          title="Bruto dobiček"
          value={fmt(fin.costs.grossProfit)}
          icon={TrendingUp}
          subtitle={fmtPct(fin.costs.grossMargin)}
          trend={fin.costs.grossMargin > 50 ? 'up' : 'down'}
        />
        <StatsCard
          title="Nabavni stroški"
          value={fmt(fin.costs.procurementCost)}
          icon={Package}
        />
        <StatsCard
          title="Odpisi"
          value={fmt(fin.costs.writeOffCost)}
          icon={AlertTriangle}
        />
        <StatsCard
          title="Napitnine"
          value={fmt(fin.totalTips || 0)}
          icon={Wallet}
          subtitle={fin.tipPercentage ? `${fin.tipPercentage.toFixed(1)}%` : ''}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Časovna porazdelitev */}
        <TimeDistributionChart
          data={fin.timeDistribution}
          periodLabel={chartPeriodLabel}
        />
        {/* Plačilne metode */}
        <PaymentMethodChart
          paymentMethods={fin.paymentMethods}
          cashRegister={fin.cashRegister}
          fmt={fmt}
        />
      </div>
      {/* Kategorije in Artikli */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Prihodek po kategorijah */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Prihodek po kategorijah</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <TimeDistributionChart data={fin.categoryBreakdown.slice(0, 10)} periodLabel="Prihodek po kategorijah" />
            </div>
          </CardContent>
        </Card>
        {/* Top artikli */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Najbolj prodajani artikli</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {fin.itemBreakdown.slice(0, 15).map((item: { name: string; category: string; quantity: number; revenue: number; avgPrice: number }, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-muted-foreground w-5">{idx + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-sm font-semibold">{fmt(item.revenue)}</p>
                    <p className="text-xs text-muted-foreground">{item.quantity}× @ {fmt(item.avgPrice)}</p>
                  </div>
                </div>
              ))}
              {fin.itemBreakdown.length === 0 && (
                <p className="text-center py-6 text-muted-foreground">Ni prodaje v tem obdobju</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Stroškovna analiza */}
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
