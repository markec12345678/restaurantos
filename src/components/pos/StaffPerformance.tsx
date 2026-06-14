'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Analitika učinkovitosti zaposlenih
// Toast POS + 7shifts + Square standard
// Napitnine, čas strežbe, obračun miz, upsell, ocena
// ═══════════════════════════════════════════════════════════════

import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { useState, useMemo, memo } from 'react'
import type { PerformanceData } from './staff-performance/constants'

// ─── Lazy-loaded podkomponente ─────────────────────────────────
const PerformanceHeader = dynamic(
  () => import('./staff-performance/PerformanceHeader').then(m => m.PerformanceHeader),
  { ssr: false },
)
const KpiSummaryCards = dynamic(
  () => import('./staff-performance/KpiSummaryCards').then(m => m.KpiSummaryCards),
  { ssr: false },
)
const TopPerformerCards = dynamic(
  () => import('./staff-performance/TopPerformerCards').then(m => m.TopPerformerCards),
  { ssr: false },
)
const EmployeeList = dynamic(
  () => import('./staff-performance/EmployeeList').then(m => m.EmployeeList),
  { ssr: false },
)
const RecommendationsSection = dynamic(
  () => import('./staff-performance/RecommendationsSection').then(m => m.RecommendationsSection),
  { ssr: false },
)

export const StaffPerformance = memo(function StaffPerformance() {
  const [period, setPeriod] = useState('week')

  // ─── Poizvedba za podatke o učinkovitosti ───────────────────
  const { data, isLoading } = useQuery<PerformanceData>({
    queryKey: ['staff-performance', period],
    queryFn: async () => {
      const res = await authFetch(`/api/staff-performance?period=${period}`)
      return res.json()
    },
  })

  const employees = data?.employees || []
  const totals = data?.totals

  // ─── Izpeljani podatki: top izvajalci ───────────────────────
  const topPerformer = employees[0]
  const { mostTips, fastest, bestUpseller } = useMemo(() => ({
    mostTips: [...employees].sort((a, b) => (b.totalTips || 0) - (a.totalTips || 0))[0],
    fastest: [...employees].sort((a, b) => (a.avgServiceTime || 999) - (b.avgServiceTime || 999))[0],
    bestUpseller: [...employees].sort((a, b) => (b.upsellRate || 0) - (a.upsellRate || 0))[0],
  }), [employees])

  // ─── Nalagalni skeleton ─────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_unused, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-y-auto h-full p-1 custom-scrollbar">
      <PerformanceHeader period={period} onPeriodChange={setPeriod} />
      <KpiSummaryCards totals={totals} />
      <TopPerformerCards
        topPerformer={topPerformer}
        mostTips={mostTips}
        fastest={fastest}
        bestUpseller={bestUpseller}
      />
      <EmployeeList employees={employees} />
      <RecommendationsSection employees={employees} topPerformer={topPerformer} />
    </div>
  )
})
