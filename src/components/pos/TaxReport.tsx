'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FileText,
  Calculator,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  Receipt,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'

interface TaxReportData {
  period: string
  periodStart: string
  periodEnd: string
  totalRevenue: number
  taxableRevenue: number
  exemptRevenue: number
  taxBreakdown: {
    rate: number
    label: string
    base: number
    tax: number
    total: number
  }[]
  totalTax: number
  totalWithTax: number
  fursSubmissions: number
  fursPending: number
  fursFailed: number
  zReportsCount: number
  dailyBreakdown: {
    date: string
    revenue: number
    tax: number
    zReport: boolean
  }[]
}

export function TaxReport() {
  const [data, setData] = useState<TaxReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month')

  useEffect(() => {
    loadReport()
  }, [period])

  const loadReport = async () => {
    setLoading(true)
    try {
      const now = new Date()
      let periodStart: Date
      let periodEnd = now

      switch (period) {
        case 'month':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3)
          periodStart = new Date(now.getFullYear(), quarter * 3, 1)
          break
        case 'year':
          periodStart = new Date(now.getFullYear(), 0, 1)
          break
      }

      // Naloži naročila
      const ordersRes = await fetch(`/api/orders?startDate=${periodStart.toISOString()}&endDate=${periodEnd.toISOString()}`)
      const ordersData = await ordersRes.json()

      // Naloži Z-poročila
      const zRes = await fetch('/api/z-report')
      const zData = await zRes.json()

      // Naloži FURS podatke
      const fursRes = await fetch('/api/furs')
      const fursData = await fursRes.json()

      const completedOrders = (ordersData || []).filter((o: any) =>
        o.status === 'completed' || o.status === 'paid'
      )

      // Izračunaj davčne stopnje (slovenski DDV)
      let tax22Base = 0, tax22Tax = 0
      let tax95Base = 0, tax95Tax = 0
      let tax5Base = 0, tax5Tax = 0
      let tax0Base = 0

      completedOrders.forEach((order: any) => {
        const items = order.items || order.orderItems || []
        items.forEach((item: any) => {
          const price = (item.price || item.unitPrice || 0) * (item.quantity || 1)
          const taxRate = item.taxRate || 22 // Privzeto 22%

          if (taxRate === 22) {
            tax22Base += price / 1.22
            tax22Tax += price - (price / 1.22)
          } else if (taxRate === 9.5) {
            tax95Base += price / 1.095
            tax95Tax += price - (price / 1.095)
          } else if (taxRate === 5) {
            tax5Base += price / 1.05
            tax5Tax += price - (price / 1.05)
          } else {
            tax0Base += price
          }
        })
      })

      const totalRevenue = tax22Base + tax95Base + tax5Base + tax0Base
      const totalTax = tax22Tax + tax95Tax + tax5Tax

      // Dnevni pregled
      const dailyMap: Record<string, { revenue: number; tax: number; zReport: boolean }> = {}
      completedOrders.forEach((order: any) => {
        const date = new Date(order.createdAt || order.completedAt).toISOString().split('T')[0]
        if (!dailyMap[date]) dailyMap[date] = { revenue: 0, tax: 0, zReport: false }
        dailyMap[date].revenue += order.total || 0
        dailyMap[date].tax += (order.total || 0) * 0.18 // Približek
      })

      // Označi dneve z Z-poročili
      ;(zData || []).forEach((z: any) => {
        const date = new Date(z.createdAt || z.date).toISOString().split('T')[0]
        if (dailyMap[date]) dailyMap[date].zReport = true
      })

      const dailyBreakdown = Object.entries(dailyMap)
        .map(([date, info]) => ({ date, ...info }))
        .sort((a, b) => a.date.localeCompare(b.date))

      setData({
        period: period === 'month' ? 'Mesečno' : period === 'quarter' ? 'Četrtletno' : 'Letno',
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        totalRevenue: completedOrders.reduce((s: number, o: any) => s + (o.total || 0), 0),
        taxableRevenue: totalRevenue,
        exemptRevenue: tax0Base,
        taxBreakdown: [
          { rate: 22, label: 'DDV 22% (standardna)', base: Math.round(tax22Base * 100) / 100, tax: Math.round(tax22Tax * 100) / 100, total: Math.round((tax22Base + tax22Tax) * 100) / 100 },
          { rate: 9.5, label: 'DDV 9,5% (zmanjšana)', base: Math.round(tax95Base * 100) / 100, tax: Math.round(tax95Tax * 100) / 100, total: Math.round((tax95Base + tax95Tax) * 100) / 100 },
          { rate: 5, label: 'DDV 5% (nizka)', base: Math.round(tax5Base * 100) / 100, tax: Math.round(tax5Tax * 100) / 100, total: Math.round((tax5Base + tax5Tax) * 100) / 100 },
          { rate: 0, label: 'Oproščeno (0%)', base: Math.round(tax0Base * 100) / 100, tax: 0, total: Math.round(tax0Base * 100) / 100 },
        ],
        totalTax: Math.round(totalTax * 100) / 100,
        totalWithTax: Math.round((totalRevenue + totalTax) * 100) / 100,
        fursSubmissions: fursData?.total || completedOrders.length,
        fursPending: fursData?.pending || 0,
        fursFailed: fursData?.failed || 0,
        zReportsCount: (zData || []).length,
        dailyBreakdown,
      })
    } catch (err) {
      console.error('Error loading tax report:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(amount)
  }

  if (!data) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nalaganje davčnega poročila...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Davčno poročilo</h2>
            <p className="text-sm text-muted-foreground">DDV poročilo za FURS — {data.period}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(['month', 'quarter', 'year'] as const).map(p => (
            <Button key={p} variant={period === p ? 'default' : 'outline'} size="sm" onClick={() => setPeriod(p)}>
              {p === 'month' ? 'Mesec' : p === 'quarter' ? 'Četrtletje' : 'Leto'}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Skupaj prihodek</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(data.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Skupaj DDV</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(data.totalTax)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">FURS oddano</span>
            </div>
            <p className="text-xl font-bold">{data.fursSubmissions}</p>
            {data.fursPending > 0 && <p className="text-xs text-amber-600">{data.fursPending} čakajočih</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Z-poročila</span>
            </div>
            <p className="text-xl font-bold">{data.zReportsCount}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="breakdown" className="space-y-3">
        <TabsList>
          <TabsTrigger value="breakdown">Razčlenitev DDV</TabsTrigger>
          <TabsTrigger value="daily">Dnevni pregled</TabsTrigger>
          <TabsTrigger value="furs">FURS status</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">DDV razčlenitev po stopnjah</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Header */}
                <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                  <span>Stopnja DDV</span>
                  <span className="text-right">Osnova</span>
                  <span className="text-right">DDV</span>
                  <span className="text-right">Skupaj</span>
                </div>

                {data.taxBreakdown.map(tax => (
                  <div key={tax.rate} className="grid grid-cols-4 gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{tax.rate}%</Badge>
                      {tax.label}
                    </span>
                    <span className="text-right font-medium">{formatCurrency(tax.base)}</span>
                    <span className="text-right font-medium text-emerald-600">{formatCurrency(tax.tax)}</span>
                    <span className="text-right font-medium">{formatCurrency(tax.total)}</span>
                  </div>
                ))}

                <div className="grid grid-cols-4 gap-2 text-sm font-bold pt-3 border-t">
                  <span>SKUPAJ</span>
                  <span className="text-right">{formatCurrency(data.taxableRevenue)}</span>
                  <span className="text-right text-emerald-600">{formatCurrency(data.totalTax)}</span>
                  <span className="text-right">{formatCurrency(data.totalWithTax)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Dnevni pregled</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                  <span>Datum</span>
                  <span className="text-right">Prihodek</span>
                  <span className="text-right">DDV</span>
                  <span className="text-right">Z-poročilo</span>
                </div>

                {data.dailyBreakdown.length === 0 ? (
                  <div className="py-6 text-center">
                    <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Ni podatkov za izbrano obdobje</p>
                  </div>
                ) : (
                  data.dailyBreakdown.map(day => (
                    <div key={day.date} className="grid grid-cols-4 gap-2 text-sm py-1">
                      <span>{new Date(day.date).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })}</span>
                      <span className="text-right font-medium">{formatCurrency(day.revenue)}</span>
                      <span className="text-right text-emerald-600">{formatCurrency(day.tax)}</span>
                      <span className="text-right">
                        {day.zReport ? (
                          <CheckCircle className="h-4 w-4 text-green-500 inline" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500 inline" />
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="furs" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" /> FURS davčna blagajna — Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/10">
                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-600">{data.fursSubmissions}</p>
                    <p className="text-sm text-muted-foreground">Oddanih računov</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10">
                    <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-amber-600">{data.fursPending}</p>
                    <p className="text-sm text-muted-foreground">Čakajočih računov</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/10">
                    <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-red-600">{data.fursFailed}</p>
                    <p className="text-sm text-muted-foreground">Neuspelih pošiljanj</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Informacije o FURS povezavi</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>ZOI (Zaščitni označevalnik) se generira avtomatsko ob vsakem računu.</p>
                    <p>EOR (Elektronski potrditveni zapis) se pošilja FURS-u v realnem času.</p>
                    <p>Če FURS ni dosegljiv, se EOR shrani v čakalno vrsto za poznejše pošiljanje.</p>
                    <p>Z-poročila se generirajo ob zaključku poslovnega dneva.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
