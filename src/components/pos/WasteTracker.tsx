'use client'
import { useState, memo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from './waste/constants'
import { useWasteData } from './useWasteData'
import { WasteLoadingState } from './waste/WasteLoadingState'
import dynamic from 'next/dynamic'

// Lazy-loaded podkomponente
const WasteHeader = dynamic(() => import('./waste/WasteHeader').then(m => ({ default: m.WasteHeader })), { ssr: false })
const WasteKpiCards = dynamic(() => import('./waste/WasteKpiCards').then(m => ({ default: m.WasteKpiCards })), { ssr: false })
const WasteByReasonTab = dynamic(() => import('./waste/WasteByReasonTab').then(m => ({ default: m.WasteByReasonTab })), { ssr: false })
const WasteByItemTab = dynamic(() => import('./waste/WasteByItemTab').then(m => ({ default: m.WasteByItemTab })), { ssr: false })
const WasteByCategoryTab = dynamic(() => import('./waste/WasteByCategoryTab').then(m => ({ default: m.WasteByCategoryTab })), { ssr: false })
const WasteLogTab = dynamic(() => import('./waste/WasteLogTab').then(m => ({ default: m.WasteLogTab })), { ssr: false })

export const WasteTracker = memo(function WasteTracker() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month')
  const { entries, summary } = useWasteData(period)

  if (!summary) {
    return <WasteLoadingState />
  }
  const isOnTarget = summary.currentWasteRate <= summary.wasteTarget
  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <WasteHeader period={period} onPeriodChange={setPeriod} />

      {/* KPI */}
      <WasteKpiCards summary={summary} isOnTarget={isOnTarget} formatCurrency={formatCurrency} />

      <Tabs defaultValue="by-reason" className="space-y-3">
        <TabsList>
          <TabsTrigger value="by-reason">Po razlogu</TabsTrigger>
          <TabsTrigger value="by-item">Po artiklu</TabsTrigger>
          <TabsTrigger value="by-category">Po kategoriji</TabsTrigger>
          <TabsTrigger value="log">Dnevnik</TabsTrigger>
        </TabsList>
        <TabsContent value="by-reason" className="space-y-3">
          <WasteByReasonTab summary={summary} formatCurrency={formatCurrency} />
        </TabsContent>
        <TabsContent value="by-item" className="space-y-3">
          <WasteByItemTab summary={summary} formatCurrency={formatCurrency} />
        </TabsContent>
        <TabsContent value="by-category" className="space-y-3">
          <WasteByCategoryTab summary={summary} formatCurrency={formatCurrency} />
        </TabsContent>
        <TabsContent value="log" className="space-y-3">
          <WasteLogTab entries={entries} formatCurrency={formatCurrency} />
        </TabsContent>
      </Tabs>
    </div>
  )
})
