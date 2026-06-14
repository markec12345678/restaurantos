'use client'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatsCard } from './StatsCard'
import { DollarSign, ShoppingBag, TrendingUp, Calendar, Wallet, FileText, BarChart3, Receipt, Clock, Users, UtensilsCrossed, Flame, Download } from 'lucide-react'
import { useState, memo } from 'react'
import dynamic from 'next/dynamic'
import { format, subDays } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { PIE_COLORS, orderTypeLabels } from './reports/constants'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

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

export const ReportsView = memo(function ReportsView() {
  const [activeTab, setActiveTab] = useState('overview')
  // Stari podatki za overview
  const [dateRange] = useState('30')
  const startDate = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd')
  const endDate = format(new Date(), 'yyyy-MM-dd')
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: queryKeys.reports.sales({ startDate: startDate, endDate: endDate }),
    queryFn: async () => {
      const res = await authFetch(`/api/reports/sales?startDate=${startDate}&endDate=${endDate}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })
  const { data: popularData } = useQuery({
    queryKey: queryKeys.reports.popular({ startDate: startDate, endDate: endDate }),
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
        <TabsList className="grid w-full grid-cols-13">
          <TabsTrigger value="overview" className="gap-1 text-xs">
            <BarChart3 className="h-3 w-3" /> Pregled
          </TabsTrigger>
          <TabsTrigger value="daily" className="gap-1 text-xs">
            <Calendar className="h-3 w-3" /> Dnevno
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-1 text-xs">
            <Calendar className="h-3 w-3" /> Tedensko
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1 text-xs">
            <Calendar className="h-3 w-3" /> Mesečno
          </TabsTrigger>
          <TabsTrigger value="yearly" className="gap-1 text-xs">
            <Calendar className="h-3 w-3" /> Letno
          </TabsTrigger>
          <TabsTrigger value="vat" className="gap-1 text-xs">
            <Receipt className="h-3 w-3" /> DDV
          </TabsTrigger>
          <TabsTrigger value="tips" className="gap-1 text-xs">
            <Wallet className="h-3 w-3" /> Napitnine
          </TabsTrigger>
          <TabsTrigger value="tables" className="gap-1 text-xs">
            <UtensilsCrossed className="h-3 w-3" /> Mize
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="gap-1 text-xs">
            <Flame className="h-3 w-3" /> Toplotna
          </TabsTrigger>
          <TabsTrigger value="booking" className="gap-1 text-xs">
            <FileText className="h-3 w-3" /> Izpiski
          </TabsTrigger>
          <TabsTrigger value="employees" className="gap-1 text-xs">
            <Users className="h-3 w-3" /> Zaposleni
          </TabsTrigger>
          <TabsTrigger value="shifts" className="gap-1 text-xs">
            <Clock className="h-3 w-3" /> Izmene
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-1 text-xs">
            <Download className="h-3 w-3" /> Izvoz
          </TabsTrigger>
        </TabsList>
        {/* PREGLED (overview) */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Prihodek (30 dni)"
              value={`€${(salesData?.totalRevenue || 0).toFixed(2)}`}
              icon={DollarSign}
            />
            <StatsCard
              title="Naročila (30 dni)"
              value={salesData?.totalOrders || 0}
              icon={ShoppingBag}
            />
            <StatsCard
              title="Povpr. naročilo"
              value={`€${(salesData?.avgOrderValue || 0).toFixed(2)}`}
              icon={TrendingUp}
            />
            <StatsCard
              title="Top artikli"
              value={popularData?.popularItems?.length || 0}
              icon={BarChart3}
            />
          </div>
          {salesLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Trend prihodka (30 dni)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesData?.dailyRevenue || []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'MMM dd')} tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                        <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                        <Line type="monotone" dataKey="revenue" stroke="oklch(0.7 0.15 55)" strokeWidth={2} dot={{ fill: 'oklch(0.7 0.15 55)', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Najbolj prodajani</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(popularData?.popularItems || []).slice(0, 8)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(value: number) => [value, 'Količina']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                          <Bar dataKey="quantity" fill="oklch(0.7 0.15 55)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Porazdelitev po vrsti</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={salesData?.typeBreakdown || []} dataKey="revenue" nameKey="type" cx="50%" cy="50%" outerRadius={80} label={({ type, percent }: { type: string; percent: number }) => `${orderTypeLabels[type] || type} ${(percent * 100).toFixed(0)}%`}>
                            {(salesData?.typeBreakdown || []).map((_entry: unknown, index: number) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
        {/* DNEVNO */}
        <TabsContent value="daily" className="mt-4">
          <PeriodReport initialPeriod="daily" />
        </TabsContent>
        {/* TEDENSKO */}
        <TabsContent value="weekly" className="mt-4">
          <PeriodReport initialPeriod="weekly" />
        </TabsContent>
        {/* MESEČNO */}
        <TabsContent value="monthly" className="mt-4">
          <PeriodReport initialPeriod="monthly" />
        </TabsContent>
        {/* LETNO */}
        <TabsContent value="yearly" className="mt-4">
          <PeriodReport initialPeriod="yearly" />
        </TabsContent>
        {/* DDV */}
        <TabsContent value="vat" className="mt-4">
          <VatReport startDate={startDate} endDate={endDate} />
        </TabsContent>
        {/* NAPITNINE */}
        <TabsContent value="tips" className="mt-4">
          <TipsReport />
        </TabsContent>
        {/* MIZE */}
        <TabsContent value="tables" className="mt-4">
          <TableRevenueReport />
        </TabsContent>
        {/* TOPLOTNA KARTA */}
        <TabsContent value="heatmap" className="mt-4">
          <HeatmapReport />
        </TabsContent>
        {/* IZPISKI */}
        <TabsContent value="booking" className="mt-4">
          <BookingExtractReport />
        </TabsContent>
        {/* ZAPOSLENI */}
        <TabsContent value="employees" className="mt-4">
          <EmployeeReport />
        </TabsContent>
        {/* IZMENE */}
        <TabsContent value="shifts" className="mt-4">
          <ShiftsReport />
        </TabsContent>
        {/* IZVOZ */}
        <TabsContent value="export" className="mt-4">
          <ExportReport />
        </TabsContent>
      </Tabs>
    </div>
  )
})
