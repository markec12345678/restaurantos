'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  BarChart3,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Calculator,
  Receipt,
  Package,
  Users,
  Home,
  Building,
  Printer,
} from 'lucide-react'

interface PnLData {
  period: string
  periodStart: string
  periodEnd: string
  revenue: {
    food: number
    beverages: number
    delivery: number
    other: number
    total: number
  }
  costOfGoods: {
    food: number
    beverages: number
    total: number
  }
  grossProfit: number
  grossMargin: number
  operatingExpenses: {
    labor: number
    rent: number
    utilities: number
    marketing: number
    supplies: number
    maintenance: number
    insurance: number
    other: number
    total: number
  }
  operatingProfit: number
  operatingMargin: number
  otherIncome: number
  otherExpenses: number
  netProfit: number
  netMargin: number
  covers: number
  avgCheck: number
}

export function ProfitLossReport() {
  const [data, setData] = useState<PnLData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'quarter'>('month')
  const [compareEnabled, setCompareEnabled] = useState(false)

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
        case 'today':
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          periodStart = new Date(now)
          periodStart.setDate(now.getDate() - 7)
          break
        case 'month':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3)
          periodStart = new Date(now.getFullYear(), quarter * 3, 1)
          break
      }

      // Naloži naročila za izračun prihodka
      const ordersRes = await fetch(`/api/orders?startDate=${periodStart.toISOString()}&endDate=${periodEnd.toISOString()}`)
      const ordersData = await ordersRes.json()

      // Naloži stroške
      const expensesRes = await fetch('/api/expenses')
      const expensesData = await expensesRes.json()

      // Naloži zaposlene za izračun stroškov dela
      const empRes = await fetch('/api/employees')
      const empData = await empRes.json()

      // Naloži nabavna naročila za COGS
      const poRes = await fetch('/api/purchase-orders')
      const poData = await poRes.json()

      // Izračunaj prihodke
      const completedOrders = (ordersData || []).filter((o: any) => o.status === 'completed' || o.status === 'paid')
      const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)

      // Razdeli prihodke po kategorijah
      let foodRevenue = 0
      let beverageRevenue = 0
      let deliveryRevenue = 0

      completedOrders.forEach((order: any) => {
        const items = order.items || order.orderItems || []
        items.forEach((item: any) => {
          const cat = (item.category || '').toLowerCase()
          const price = (item.price || item.unitPrice || 0) * (item.quantity || 1)
          if (cat.includes('pijač') || cat.includes('drink') || cat.includes('vino') || cat.includes('beer') || cat.includes('coffee')) {
            beverageRevenue += price
          } else {
            foodRevenue += price
          }
        })
        if (order.deliveryFee) deliveryRevenue += order.deliveryFee
      })

      // COGS (približno 30% za hrano, 25% za pijačo)
      const foodCOGS = foodRevenue * 0.30
      const beverageCOGS = beverageRevenue * 0.25
      const totalCOGS = foodCOGS + beverageCOGS

      // Stroški iz baze
      const totalExpenses = (expensesData || []).reduce((sum: number, e: any) => {
        if (e.date && new Date(e.date) >= periodStart && new Date(e.date) <= periodEnd) {
          return sum + (e.amount || 0)
        }
        return sum
      }, 0)

      // Stroški dela (približno)
      const laborCost = (empData || []).length * 12 * 8 * 22 // 12 EUR/h * 8h * 22 dni

      // Operativni stroški
      const operatingExpenses = {
        labor: laborCost,
        rent: 1500,
        utilities: 400,
        marketing: 300,
        supplies: 200,
        maintenance: 150,
        insurance: 200,
        other: 100,
        total: laborCost + 1500 + 400 + 300 + 200 + 150 + 200 + 100,
      }

      const grossProfit = totalRevenue - totalCOGS
      const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
      const operatingProfit = grossProfit - operatingExpenses.total
      const operatingMargin = totalRevenue > 0 ? (operatingProfit / totalRevenue) * 100 : 0
      const netProfit = operatingProfit
      const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
      const covers = completedOrders.length
      const avgCheck = covers > 0 ? totalRevenue / covers : 0

      setData({
        period: period === 'today' ? 'Danes' : period === 'week' ? 'Ta teden' : period === 'month' ? 'Ta mesec' : 'To četrtletje',
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        revenue: {
          food: foodRevenue,
          beverages: beverageRevenue,
          delivery: deliveryRevenue,
          other: totalRevenue - foodRevenue - beverageRevenue - deliveryRevenue,
          total: totalRevenue,
        },
        costOfGoods: {
          food: foodCOGS,
          beverages: beverageCOGS,
          total: totalCOGS,
        },
        grossProfit,
        grossMargin,
        operatingExpenses,
        operatingProfit,
        operatingMargin,
        otherIncome: 0,
        otherExpenses: totalExpenses,
        netProfit,
        netMargin,
        covers,
        avgCheck,
      })
    } catch (err) {
      console.error('Error loading P&L report:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(amount)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  if (!data) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nalaganje P&L poročila...</p>
        </div>
      </div>
    )
  }

  const isProfitable = data.netProfit >= 0

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isProfitable ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
            {isProfitable ? (
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold">P&L Poročilo</h2>
            <p className="text-sm text-muted-foreground">Profit & Loss — {data.period}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(['today', 'week', 'month', 'quarter'] as const).map(p => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p === 'today' ? 'Danes' : p === 'week' ? 'Teden' : p === 'month' ? 'Mesec' : 'Četrtletje'}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI kartice */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Skupaj prihodek</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(data.revenue.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Bruto dobiček</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(data.grossProfit)}</p>
            <p className="text-xs text-muted-foreground">{formatPercent(data.grossMargin)} marža</p>
          </CardContent>
        </Card>
        <Card className={isProfitable ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              {isProfitable ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
              <span className="text-xs text-muted-foreground">Neto dobiček</span>
            </div>
            <p className={`text-xl font-bold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.netProfit)}
            </p>
            <p className="text-xs text-muted-foreground">{formatPercent(data.netMargin)} marža</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Povprečni račun</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(data.avgCheck)}</p>
            <p className="text-xs text-muted-foreground">{data.covers} računov</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="summary" className="space-y-3">
        <TabsList>
          <TabsTrigger value="summary">Povzetek</TabsTrigger>
          <TabsTrigger value="revenue">Prihodki</TabsTrigger>
          <TabsTrigger value="expenses">Stroški</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-3">
          {/* P&L povzetek */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" /> Izjava o poslovnem izidu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* Prihodki */}
                <div className="flex justify-between items-center py-2 border-b font-medium">
                  <span>PRIHODKI</span>
                  <span>{formatCurrency(data.revenue.total)}</span>
                </div>
                <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2"><UtensilsIcon /> Hrana</span>
                  <span>{formatCurrency(data.revenue.food)}</span>
                </div>
                <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2"><WineIcon /> Pijača</span>
                  <span>{formatCurrency(data.revenue.beverages)}</span>
                </div>
                <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2"><TruckIcon /> Dostava</span>
                  <span>{formatCurrency(data.revenue.delivery)}</span>
                </div>
                <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2"><OtherIcon /> Ostalo</span>
                  <span>{formatCurrency(data.revenue.other)}</span>
                </div>

                {/* COGS */}
                <div className="flex justify-between items-center py-2 border-b font-medium text-red-600">
                  <span>STROŠKI BLAGA (COGS)</span>
                  <span>-{formatCurrency(data.costOfGoods.total)}</span>
                </div>
                <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
                  <span>Hrana (30%)</span>
                  <span>-{formatCurrency(data.costOfGoods.food)}</span>
                </div>
                <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
                  <span>Pijača (25%)</span>
                  <span>-{formatCurrency(data.costOfGoods.beverages)}</span>
                </div>

                {/* Bruto dobiček */}
                <div className="flex justify-between items-center py-2 border-b font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-3 rounded">
                  <span>BRUTO DOBIČEK</span>
                  <span>{formatCurrency(data.grossProfit)} ({formatPercent(data.grossMargin)})</span>
                </div>

                {/* Operativni stroški */}
                <div className="flex justify-between items-center py-2 border-b font-medium text-red-600">
                  <span>OPERATIVNI STROŠKI</span>
                  <span>-{formatCurrency(data.operatingExpenses.total)}</span>
                </div>
                <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2"><Users className="h-3 w-3" /> Delo</span>
                  <span>-{formatCurrency(data.operatingExpenses.labor)}</span>
                </div>
                <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2"><Home className="h-3 w-3" /> Najemnina</span>
                  <span>-{formatCurrency(data.operatingExpenses.rent)}</span>
                </div>
                <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2"><Building className="h-3 w-3" /> Komunalije</span>
                  <span>-{formatCurrency(data.operatingExpenses.utilities)}</span>
                </div>
                <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2"><Package className="h-3 w-3" /> Material</span>
                  <span>-{formatCurrency(data.operatingExpenses.supplies)}</span>
                </div>

                {/* Operativni dobiček */}
                <div className="flex justify-between items-center py-2 border-b font-medium bg-blue-50 dark:bg-blue-900/20 px-3 rounded">
                  <span>OPERATIVNI DOBIČEK</span>
                  <span className={data.operatingProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(data.operatingProfit)} ({formatPercent(data.operatingMargin)})
                  </span>
                </div>

                {/* Neto dobiček */}
                <div className={`flex justify-between items-center py-3 font-bold text-lg ${isProfitable ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-red-600 bg-red-50 dark:bg-red-900/20'} px-3 rounded`}>
                  <span>NETO DOBIČEK</span>
                  <span>{formatCurrency(data.netProfit)} ({formatPercent(data.netMargin)})</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Razčlenitev prihodkov</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Hrana', value: data.revenue.food, icon: '🍽️', color: 'bg-blue-500' },
                  { label: 'Pijača', value: data.revenue.beverages, icon: '🍷', color: 'bg-purple-500' },
                  { label: 'Dostava', value: data.revenue.delivery, icon: '🚚', color: 'bg-orange-500' },
                  { label: 'Ostalo', value: data.revenue.other, icon: '📦', color: 'bg-gray-500' },
                ].map(item => {
                  const percent = data.revenue.total > 0 ? (item.value / data.revenue.total) * 100 : 0
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm flex items-center gap-2">
                          <span>{item.icon}</span> {item.label}
                        </span>
                        <div className="text-right">
                          <span className="font-medium text-sm">{formatCurrency(item.value)}</span>
                          <span className="text-xs text-muted-foreground ml-2">{percent.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Razčlenitev stroškov</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Stroški dela', value: data.operatingExpenses.labor, icon: Users, color: 'bg-red-500' },
                  { label: 'Najemnina', value: data.operatingExpenses.rent, icon: Home, color: 'bg-orange-500' },
                  { label: 'Komunalije', value: data.operatingExpenses.utilities, icon: Building, color: 'bg-yellow-500' },
                  { label: 'Marketing', value: data.operatingExpenses.marketing, icon: BarChart3, color: 'bg-blue-500' },
                  { label: 'Material', value: data.operatingExpenses.supplies, icon: Package, color: 'bg-green-500' },
                  { label: 'Vzdrževanje', value: data.operatingExpenses.maintenance, icon: Calculator, color: 'bg-purple-500' },
                  { label: 'Zavarovanje', value: data.operatingExpenses.insurance, icon: Calculator, color: 'bg-pink-500' },
                  { label: 'Ostalo', value: data.operatingExpenses.other, icon: Receipt, color: 'bg-gray-500' },
                ].map(item => {
                  const percent = data.operatingExpenses.total > 0 ? (item.value / data.operatingExpenses.total) * 100 : 0
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm flex items-center gap-2">
                          <item.icon className="h-3 w-3" /> {item.label}
                        </span>
                        <div className="text-right">
                          <span className="font-medium text-sm">{formatCurrency(item.value)}</span>
                          <span className="text-xs text-muted-foreground ml-2">{percent.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })}

                <div className="pt-3 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Skupaj COGS</span>
                    <span className="font-medium text-red-600">{formatCurrency(data.costOfGoods.total)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="font-medium">Skupaj operativni stroški</span>
                    <span className="font-medium text-red-600">{formatCurrency(data.operatingExpenses.total)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t">
                    <span className="font-bold">SKUPAJ STROŠKI</span>
                    <span className="font-bold text-red-600">{formatCurrency(data.costOfGoods.total + data.operatingExpenses.total)}</span>
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

// Simple icon components for inline use
function UtensilsIcon() {
  return <span className="text-sm">🍽️</span>
}
function WineIcon() {
  return <span className="text-sm">🍷</span>
}
function TruckIcon() {
  return <span className="text-sm">🚚</span>
}
function OtherIcon() {
  return <span className="text-sm">📦</span>
}
