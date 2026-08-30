'use client'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Wallet, FileText, BarChart3, Receipt, Clock, Users, UtensilsCrossed, Flame, Download, Building2 } from 'lucide-react'
import { useState, memo } from 'react'
import dynamic from 'next/dynamic'
import { format, subDays } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { OverviewTab } from './reports/OverviewTab'

// Lazy-loaded sub-components
const VatReport = dynamic(() => import('./reports/VatReport').then(m => ({ default: m.VatReport })), { ssr: false })
const EmployeeReport = dynamic(() => import('./reports/EmployeeReport').then(m => ({ default: m.EmployeeReport })), { ssr: false })
const ShiftsReport = dynamic(() => import('./reports/ShiftsReport').then(m => ({ default: m.ShiftsReport })), { ssr: false })
const ExportReport = dynamic(() => import('./reports/ExportReport').then(m => ({ default: m.ExportReport })), { ssr: false })
const TipsReport = dynamic(() => import('./reports/TipsReport').then(m => ({ default: m.TipsReport })), { ssr: false })
const TableRevenueReport = dynamic(() => import('./reports/TableRevenueReport').then(m => ({ default: m.TableRevenueReport })), { ssr: false })
const HeatmapReport = dynamic(() => import('./reports/HeatmapReport').then(m => ({ default: m.HeatmapReport })), { ssr: false })
const BookingExtractReport = dynamic(() => import('./reports/BookingExtractReport').then(m => ({ default: m.BookingExtractReport })), { ssr: false })
const PeriodReport = dynamic(() => import('./reports/PeriodReport').then(m => ({ default: m.PeriodReport })), { ssr: false })
const APAgingReport = dynamic(() => import('./reports/APAgingReport').then(m => ({ default: m.APAgingReport })), { ssr: false })

export const ReportsView = memo(function ReportsView() {
  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange] = useState('30')
  const startDate = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd')
  const endDate = format(new Date(), 'yyyy-MM-dd')

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: queryKeys.reports.sales({ startDate, endDate }),
    queryFn: async () => {
      const res = await authFetch(`/api/reports/sales?startDate=${startDate}&endDate=${endDate}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  const { data: popularData } = useQuery({
    queryKey: queryKeys.reports.popular({ startDate, endDate }),
    queryFn: async () => {
      const res = await authFetch(`/api/reports/popular?startDate=${startDate}&endDate=${endDate}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Poročila</h2>
          <p className="text-muted-foreground">Poslovna poročila, izpiski in knjiženje</p>
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-14">
          <TabsTrigger value="overview" className="gap-1 text-xs"><BarChart3 className="h-3 w-3" /> Pregled</TabsTrigger>
          <TabsTrigger value="daily" className="gap-1 text-xs"><Calendar className="h-3 w-3" /> Dnevno</TabsTrigger>
          <TabsTrigger value="weekly" className="gap-1 text-xs"><Calendar className="h-3 w-3" /> Tedensko</TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1 text-xs"><Calendar className="h-3 w-3" /> Mesečno</TabsTrigger>
          <TabsTrigger value="yearly" className="gap-1 text-xs"><Calendar className="h-3 w-3" /> Letno</TabsTrigger>
          <TabsTrigger value="vat" className="gap-1 text-xs"><Receipt className="h-3 w-3" /> DDV</TabsTrigger>
          <TabsTrigger value="tips" className="gap-1 text-xs"><Wallet className="h-3 w-3" /> Napitnine</TabsTrigger>
          <TabsTrigger value="tables" className="gap-1 text-xs"><UtensilsCrossed className="h-3 w-3" /> Mize</TabsTrigger>
          <TabsTrigger value="heatmap" className="gap-1 text-xs"><Flame className="h-3 w-3" /> Toplotna</TabsTrigger>
          <TabsTrigger value="booking" className="gap-1 text-xs"><FileText className="h-3 w-3" /> Izpiski</TabsTrigger>
          <TabsTrigger value="employees" className="gap-1 text-xs"><Users className="h-3 w-3" /> Zaposleni</TabsTrigger>
          <TabsTrigger value="shifts" className="gap-1 text-xs"><Clock className="h-3 w-3" /> Izmene</TabsTrigger>
          <TabsTrigger value="ap-aging" className="gap-1 text-xs"><Building2 className="h-3 w-3" /> AP Aging</TabsTrigger>
          <TabsTrigger value="export" className="gap-1 text-xs"><Download className="h-3 w-3" /> Izvoz</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4 mt-4">
          <OverviewTab salesData={salesData} popularData={popularData} salesLoading={salesLoading} />
        </TabsContent>
        <TabsContent value="daily" className="mt-4"><PeriodReport initialPeriod="daily" /></TabsContent>
        <TabsContent value="weekly" className="mt-4"><PeriodReport initialPeriod="weekly" /></TabsContent>
        <TabsContent value="monthly" className="mt-4"><PeriodReport initialPeriod="monthly" /></TabsContent>
        <TabsContent value="yearly" className="mt-4"><PeriodReport initialPeriod="yearly" /></TabsContent>
        <TabsContent value="vat" className="mt-4"><VatReport startDate={startDate} endDate={endDate} /></TabsContent>
        <TabsContent value="tips" className="mt-4"><TipsReport /></TabsContent>
        <TabsContent value="tables" className="mt-4"><TableRevenueReport /></TabsContent>
        <TabsContent value="heatmap" className="mt-4"><HeatmapReport /></TabsContent>
        <TabsContent value="booking" className="mt-4"><BookingExtractReport /></TabsContent>
        <TabsContent value="employees" className="mt-4"><EmployeeReport /></TabsContent>
        <TabsContent value="shifts" className="mt-4"><ShiftsReport /></TabsContent>
        <TabsContent value="ap-aging" className="mt-4"><APAgingReport /></TabsContent>
        <TabsContent value="export" className="mt-4"><ExportReport /></TabsContent>
      </Tabs>
    </div>
  )
})
