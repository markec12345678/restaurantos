'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — P&L Porocilo (Profit & Loss)
// Toast POS + Lightspeed standard za finančno poročanje
// ═══════════════════════════════════════════════════════════════

import dynamic from 'next/dynamic'
import { useState, useEffect, memo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import type { PnLData, PnLPeriod } from './profit-loss/constants'
import { loadPnlReport } from './profit-loss/load-report'
import { PnlLoadingIndicator } from './profit-loss/PnlLoadingIndicator'

// ─── Lazy-loaded podkomponente ─────────────────────────────────
const PnlHeader = dynamic(
  () => import('./profit-loss/PnlHeader').then(m => m.PnlHeader),
  { ssr: false },
)
const KpiCards = dynamic(
  () => import('./profit-loss/KpiCards').then(m => m.KpiCards),
  { ssr: false },
)
const SummaryTab = dynamic(
  () => import('./profit-loss/SummaryTab').then(m => m.SummaryTab),
  { ssr: false },
)
const RevenueTab = dynamic(
  () => import('./profit-loss/RevenueTab').then(m => m.RevenueTab),
  { ssr: false },
)
const ExpensesTab = dynamic(
  () => import('./profit-loss/ExpensesTab').then(m => m.ExpensesTab),
  { ssr: false },
)

export const ProfitLossReport = memo(function ProfitLossReport() {
  const [data, setData] = useState<PnLData | null>(null)
  const [_loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PnLPeriod>('month')

  useEffect(() => {
    queueMicrotask(() => setLoading(true))
    loadPnlReport(period)
      .then(setData)
      .catch(() => toast.error('Napaka pri nalaganju P&L poročila'))
      .finally(() => queueMicrotask(() => setLoading(false)))
  }, [period])

  if (!data) {
    return <PnlLoadingIndicator />
  }

  const isProfitable = data.netProfit >= 0

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <PnlHeader
        period={period}
        onPeriodChange={setPeriod}
        isProfitable={isProfitable}
        periodName={data.period}
      />
      <KpiCards data={data} isProfitable={isProfitable} />
      <Tabs defaultValue="summary" className="space-y-3">
        <TabsList>
          <TabsTrigger value="summary">Povzetek</TabsTrigger>
          <TabsTrigger value="revenue">Prihodki</TabsTrigger>
          <TabsTrigger value="expenses">Stroški</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="space-y-3">
          <SummaryTab data={data} isProfitable={isProfitable} />
        </TabsContent>
        <TabsContent value="revenue" className="space-y-3">
          <RevenueTab data={data} />
        </TabsContent>
        <TabsContent value="expenses" className="space-y-3">
          <ExpensesTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  )
})
