'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatsCard } from './StatsCard'
import {
  DollarSign, ShoppingBag, TrendingUp, TrendingDown, Calendar,
  CreditCard, Wallet, Smartphone, FileText, BarChart3, ArrowUpRight,
  ArrowDownRight, ChevronLeft, ChevronRight, Printer, Download,
  Receipt, Clock, Package, AlertTriangle, Users, UserCheck,
  UtensilsCrossed, Coffee, Flame,
} from 'lucide-react'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { format, subDays, subWeeks, subMonths, subYears } from 'date-fns'
import { sl } from 'date-fns/locale'
import { authFetch } from '@/components/pos/PinLogin'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const PIE_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316']

const paymentMethodLabels: Record<string, string> = {
  cash: 'Gotovina',
  card: 'Kartica',
  mobile: 'Mobilno',
  gotovina: 'Gotovina',
  kartica: 'Kartica',
  mobilno: 'Mobilno',
}

const orderTypeLabels: Record<string, string> = {
  'dine-in': 'V lokalu',
  takeout: 'Za s seboj',
  delivery: 'Dostava',
}

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly'

export function ReportsView() {
  const [activeTab, setActiveTab] = useState('overview')
  const [period, setPeriod] = useState<PeriodType>('daily')
  const [refDate, setRefDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  // Sinhroniziraj period z activeTab (namesto IIFE v render)
  useEffect(() => {
    if (activeTab === 'daily') setPeriod('daily')
    else if (activeTab === 'weekly') setPeriod('weekly')
    else if (activeTab === 'monthly') setPeriod('monthly')
    else if (activeTab === 'yearly') setPeriod('yearly')
  }, [activeTab])

  // Navigacija po datumih
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

  // Finančno poročilo
  const { data: fin, isLoading: finLoading } = useQuery({
    queryKey: ['financial-report', period, refDate],
    queryFn: async () => {
      const res = await authFetch(`/api/reports/financial?period=${period}&date=${refDate}`)
      return res.json()
    },
  })

  // Stari podatki za overview
  const [dateRange] = useState('30')
  const startDate = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd')
  const endDate = format(new Date(), 'yyyy-MM-dd')

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['reports-sales', startDate, endDate],
    queryFn: async () => {
      const res = await authFetch(`/api/reports/sales?startDate=${startDate}&endDate=${endDate}`)
      return res.json()
    },
  })

  const { data: popularData } = useQuery({
    queryKey: ['reports-popular', startDate, endDate],
    queryFn: async () => {
      const res = await authFetch(`/api/reports/popular?startDate=${startDate}&endDate=${endDate}`)
      return res.json()
    },
  })

  // Period label
  const periodLabel = useMemo(() => {
    if (!fin) return ''
    return fin.periodLabel || ''
  }, [fin])

  const trendIcon = (change: number) => {
    if (change > 0) return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
    if (change < 0) return <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
    return null
  }

  const trendText = (change: number) => {
    if (change === 0) return 'enako'
    return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
  }

  // Format za izpiske
  const fmt = (n: number) => `€${n.toFixed(2)}`
  const fmtPct = (n: number) => `${n.toFixed(1)}%`

  // Render posameznega obdobja
  const renderPeriodReport = () => {
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
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-48">
            <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="text-center w-40 mx-auto" />
            <p className="text-sm text-muted-foreground mt-1">{periodLabel}</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {period === 'daily' ? 'Promet po urah' : period === 'weekly' ? 'Promet po dnevih' : period === 'monthly' ? 'Promet po dnevih v mesecu' : 'Promet po mesecih'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fin.timeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <Legend />
                    <Bar dataKey="revenue" name="Trenutno" fill="oklch(0.7 0.15 55)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="prevRevenue" name="Prejšnje" fill="oklch(0.5 0.1 55)" radius={[4, 4, 0, 0]} opacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Plačilne metode */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Plačilne metode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fin.paymentMethods}
                      dataKey="revenue"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ method, percent }: { method: string; percent: number }) => `${paymentMethodLabels[method] || method} ${(percent * 100).toFixed(0)}%`}
                    >
                      {fin.paymentMethods.map((_: unknown, index: number) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Podatki o plačilih */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <Wallet className="h-4 w-4 mx-auto text-green-600 mb-1" />
                  <p className="text-xs text-muted-foreground">Gotovina</p>
                  <p className="font-bold text-sm">{fmt(fin.cashRegister.totalCashSales)}</p>
                </div>
                <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <CreditCard className="h-4 w-4 mx-auto text-blue-600 mb-1" />
                  <p className="text-xs text-muted-foreground">Kartice</p>
                  <p className="font-bold text-sm">{fmt(fin.cashRegister.totalCardSales)}</p>
                </div>
                <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <Smartphone className="h-4 w-4 mx-auto text-purple-600 mb-1" />
                  <p className="text-xs text-muted-foreground">Mobilno</p>
                  <p className="font-bold text-sm">{fmt(fin.cashRegister.totalMobileSales)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
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
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fin.categoryBreakdown.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                    <YAxis type="category" dataKey="category" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <Bar dataKey="revenue" fill="oklch(0.7 0.15 55)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Stroškovna analiza
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <p className="text-xs text-muted-foreground mb-1">Prihodek</p>
                <p className="text-lg font-bold text-blue-600">{fmt(fin.summary.totalRevenue)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                <p className="text-xs text-muted-foreground mb-1">Nabavni stroški</p>
                <p className="text-lg font-bold text-orange-600">{fmt(fin.costs.procurementCost)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                <p className="text-xs text-muted-foreground mb-1">Stroški prodanih (COGS)</p>
                <p className="text-lg font-bold text-red-600">{fmt(fin.costs.cogs)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <p className="text-xs text-muted-foreground mb-1">Odpisi</p>
                <p className="text-lg font-bold text-yellow-600">{fmt(fin.costs.writeOffCost)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                <p className="text-xs text-muted-foreground mb-1">Bruto dobiček</p>
                <p className="text-lg font-bold text-green-600">{fmt(fin.costs.grossProfit)}</p>
                <p className="text-xs text-green-600">Marža: {fmtPct(fin.costs.grossMargin)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render izpiski za knjiženje
  const renderBookingExtract = () => {
    if (finLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
    if (!fin) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>

    const be = fin.bookingEntry

    return (
      <div className="space-y-6">
        {/* Navigacija po datumih */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-48">
            <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="text-center w-40 mx-auto" />
            <p className="text-sm text-muted-foreground mt-1">{periodLabel}</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Izbira obdobja za izpiske */}
        <div className="flex gap-2 justify-center">
          {(['daily', 'weekly', 'monthly', 'yearly'] as PeriodType[]).map(p => (
            <Button key={p} variant={period === p ? 'default' : 'outline'} size="sm" onClick={() => setPeriod(p)}>
              {{ daily: 'Dnevno', weekly: 'Tedensko', monthly: 'Mesečno', yearly: 'Letno' }[p]}
            </Button>
          ))}
        </div>

        {/* Izpisek prometa */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Izpisek prometa — {periodLabel}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="h-3.5 w-3.5 mr-1" /> Natisni
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Povzetek prometa */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-3 font-medium">Opis</th>
                    <th className="text-right p-3 font-medium">Znesek</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-3">Skupni promet (bruto)</td>
                    <td className="p-3 text-right font-semibold">{fmt(fin.summary.totalRevenue)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 pl-6">Promet brez DDV</td>
                    <td className="p-3 text-right">{fmt(fin.summary.totalSubtotal)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 pl-6">DDV</td>
                    <td className="p-3 text-right">{fmt(fin.summary.totalTax)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 pl-6">Popusti</td>
                    <td className="p-3 text-right text-red-600">-{fmt(fin.summary.totalDiscount)}</td>
                  </tr>
                  <tr className="border-b bg-muted/30">
                    <td className="p-3 font-medium">Po plačilnih metodah</td>
                    <td className="p-3 text-right"></td>
                  </tr>
                  {fin.paymentMethods.map((pm: { method: string; count: number; revenue: number; tax: number }, idx: number) => (
                    <tr key={idx} className="border-b">
                      <td className="p-3 pl-6">{paymentMethodLabels[pm.method] || pm.method} ({pm.count} naročil)</td>
                      <td className="p-3 text-right">{fmt(pm.revenue)}</td>
                    </tr>
                  ))}
                  <tr className="border-b bg-muted/30">
                    <td className="p-3 font-medium">Po vrstah naročil</td>
                    <td className="p-3 text-right"></td>
                  </tr>
                  {fin.orderTypes.map((ot: { type: string; count: number; revenue: number }, idx: number) => (
                    <tr key={idx} className="border-b">
                      <td className="p-3 pl-6">{orderTypeLabels[ot.type] || ot.type} ({ot.count} naročil)</td>
                      <td className="p-3 text-right">{fmt(ot.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Stroški */}
            <div className="border rounded-lg overflow-hidden">
              <div className="p-3 bg-muted/50 border-b font-medium">Stroškovna stran</div>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="p-3">Nabavni stroški (dobave)</td>
                    <td className="p-3 text-right text-orange-600">{fmt(fin.costs.procurementCost)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">Stroški prodanih artiklov (COGS)</td>
                    <td className="p-3 text-right text-red-600">{fmt(fin.costs.cogs)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">Odpisi (kvar, razbitje, izguba)</td>
                    <td className="p-3 text-right text-yellow-600">{fmt(fin.costs.writeOffCost)}</td>
                  </tr>
                  <tr className="bg-green-50 dark:bg-green-900/20">
                    <td className="p-3 font-bold">Bruto dobiček</td>
                    <td className="p-3 text-right font-bold text-green-600">{fmt(fin.costs.grossProfit)} (marža: {fmtPct(fin.costs.grossMargin)})</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Knjižbeni zapis */}
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Knjižbeni zapis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-primary/10 border-b">
                        <th className="text-left p-3 font-medium">Konto</th>
                        <th className="text-left p-3 font-medium">Opis</th>
                        <th className="text-right p-3 font-medium">Breme (D)</th>
                        <th className="text-right p-3 font-medium">Dobro (C)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(be.debit).map(([account, amount]: [string, unknown]) => (
                        <tr key={account} className="border-b">
                          <td className="p-3 font-mono text-xs">{account.split(' - ')[0]}</td>
                          <td className="p-3">{account.split(' - ')[1]}</td>
                          <td className="p-3 text-right font-semibold">{fmt(amount as number)}</td>
                          <td className="p-3 text-right">—</td>
                        </tr>
                      ))}
                      {Object.entries(be.credit).map(([account, amount]: [string, unknown]) => (
                        <tr key={account} className="border-b bg-muted/30">
                          <td className="p-3 font-mono text-xs">{account.split(' - ')[0]}</td>
                          <td className="p-3">{account.split(' - ')[1]}</td>
                          <td className="p-3 text-right">—</td>
                          <td className="p-3 text-right font-semibold">{fmt(amount as number)}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/50 font-bold">
                        <td className="p-3" colSpan={2}>SKUPAJ</td>
                        <td className="p-3 text-right">{fmt(be.totalDebit)}</td>
                        <td className="p-3 text-right">{fmt(be.totalCredit)}</td>
                      </tr>
                    </tbody>
                  </table>
                  {Math.abs(be.totalDebit - be.totalCredit) > 0.01 && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">
                      Opozorilo: Zneske se ne ujemajo! Razlika: {fmt(Math.abs(be.totalDebit - be.totalCredit))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Kategorije izpisek */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Izpisek po kategorijah</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left p-3 font-medium">Kategorija</th>
                        <th className="text-right p-3 font-medium">Količina</th>
                        <th className="text-right p-3 font-medium">Prihodek</th>
                        <th className="text-right p-3 font-medium">Delez</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fin.categoryBreakdown.map((cat: { category: string; quantity: number; revenue: number; items: number }, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-muted/30">
                          <td className="p-3">{cat.category}</td>
                          <td className="p-3 text-right">{cat.quantity}</td>
                          <td className="p-3 text-right font-medium">{fmt(cat.revenue)}</td>
                          <td className="p-3 text-right">{fmtPct(fin.summary.totalRevenue > 0 ? (cat.revenue / fin.summary.totalRevenue) * 100 : 0)}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/50 font-bold">
                        <td className="p-3">SKUPAJ</td>
                        <td className="p-3 text-right">{fin.categoryBreakdown.reduce((s: number, c: { quantity: number }) => s + c.quantity, 0)}</td>
                        <td className="p-3 text-right">{fmt(fin.summary.totalRevenue)}</td>
                        <td className="p-3 text-right">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Artikli izpisek */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Izpisek po artiklih</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/50">
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Artikel</th>
                        <th className="text-left p-3 font-medium">Kategorija</th>
                        <th className="text-right p-3 font-medium">Kol.</th>
                        <th className="text-right p-3 font-medium">Cena</th>
                        <th className="text-right p-3 font-medium">Prihodek</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fin.itemBreakdown.map((item: { name: string; category: string; quantity: number; revenue: number; avgPrice: number }, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-muted/30">
                          <td className="p-3">{item.name}</td>
                          <td className="p-3 text-muted-foreground">{item.category}</td>
                          <td className="p-3 text-right">{item.quantity}</td>
                          <td className="p-3 text-right">{fmt(item.avgPrice)}</td>
                          <td className="p-3 text-right font-medium">{fmt(item.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Statistika naročil */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Statistika naročil</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground">Vseh naročil</p>
                    <p className="text-xl font-bold">{fin.summary.totalOrdersCount}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground">Zaključenih</p>
                    <p className="text-xl font-bold text-green-600">{fin.summary.completedCount}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground">Preklicanih</p>
                    <p className="text-xl font-bold text-red-600">{fin.summary.cancelledCount}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground">Povpr. vrednost</p>
                    <p className="text-xl font-bold">{fmt(fin.summary.avgOrderValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    )
  }

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
          {renderPeriodReport()}
        </TabsContent>

        {/* TEDENSKO */}
        <TabsContent value="weekly" className="mt-4">
          {renderPeriodReport()}
        </TabsContent>

        {/* MESEČNO */}
        <TabsContent value="monthly" className="mt-4">
          {renderPeriodReport()}
        </TabsContent>

        {/* LETNO */}
        <TabsContent value="yearly" className="mt-4">
          {renderPeriodReport()}
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
          {renderBookingExtract()}
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
}

// ============================================
// DDV POROČILO — Posebna komponenta za davčno razčlenitev
// ============================================

function VatReport({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [vatPeriod, setVatPeriod] = useState('monthly')
  const [vatStart, setVatStart] = useState(startDate)
  const [vatEnd, setVatEnd] = useState(endDate)

  const { data: vatData, isLoading: vatLoading } = useQuery({
    queryKey: ['vat-report', vatPeriod, vatStart, vatEnd],
    queryFn: async () => {
      const res = await authFetch(`/api/reports/vat?period=${vatPeriod}&startDate=${vatStart}&endDate=${vatEnd}`)
      return res.json()
    },
  })

  const fmt = (n: number) => `€${n.toFixed(2)}`

  if (vatLoading) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  }

  if (!vatData) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>

  const vatColors: Record<string, string> = {
    '22': '#ef4444',
    '9.5': '#f59e0b',
    '0': '#10b981',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          DDV razčlenitev
        </h3>
        <div className="flex items-center gap-3">
          <Input type="date" value={vatStart} onChange={e => setVatStart(e.target.value)} className="w-36" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" value={vatEnd} onChange={e => setVatEnd(e.target.value)} className="w-36" />
          <div className="flex gap-1">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
              <Button key={p} variant={vatPeriod === p ? 'default' : 'outline'} size="sm" onClick={() => setVatPeriod(p)}>
                {{ daily: 'Dnevno', weekly: 'Tedensko', monthly: 'Mesečno', yearly: 'Letno' }[p]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border">
          <p className="text-xs text-muted-foreground mb-1">Skupna osnova</p>
          <p className="text-xl font-bold text-blue-600">{fmt(vatData.summary.totalBase)}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border">
          <p className="text-xs text-muted-foreground mb-1">Skupni DDV</p>
          <p className="text-xl font-bold text-red-600">{fmt(vatData.summary.totalVat)}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border">
          <p className="text-xs text-muted-foreground mb-1">Z DDV</p>
          <p className="text-xl font-bold text-green-600">{fmt(vatData.summary.totalWithVat)}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border">
          <p className="text-xs text-muted-foreground mb-1">Naročila</p>
          <p className="text-xl font-bold text-purple-600">{vatData.summary.completedOrders}</p>
        </div>
      </div>

      {/* DDV po stopnjah */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">DDV po stopnjah</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-3 font-medium">Stopnja</th>
                    <th className="text-right p-3 font-medium">Osnova</th>
                    <th className="text-right p-3 font-medium">DDV</th>
                    <th className="text-right p-3 font-medium">Skupaj</th>
                    <th className="text-right p-3 font-medium">Koda</th>
                  </tr>
                </thead>
                <tbody>
                  {vatData.vatBreakdown.map((vr: { rate: number; label: string; code: string; baseAmount: number; vatAmount: number; totalAmount: number; itemCount: number }, idx: number) => (
                    <tr key={idx} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: vatColors[String(vr.rate)] || '#888' }} />
                          <span className="font-medium">{vr.label}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">{fmt(vr.baseAmount)}</td>
                      <td className="p-3 text-right font-semibold" style={{ color: vatColors[String(vr.rate)] }}>{fmt(vr.vatAmount)}</td>
                      <td className="p-3 text-right font-semibold">{fmt(vr.totalAmount)}</td>
                      <td className="p-3 text-right"><Badge variant="outline" className="font-mono text-xs">{vr.code}</Badge></td>
                    </tr>
                  ))}
                  <tr className="bg-muted/50 font-bold">
                    <td className="p-3">SKUPAJ</td>
                    <td className="p-3 text-right">{fmt(vatData.summary.totalBase)}</td>
                    <td className="p-3 text-right">{fmt(vatData.summary.totalVat)}</td>
                    <td className="p-3 text-right">{fmt(vatData.summary.totalWithVat)}</td>
                    <td className="p-3"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Tortni diagram DDV */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Delež po DDV stopnjah</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vatData.vatBreakdown.filter((vr: { baseAmount: number }) => vr.baseAmount > 0)}
                    dataKey="totalAmount"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ label, percent }: { label: string; percent: number }) => `${label} ${(percent * 100).toFixed(0)}%`}
                  >
                    {vatData.vatBreakdown.filter((vr: { baseAmount: number }) => vr.baseAmount > 0).map((vr: { rate: number }, index: number) => (
                      <Cell key={`cell-${index}`} fill={vatColors[String(vr.rate)] || PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Znesek z DDV']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Časovna razdelitev DDV */}
      {vatData.timeDistribution && vatData.timeDistribution.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4" />
              DDV po obdobjih
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vatData.timeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Legend />
                  <Bar dataKey="vat22" name="DDV 22%" fill="#ef4444" stackId="vat" />
                  <Bar dataKey="vat95" name="DDV 9.5%" fill="#f59e0b" stackId="vat" />
                  <Bar dataKey="vat0" name="DDV 0%" fill="#10b981" stackId="vat" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FURS format */}
      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            FURS davčni format
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary/10 border-b">
                  <th className="text-left p-3 font-medium">Koda</th>
                  <th className="text-right p-3 font-medium">Stopnja (%)</th>
                  <th className="text-right p-3 font-medium">Davčna osnova</th>
                  <th className="text-right p-3 font-medium">DDV znesek</th>
                </tr>
              </thead>
              <tbody>
                {vatData.fursFormat.map((f: { code: string; taxRate: number; taxBase: number; taxAmount: number }, idx: number) => (
                  <tr key={idx} className="border-b">
                    <td className="p-3 font-mono font-bold">{f.code}</td>
                    <td className="p-3 text-right">{f.taxRate}%</td>
                    <td className="p-3 text-right">{fmt(f.taxBase)}</td>
                    <td className="p-3 text-right font-semibold">{fmt(f.taxAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Kode: S = Standardna stopnja (22%), R = Znižana stopnja (9.5%), Z = Oproščeno (0%)
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// POROČILO PO ZAPOSLENIH
// ============================================

function EmployeeReport() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const { data, isLoading } = useQuery({
    queryKey: ['employee-report', startDate, endDate],
    queryFn: async () => {
      const res = await authFetch(`/api/reports/employees?startDate=${startDate}&endDate=${endDate}`)
      return res.json()
    },
  })

  const fmt = (n: number) => `€${n.toFixed(2)}`

  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  if (!data) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>

  const { employees, totals } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Poročilo po zaposlenih
        </h3>
        <div className="flex items-center gap-3">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" />
        </div>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Skupaj prihodek</p><p className="text-xl font-bold text-blue-600">{fmt(totals.totalRevenue)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Skupaj napitnine</p><p className="text-xl font-bold text-green-600">{fmt(totals.totalTips)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Naročil skupaj</p><p className="text-xl font-bold">{totals.totalOrders}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Prodanih artiklov</p><p className="text-xl font-bold">{totals.totalItemsSold}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Povpr. naročilo</p><p className="text-xl font-bold">{fmt(totals.avgOrderValue)}</p></CardContent></Card>
      </div>

      {/* Grafikon po zaposlenih */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Prihodek po zaposlenih</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employees} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                <YAxis type="category" dataKey="employeeName" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                <Bar dataKey="totalRevenue" fill="oklch(0.7 0.15 55)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela po zaposlenih */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Podrobnosti po zaposlenih</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left p-3 font-medium">Zaposleni</th>
                  <th className="text-left p-3 font-medium">Vloga</th>
                  <th className="text-right p-3 font-medium">Naročila</th>
                  <th className="text-right p-3 font-medium">Prihodek</th>
                  <th className="text-right p-3 font-medium">Napitnine</th>
                  <th className="text-right p-3 font-medium">Povpr.</th>
                  <th className="text-right p-3 font-medium">Artikli</th>
                  <th className="text-right p-3 font-medium">Poničeno</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp: any) => (
                  <tr key={emp.employeeId} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{emp.employeeName}</td>
                    <td className="p-3 text-muted-foreground">{emp.role}</td>
                    <td className="p-3 text-right">{emp.orderCount}</td>
                    <td className="p-3 text-right font-semibold">{fmt(emp.totalRevenue)}</td>
                    <td className="p-3 text-right text-green-600">{fmt(emp.totalTips)}</td>
                    <td className="p-3 text-right">{fmt(emp.avgOrderValue)}</td>
                    <td className="p-3 text-right">{emp.itemsSold}</td>
                    <td className="p-3 text-right text-red-600">{emp.voidedItems}</td>
                  </tr>
                ))}
                <tr className="bg-muted/50 font-bold">
                  <td className="p-3" colSpan={2}>SKUPAJ</td>
                  <td className="p-3 text-right">{totals.totalOrders}</td>
                  <td className="p-3 text-right">{fmt(totals.totalRevenue)}</td>
                  <td className="p-3 text-right text-green-600">{fmt(totals.totalTips)}</td>
                  <td className="p-3 text-right">{fmt(totals.avgOrderValue)}</td>
                  <td className="p-3 text-right">{totals.totalItemsSold}</td>
                  <td className="p-3 text-right text-red-600">{totals.totalVoidedItems}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {employees.length === 0 && <p className="text-center py-8 text-muted-foreground">Ni podatkov za izbrano obdobje</p>}
    </div>
  )
}

// ============================================
// POROČILO IZMEN (BLAGAJNA)
// ============================================

function ShiftsReport() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const { data, isLoading } = useQuery({
    queryKey: ['shifts-report', startDate, endDate],
    queryFn: async () => {
      const res = await authFetch(`/api/reports/shifts?startDate=${startDate}&endDate=${endDate}`)
      return res.json()
    },
  })

  const fmt = (n: number) => `€${n.toFixed(2)}`
  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${h}h ${m}min`
  }

  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  if (!data) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>

  const { shifts, summary } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Poročilo izmen (blagajna)
        </h3>
        <div className="flex items-center gap-3">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" />
        </div>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Izmene skupaj</p><p className="text-xl font-bold">{summary.totalShifts}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Skupaj prodaja</p><p className="text-xl font-bold text-blue-600">{fmt(summary.totalSales)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Gotovina</p><p className="text-xl font-bold text-green-600">{fmt(summary.totalCashSales)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Kartice</p><p className="text-xl font-bold text-blue-600">{fmt(summary.totalCardSales)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Napitnine</p><p className="text-xl font-bold text-emerald-600">{fmt(summary.totalTips)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Povpr. trajanje</p><p className="text-xl font-bold">{formatDuration(summary.avgDurationMinutes)}</p></CardContent></Card>
      </div>

      {/* Seznam izmen */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Seznam izmen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left p-3 font-medium">Zaposleni</th>
                  <th className="text-left p-3 font-medium">Odprto</th>
                  <th className="text-left p-3 font-medium">Zaprto</th>
                  <th className="text-right p-3 font-medium">Trajanje</th>
                  <th className="text-right p-3 font-medium">Začetna</th>
                  <th className="text-right p-3 font-medium">Končna</th>
                  <th className="text-right p-3 font-medium">Gotovina</th>
                  <th className="text-right p-3 font-medium">Kartice</th>
                  <th className="text-right p-3 font-medium">Skupaj</th>
                  <th className="text-right p-3 font-medium">Napitnine</th>
                  <th className="text-right p-3 font-medium">Razlika</th>
                  <th className="text-center p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift: any) => (
                  <tr key={shift.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{shift.employeeName || '—'}</td>
                    <td className="p-3 text-xs">{new Date(shift.openedAt).toLocaleString('sl-SI')}</td>
                    <td className="p-3 text-xs">{shift.closedAt ? new Date(shift.closedAt).toLocaleString('sl-SI') : <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Odprto</Badge>}</td>
                    <td className="p-3 text-right">{formatDuration(shift.durationMinutes)}</td>
                    <td className="p-3 text-right">{fmt(shift.startingCash)}</td>
                    <td className="p-3 text-right">{fmt(shift.closingCash)}</td>
                    <td className="p-3 text-right text-green-600">{fmt(shift.cashSales)}</td>
                    <td className="p-3 text-right text-blue-600">{fmt(shift.cardSales)}</td>
                    <td className="p-3 text-right font-semibold">{fmt(shift.totalSales)}</td>
                    <td className="p-3 text-right text-emerald-600">{fmt(shift.totalTips)}</td>
                    <td className={`p-3 text-right font-semibold ${shift.cashDifference < -0.01 ? 'text-red-600' : shift.cashDifference > 0.01 ? 'text-green-600' : ''}`}>{fmt(shift.cashDifference)}</td>
                    <td className="p-3 text-center"><Badge variant={shift.status === 'open' ? 'default' : 'secondary'}>{shift.status === 'open' ? 'Odprto' : 'Zaprto'}</Badge></td>
                  </tr>
                ))}
                {shifts.length === 0 && (
                  <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">Ni izmen za izbrano obdobje</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// IZVOZ POROČIL V CSV
// ============================================

function ExportReport() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [exportType, setExportType] = useState('orders')
  const [exporting, setExporting] = useState(false)

  const exportTypes = [
    { value: 'orders', label: 'Naročila', description: 'Vsa naročila s podrobnostmi in artikli', icon: ShoppingBag },
    { value: 'items', label: 'Artikli', description: 'Prodaja po artiklih s kategorijami in DDV', icon: Package },
    { value: 'vat', label: 'DDV', description: 'DDV razčlenitev po stopnjah', icon: Receipt },
    { value: 'employees', label: 'Zaposleni', description: 'Prodaja in napitnine po zaposlenih', icon: Users },
    { value: 'shifts', label: 'Izmene', description: 'Podatki o izmenah blagajne', icon: Clock },
    { value: 'inventory', label: 'Zaloga', description: 'Trenutno stanje zaloge', icon: Package },
  ]

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await authFetch(`/api/reports/export?type=${exportType}&startDate=${startDate}&endDate=${endDate}`)
      if (!res.ok) throw new Error('Napaka pri izvozu')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${exportType}_${startDate}_${endDate}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Download className="h-5 w-5" />
          Izvoz poročil v CSV
        </h3>
        <div className="flex items-center gap-3">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" />
          <span className="text-muted-foreground">—</span>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Izvozite podatke v CSV format, ki ga odprete v Excelu ali drugem programu. Datoteka uporablja UTF-8 kodiranje s podporo za slovenske znake.
      </p>

      {/* Izbira vrste izvoza */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {exportTypes.map(type => {
          const Icon = type.icon
          const isActive = exportType === type.value
          return (
            <button
              key={type.value}
              onClick={() => setExportType(type.value)}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                isActive ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:bg-accent/50'
              }`}
            >
              <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <p className={`font-semibold text-sm ${isActive ? 'text-primary' : ''}`}>{type.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Gumb za izvoz */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Izvoz: {exportTypes.find(t => t.value === exportType)?.label}</p>
              <p className="text-sm text-muted-foreground">
                Obdobje: {new Date(startDate).toLocaleDateString('sl-SI')} — {new Date(endDate).toLocaleDateString('sl-SI')}
              </p>
            </div>
            <Button size="lg" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Izvažam...' : 'Prenesi CSV'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Opombe */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground">Opombe o izvozu:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>CSV datoteka uporablja podpičje (;) kot ločilo za združljivost s slovenskim Excelom</li>
              <li>Kodiranje je UTF-8 z BOM za pravilen prikaz slovenskih znakov (š, č, ž)</li>
              <li>Naročila vsebujejo vse statuse (tudi preklicana) z razlogom</li>
              <li>DDV izvoz vsebuje razčlenitev po stopnjah (22%, 9.5%, 0%) za FURS poročanje</li>
              <li>Zaloga izvozi trenutno stanje ne glede na izbrano obdobje</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// NAPITNINE — Razčlenitev napitnin po zaposlenih
// ============================================

function TipsReport() {
  const [period, setPeriod] = useState<PeriodType>('daily')
  const [refDate, setRefDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const navigateDate = (dir: number) => {
    const d = new Date(refDate)
    switch (period) {
      case 'daily': d.setDate(d.getDate() + dir); break
      case 'weekly': d.setDate(d.getDate() + dir * 7); break
      case 'monthly': d.setMonth(d.getMonth() + dir); break
      case 'yearly': d.setFullYear(d.getFullYear() + dir); break
    }
    setRefDate(format(d, 'yyyy-MM-dd'))
  }

  const { data: fin, isLoading } = useQuery({
    queryKey: ['financial-report-tips', period, refDate],
    queryFn: async () => {
      const res = await authFetch(`/api/reports/financial?period=${period}&date=${refDate}`)
      return res.json()
    },
  })

  const fmt = (n: number) => `€${n.toFixed(2)}`
  const fmtPct = (n: number) => `${n.toFixed(1)}%`

  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  if (!fin) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>

  const tipsByEmp = fin.tipsByEmployee || []
  const totalTips = fin.totalTips || 0
  const avgTipPerOrder = fin.avgTipPerOrder || 0
  const tipPercentage = fin.tipPercentage || 0
  const periodLabel = fin.periodLabel || ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center min-w-48">
          <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="text-center w-40 mx-auto" />
          <p className="text-sm text-muted-foreground mt-1">{periodLabel}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2 justify-center">
        {(['daily', 'weekly', 'monthly', 'yearly'] as PeriodType[]).map(p => (
          <Button key={p} variant={period === p ? 'default' : 'outline'} size="sm" onClick={() => setPeriod(p)}>
            {{ daily: 'Dnevno', weekly: 'Tedensko', monthly: 'Mesečno', yearly: 'Letno' }[p]}
          </Button>
        ))}
      </div>

      {/* Kazalci napitnin */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border">
          <Wallet className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">Skupne napitnine</p>
          <p className="text-2xl font-bold text-emerald-600">{fmt(totalTips)}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border">
          <ShoppingBag className="h-5 w-5 mx-auto text-blue-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">Povp. na naročilo</p>
          <p className="text-2xl font-bold text-blue-600">{fmt(avgTipPerOrder)}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border">
          <TrendingUp className="h-5 w-5 mx-auto text-purple-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">% napitnine</p>
          <p className="text-2xl font-bold text-purple-600">{fmtPct(tipPercentage)}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border">
          <Users className="h-5 w-5 mx-auto text-amber-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">Zaposleni z napitninami</p>
          <p className="text-2xl font-bold text-amber-600">{tipsByEmp.length}</p>
        </div>
      </div>

      {/* Grafikon napitnin po zaposlenih */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-4 w-4" />
              Napitnine po zaposlenih
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tipsByEmp.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tipsByEmp} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                    <YAxis type="category" dataKey="employeeName" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Napitnine']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <Bar dataKey="tips" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center py-12 text-muted-foreground">Ni napitnin v tem obdobju</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Podrobnosti po zaposlenih</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50">
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Zaposleni</th>
                    <th className="text-right p-3 font-medium">Napitnine</th>
                    <th className="text-right p-3 font-medium">Naročila</th>
                    <th className="text-right p-3 font-medium">Povp.</th>
                  </tr>
                </thead>
                <tbody>
                  {tipsByEmp.map((emp: { employeeName: string; tips: number; orderCount: number; avgTip: number }, idx: number) => (
                    <tr key={idx} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-medium">{emp.employeeName}</td>
                      <td className="p-3 text-right text-emerald-600 font-semibold">{fmt(emp.tips)}</td>
                      <td className="p-3 text-right">{emp.orderCount}</td>
                      <td className="p-3 text-right">{fmt(emp.avgTip)}</td>
                    </tr>
                  ))}
                  {tipsByEmp.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Ni napitnin</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Napitnine po plačilnih metodah */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Napitnine po plačilnih metodah
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {(fin.paymentMethods || []).map((pm: { method: string; tips: number; count: number }, idx: number) => (
              <div key={idx} className="text-center p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground">{paymentMethodLabels[pm.method] || pm.method}</p>
                <p className="text-lg font-bold text-emerald-600">{fmt(pm.tips || 0)}</p>
                <p className="text-xs text-muted-foreground">{pm.count} naročil</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// PRIHODEK PO MIZAH — Analiza zasedenosti in prometa
// ============================================

function TableRevenueReport() {
  const [period, setPeriod] = useState<PeriodType>('daily')
  const [refDate, setRefDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const navigateDate = (dir: number) => {
    const d = new Date(refDate)
    switch (period) {
      case 'daily': d.setDate(d.getDate() + dir); break
      case 'weekly': d.setDate(d.getDate() + dir * 7); break
      case 'monthly': d.setMonth(d.getMonth() + dir); break
      case 'yearly': d.setFullYear(d.getFullYear() + dir); break
    }
    setRefDate(format(d, 'yyyy-MM-dd'))
  }

  const { data: fin, isLoading } = useQuery({
    queryKey: ['financial-report-tables', period, refDate],
    queryFn: async () => {
      const res = await authFetch(`/api/reports/financial?period=${period}&date=${refDate}`)
      return res.json()
    },
  })

  const fmt = (n: number) => `€${n.toFixed(2)}`

  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  if (!fin) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>

  const tables = fin.tableRevenue || []
  const totalTableRevenue = tables.reduce((s: number, t: { revenue: number }) => s + t.revenue, 0)
  const totalTableOrders = tables.reduce((s: number, t: { orderCount: number }) => s + t.orderCount, 0)
  const totalTableTips = tables.reduce((s: number, t: { tips: number }) => s + t.tips, 0)

  // Grupiraj po conah
  const areas: Record<string, { area: string; tables: typeof tables; revenue: number }> = {}
  tables.forEach((t: { area: string; revenue: number }) => {
    if (!areas[t.area]) areas[t.area] = { area: t.area, tables: [], revenue: 0 }
    areas[t.area].tables.push(t)
    areas[t.area].revenue += t.revenue
  })

  const areaLabels: Record<string, string> = {
    main: 'Glavna dvorana',
    terrace: 'Terasa',
    bar: 'Bar',
    vip: 'VIP',
    garden: 'Vrt',
    private: 'Zasebni prostor',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center min-w-48">
          <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="text-center w-40 mx-auto" />
          <p className="text-sm text-muted-foreground mt-1">{fin.periodLabel || ''}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2 justify-center">
        {(['daily', 'weekly', 'monthly', 'yearly'] as PeriodType[]).map(p => (
          <Button key={p} variant={period === p ? 'default' : 'outline'} size="sm" onClick={() => setPeriod(p)}>
            {{ daily: 'Dnevno', weekly: 'Tedensko', monthly: 'Mesečno', yearly: 'Letno' }[p]}
          </Button>
        ))}
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border">
          <UtensilsCrossed className="h-5 w-5 mx-auto text-blue-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">Aktivne mize</p>
          <p className="text-2xl font-bold text-blue-600">{tables.length}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border">
          <DollarSign className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">Prihodek mize</p>
          <p className="text-2xl font-bold text-emerald-600">{fmt(totalTableRevenue)}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border">
          <ShoppingBag className="h-5 w-5 mx-auto text-purple-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">Naročila</p>
          <p className="text-2xl font-bold text-purple-600">{totalTableOrders}</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border">
          <Wallet className="h-5 w-5 mx-auto text-amber-600 mb-1" />
          <p className="text-xs text-muted-foreground mb-1">Napitnine</p>
          <p className="text-2xl font-bold text-amber-600">{fmt(totalTableTips)}</p>
        </div>
      </div>

      {/* Grafikon po mizah */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4" />
              Prihodek po mizah
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tables.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tables.slice(0, 15)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="tableNumber" tick={{ fontSize: 11 }} label={{ value: 'Miza', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                    <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center py-12 text-muted-foreground">Ni naročil za mizami v tem obdobju</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Prihodek po conah</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.values(areas).length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.values(areas)}
                      dataKey="revenue"
                      nameKey="area"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ area, percent }: { area: string; percent: number }) => `${areaLabels[area] || area} ${(percent * 100).toFixed(0)}%`}
                    >
                      {Object.values(areas).map((_entry: unknown, index: number) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center py-12 text-muted-foreground">Ni podatkov po conah</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela podrobnosti */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Podrobnosti po mizah</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50">
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Miza</th>
                  <th className="text-left p-3 font-medium">Cona</th>
                  <th className="text-right p-3 font-medium">Naročila</th>
                  <th className="text-right p-3 font-medium">Prihodek</th>
                  <th className="text-right p-3 font-medium">Povp.</th>
                  <th className="text-right p-3 font-medium">Napitnine</th>
                </tr>
              </thead>
              <tbody>
                {tables.map((t: { tableNumber: number; area: string; orderCount: number; revenue: number; avgOrder: number; tips: number }, idx: number) => (
                  <tr key={idx} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-bold">Miza {t.tableNumber}</td>
                    <td className="p-3">{areaLabels[t.area] || t.area}</td>
                    <td className="p-3 text-right">{t.orderCount}</td>
                    <td className="p-3 text-right font-semibold text-emerald-600">{fmt(t.revenue)}</td>
                    <td className="p-3 text-right">{fmt(t.avgOrder)}</td>
                    <td className="p-3 text-right text-amber-600">{fmt(t.tips)}</td>
                  </tr>
                ))}
                {tables.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Ni naročil za mizami</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// TOPLOTNA KARTA — Urna analiza prometa
// ============================================

function HeatmapReport() {
  const [period, setPeriod] = useState<PeriodType>('daily')
  const [refDate, setRefDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const navigateDate = (dir: number) => {
    const d = new Date(refDate)
    switch (period) {
      case 'daily': d.setDate(d.getDate() + dir); break
      case 'weekly': d.setDate(d.getDate() + dir * 7); break
      case 'monthly': d.setMonth(d.getMonth() + dir); break
      case 'yearly': d.setFullYear(d.getFullYear() + dir); break
    }
    setRefDate(format(d, 'yyyy-MM-dd'))
  }

  const { data: fin, isLoading } = useQuery({
    queryKey: ['financial-report-heatmap', period, refDate],
    queryFn: async () => {
      const res = await authFetch(`/api/reports/financial?period=${period}&date=${refDate}`)
      return res.json()
    },
  })

  const fmt = (n: number) => `€${n.toFixed(2)}`

  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
  if (!fin) return <p className="text-center py-12 text-muted-foreground">Ni podatkov</p>

  const heatmap = fin.hourlyHeatmap || []
  const maxRevenue = Math.max(...heatmap.map((h: { revenue: number }) => h.revenue), 1)

  // Barvna skala za intenziteto
  const getIntensityColor = (intensity: number) => {
    if (intensity === 0) return 'bg-gray-100 dark:bg-gray-800'
    if (intensity < 20) return 'bg-blue-200 dark:bg-blue-900/40'
    if (intensity < 40) return 'bg-green-200 dark:bg-green-900/40'
    if (intensity < 60) return 'bg-yellow-200 dark:bg-yellow-900/40'
    if (intensity < 80) return 'bg-orange-300 dark:bg-orange-900/40'
    return 'bg-red-400 dark:bg-red-900/50'
  }

  const getIntensityText = (intensity: number) => {
    if (intensity === 0) return 'text-gray-500'
    if (intensity < 40) return 'text-gray-700 dark:text-gray-300'
    if (intensity < 70) return 'text-gray-800 dark:text-gray-200'
    return 'text-white dark:text-white'
  }

  // Identificiraj špice
  const peakHours = heatmap
    .filter((h: { revenue: number }) => h.revenue > 0)
    .sort((a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue)
    .slice(0, 5)

  const timeSlotLabels: Record<string, string> = {
    'Noč': '🌙 Noč (0-5h)',
    'Jutro': '☀️ Jutro (6-9h)',
    'Kosilo': '🍽️ Kosilo (10-13h)',
    'Popoldne': '☕ Popoldne (14-16h)',
    'Večerja': '🍷 Večerja (17-20h)',
    'Po večerji': '🌃 Po večerji (21-23h)',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center min-w-48">
          <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="text-center w-40 mx-auto" />
          <p className="text-sm text-muted-foreground mt-1">{fin.periodLabel || ''}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Toplotna karta — 24 ur */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Flame className="h-4 w-4" />
            Urna toplotna karta prometa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
            {heatmap.map((h: { hour: number; revenue: number; orders: number; intensity: number; label: string }) => (
              <div
                key={h.hour}
                className={`relative p-2 rounded-lg text-center cursor-default transition-transform hover:scale-105 ${getIntensityColor(h.intensity)}`}
                title={`Ura ${h.hour}:00 — ${fmt(h.revenue)} | ${h.orders} naročil | ${h.label}`}
              >
                <p className={`text-xs font-bold ${getIntensityText(h.intensity)}`}>{String(h.hour).padStart(2, '0')}:00</p>
                <p className={`text-[10px] ${getIntensityText(h.intensity)}`}>{h.revenue > 0 ? fmt(h.revenue) : '—'}</p>
                <p className={`text-[9px] opacity-70 ${getIntensityText(h.intensity)}`}>{h.orders > 0 ? `${h.orders}×` : ''}</p>
              </div>
            ))}
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
            <span>Nizka</span>
            <div className="flex gap-1">
              <div className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="w-4 h-4 rounded bg-blue-200 dark:bg-blue-900/40" />
              <div className="w-4 h-4 rounded bg-green-200 dark:bg-green-900/40" />
              <div className="w-4 h-4 rounded bg-yellow-200 dark:bg-yellow-900/40" />
              <div className="w-4 h-4 rounded bg-orange-300 dark:bg-orange-900/40" />
              <div className="w-4 h-4 rounded bg-red-400 dark:bg-red-900/50" />
            </div>
            <span>Visoka</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Časovni razdelki */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Promet po delih dneva
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={heatmap}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}h`} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                  <Tooltip formatter={(value: number, name: string) => [name === 'revenue' ? `€${value.toFixed(2)}` : value, name === 'revenue' ? 'Prihodek' : 'Naročila']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Špice */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Najboljše ure (špice)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {peakHours.map((h: { hour: number; revenue: number; orders: number; label: string }, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-amber-500">#{idx + 1}</span>
                    <div>
                      <p className="font-semibold">{String(h.hour).padStart(2, '0')}:00 — {String(h.hour + 1).padStart(2, '0')}:00</p>
                      <p className="text-xs text-muted-foreground">{timeSlotLabels[h.label] || h.label}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{fmt(h.revenue)}</p>
                    <p className="text-xs text-muted-foreground">{h.orders} naročil</p>
                  </div>
                </div>
              ))}
              {peakHours.length === 0 && (
                <p className="text-center py-6 text-muted-foreground">Ni prometa v tem obdobju</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Primerjava s prejšnjim obdobjem */}
      {fin.periodComparison && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Primerjava s prejšnjim obdobjem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Prihodek', current: fin.periodComparison.current.revenue, previous: fin.periodComparison.previous.revenue, change: fin.periodComparison.changes.revenue },
                { label: 'Naročila', current: fin.periodComparison.current.orders, previous: fin.periodComparison.previous.orders, change: fin.periodComparison.changes.orders },
                { label: 'Povp. naročilo', current: fin.periodComparison.current.avgOrderValue, previous: fin.periodComparison.previous.avgOrderValue, change: fin.periodComparison.changes.avgOrderValue },
                { label: 'Napitnine', current: fin.periodComparison.current.tips, previous: fin.periodComparison.previous.tips, change: fin.periodComparison.changes.tips },
              ].map((item, idx) => (
                <div key={idx} className="text-center p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-lg font-bold">{typeof item.current === 'number' && item.label !== 'Naročila' ? fmt(item.current) : item.current}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className="text-xs text-muted-foreground">prej: {typeof item.previous === 'number' && item.label !== 'Naročila' ? fmt(item.previous) : item.previous}</span>
                    {item.change !== 0 && (
                      <Badge variant={item.change > 0 ? 'default' : 'destructive'} className="text-[10px] px-1">
                        {item.change > 0 ? '+' : ''}{item.change.toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
