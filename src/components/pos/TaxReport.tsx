'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Tax Report / Davčno poročilo
// DDV poročilo za FURS — Mesečno/Četrtletno/Letno
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import dynamic from 'next/dynamic'
import type { TaxReportData } from './tax-report/constants'
import { loadReportData } from './tax-report/helpers'

// Lazy-loaded sub-komponente
const TaxReportLoading = dynamic(() => import('./tax-report/TaxReportLoading').then((m) => m.TaxReportLoading), { ssr: false })
const TaxReportHeader = dynamic(() => import('./tax-report/TaxReportHeader').then((m) => m.TaxReportHeader), { ssr: false })
const TaxReportKPI = dynamic(() => import('./tax-report/TaxReportKPI').then((m) => m.TaxReportKPI), { ssr: false })
const TaxBreakdownTable = dynamic(() => import('./tax-report/TaxBreakdownTable').then((m) => m.TaxBreakdownTable), { ssr: false })
const TaxDailyView = dynamic(() => import('./tax-report/TaxDailyView').then((m) => m.TaxDailyView), { ssr: false })
const TaxFursStatus = dynamic(() => import('./tax-report/TaxFursStatus').then((m) => m.TaxFursStatus), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const TaxReport = memo(function TaxReport() {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month')

  // Naloži poročilo z useQuery
  const { data, isLoading } = useQuery<TaxReportData>({
    queryKey: ['tax-report', period],
    queryFn: () => loadReportData(period),
  })

  const handlePeriodChange = useCallback((p: 'month' | 'quarter' | 'year') => {
    setPeriod(p)
  }, [])

  if (isLoading || !data) {
    return <TaxReportLoading />
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <TaxReportHeader
        data={data}
        period={period}
        onPeriodChange={handlePeriodChange}
      />

      {/* KPI */}
      <TaxReportKPI data={data} />

      <Tabs defaultValue="breakdown" className="space-y-3">
        <TabsList>
          <TabsTrigger value="breakdown">Razčlenitev DDV</TabsTrigger>
          <TabsTrigger value="daily">Dnevni pregled</TabsTrigger>
          <TabsTrigger value="furs">FURS status</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown" className="space-y-3">
          <TaxBreakdownTable data={data} />
        </TabsContent>

        <TabsContent value="daily" className="space-y-3">
          <TaxDailyView data={data} />
        </TabsContent>

        <TabsContent value="furs" className="space-y-3">
          <TaxFursStatus data={data} />
        </TabsContent>
      </Tabs>
    </div>
  )
})
