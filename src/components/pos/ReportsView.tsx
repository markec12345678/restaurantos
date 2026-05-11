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
  Receipt, Clock, Package, AlertTriangle,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { format, subDays, subWeeks, subMonths, subYears } from 'date-fns'
import { sl } from 'date-fns/locale'
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

  // Navigacija po datumih
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

  // Finančno poročilo
  const { data: fin, isLoading: finLoading } = useQuery({
    queryKey: ['financial-report', period, refDate],
    queryFn: async () => {
      const res = await fetch(`/api/reports/financial?period=${period}&date=${refDate}`)
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
      const res = await fetch(`/api/reports/sales?startDate=${startDate}&endDate=${endDate}`)
      return res.json()
    },
  })

  const { data: popularData } = useQuery({
    queryKey: ['reports-popular', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/reports/popular?startDate=${startDate}&endDate=${endDate}`)
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
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
                    <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prihodek']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <Bar dataKey="revenue" fill="oklch(0.7 0.15 55)" radius={[4, 4, 0, 0]} />
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Pregled
          </TabsTrigger>
          <TabsTrigger value="daily" className="gap-1">
            <Calendar className="h-3.5 w-3.5" /> Dnevno
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-1">
            <Calendar className="h-3.5 w-3.5" /> Tedensko
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1">
            <Calendar className="h-3.5 w-3.5" /> Mesečno
          </TabsTrigger>
          <TabsTrigger value="yearly" className="gap-1">
            <Calendar className="h-3.5 w-3.5" /> Letno
          </TabsTrigger>
          <TabsTrigger value="booking" className="gap-1">
            <FileText className="h-3.5 w-3.5" /> Izpiski
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
          {(() => { setPeriod('daily'); return null })()}
          {renderPeriodReport()}
        </TabsContent>

        {/* TEDENSKO */}
        <TabsContent value="weekly" className="mt-4">
          {(() => { setPeriod('weekly'); return null })()}
          {renderPeriodReport()}
        </TabsContent>

        {/* MESEČNO */}
        <TabsContent value="monthly" className="mt-4">
          {(() => { setPeriod('monthly'); return null })()}
          {renderPeriodReport()}
        </TabsContent>

        {/* LETNO */}
        <TabsContent value="yearly" className="mt-4">
          {(() => { setPeriod('yearly'); return null })()}
          {renderPeriodReport()}
        </TabsContent>

        {/* IZPISKI */}
        <TabsContent value="booking" className="mt-4">
          {renderBookingExtract()}
        </TabsContent>
      </Tabs>
    </div>
  )
}
