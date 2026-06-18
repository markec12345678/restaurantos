'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { StatsCard } from './StatsCard'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign, ShoppingBag, Calculator, BarChartBig, PiggyBank, Shield } from 'lucide-react'
import { usePOSStore } from '@/lib/store'
import { useMemo, memo } from 'react'
import dynamic from 'next/dynamic'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { authFetch } from '@/components/pos/PinLogin'
import { STATUS_COLORS, STATUS_LABELS, TYPE_LABELS, DAY_NAMES } from './dashboard/constants'
import type { DashboardData, WowChartDataPoint, ComputedValues } from './dashboard/constants'

// Lazy-loaded podkomponente
const WoWComparison = dynamic(() => import('./dashboard/WoWComparison').then((m) => m.WoWComparison), { ssr: false })
const ShiftFursStatus = dynamic(() => import('./dashboard/ShiftFursStatus').then((m) => m.ShiftFursStatus), { ssr: false })
const ChartsSection = dynamic(() => import('./dashboard/ChartsSection').then((m) => m.ChartsSection), { ssr: false })
const HeatmapSection = dynamic(() => import('./dashboard/HeatmapSection').then((m) => m.HeatmapSection), { ssr: false })
const BreakdownSection = dynamic(() => import('./dashboard/BreakdownSection').then((m) => m.BreakdownSection), { ssr: false })
const RecentActivity = dynamic(() => import('./dashboard/RecentActivity').then((m) => m.RecentActivity), { ssr: false })
const StockAndKitchen = dynamic(() => import('./dashboard/StockAndKitchen').then((m) => m.StockAndKitchen), { ssr: false })

export const Dashboard = memo(function Dashboard() {
  const { setActiveModule } = usePOSStore()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: async () => {
      const res = await authFetch('/api/dashboard')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json() as Promise<DashboardData>
    },
  })

  // Memoiziraj computed vrednosti -- prepreci ponovni izracun ob vsakem renderju
  // MORA biti pred conditional return (Rules of Hooks)
  const computed: ComputedValues = useMemo(() => {
    const wow = data?.wowComparison
    const heatmapData = data?.heatmapData || []
    const guestAnalytics = data?.guestAnalytics

    // Compute heatmap max for color scaling
    const heatmapMax = Math.max(...heatmapData.map((h) => h.revenue), 1)

    // Build WoW chart data
    const wowChartData: WowChartDataPoint[] = (wow?.thisWeekDaily || []).map((d, idx) => {
      const lastWeekDay = wow?.lastWeekDaily?.[idx]
      return {
        day: DAY_NAMES[idx] || d.date.slice(0, 3),
        'Ta teden': d.revenue,
        'Prejšnji teden': lastWeekDay?.revenue || 0,
      }
    })

    return {
      statusColors: STATUS_COLORS,
      statusLabels: STATUS_LABELS,
      typeLabels: TYPE_LABELS,
      wow,
      heatmapData,
      guestAnalytics,
      heatmapMax,
      wowChartData,
    }
  }, [data])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (<Skeleton key={i} className="h-28" />))}
        </div>
        <Skeleton className="h-72" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-y-auto h-full p-1 custom-scrollbar">
      <div>
        <h2 className="text-2xl font-bold">Nadzorna plošča</h2>
        <p className="text-muted-foreground">Pregled dneva in ključni kazalniki</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard title="Današnji prihodek" value={`€${safeToFixed(data?.todayRevenue || 0, 2)}`} subtitle={(data?.pendingOrders || 0) > 0 ? `${data?.pendingOrders} čakajočih` : undefined} icon={DollarSign} trend="up" />
        <StatsCard title="Skupno naročil" value={data?.totalOrders || 0} subtitle={`${data?.completedOrders || 0} končanih · ${data?.cancelledOrders || 0} preklicanih`} icon={ShoppingBag} />
        <StatsCard title="Povpr. naročilo" value={`€${safeToFixed(data?.avgOrderValue || 0, 2)}`} subtitle={(data?.todayTips || 0) > 0 ? `Napitnine: €${safeToFixed(data?.todayTips || 0, 2)}` : undefined} icon={Calculator} />
        <StatsCard title="Zasedene mize" value={`${data?.activeTables || 0}/${data?.totalTables || 0}`} subtitle={(data?.readyOrders || 0) > 0 ? `${data?.readyOrders} pripravljenih` : undefined} icon={BarChartBig} />
        <StatsCard title="Bruto dobiček" value={`€${safeToFixed(data?.grossProfit || 0, 2)}`} subtitle={(data?.grossMargin || 0) > 0 ? `Marža: ${data?.grossMargin}%` : undefined} icon={PiggyBank} trend={(data?.grossMargin || 0) > 50 ? 'up' : 'down'} />
        <StatsCard title="FURS overjeno" value={data?.fursStatus?.todayVerified || 0} subtitle={(data?.fursStatus?.todayUnverified || 0) > 0 ? `${data?.fursStatus?.todayUnverified} brez overjanja` : 'Vse overjeno'} icon={Shield} trend={(data?.fursStatus?.todayUnverified || 0) === 0 ? 'up' : 'down'} />
      </div>

      {/* WoW primerjava */}
      <WoWComparison wow={computed.wow} wowChartData={computed.wowChartData} />

      {/* Aktivna izmena + FURS status */}
      <ShiftFursStatus activeShift={data?.activeShift ?? null} fursStatus={data?.fursStatus ?? { todayVerified: 0, todayUnverified: 0, configured: false, environment: '' }} />

      {/* Prihodek diagram + kategorije tortni */}
      <ChartsSection dailyRevenue={data?.dailyRevenue || []} categoryBreakdown={data?.categoryBreakdown || []} />

      {/* Toplotna karta prometa */}
      <HeatmapSection heatmapData={computed.heatmapData} heatmapMax={computed.heatmapMax} />

      {/* Urni pregled + vrsta naročila + DDV */}
      <BreakdownSection
        hourlyRevenue={data?.hourlyRevenue || []}
        orderTypeBreakdown={data?.orderTypeBreakdown || []}
        vatBreakdown={data?.vatBreakdown || []}
        typeLabels={computed.typeLabels}
        todayRevenue={data?.todayRevenue || 0}
      />

      {/* Zadnja naročila + najbolj prodajani + analitika gostov */}
      <RecentActivity
        recentOrders={data?.recentOrders || []}
        topSellingItems={data?.topSellingItems || []}
        guestAnalytics={computed.guestAnalytics}
        statusColors={computed.statusColors}
        statusLabels={computed.statusLabels}
        typeLabels={computed.typeLabels}
      />

      {/* Stanje zaloge + kuhinjski zaslon */}
      <StockAndKitchen
        lowStockItems={data?.lowStockItems || []}
        recentOrders={data?.recentOrders || []}
        statusColors={computed.statusColors}
        statusLabels={computed.statusLabels}
        typeLabels={computed.typeLabels}
        onNavigateInventory={() => setActiveModule('inventory')}
      />
    </div>
  )
})
