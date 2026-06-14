'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — P&L Porocilo (Profit & Loss)
// Toast POS + Lightspeed standard za finančno poročanje
// ═══════════════════════════════════════════════════════════════

import dynamic from 'next/dynamic'
import { useState, useEffect, memo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OrderRow, OrderItemRow, ExpenseRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import type { PnLData, PnLPeriod } from './profit-loss/constants'
import { PERIOD_NAMES } from './profit-loss/constants'

// ─── Lazy-loaded podkomponente ─────────────────────────────────
const PnlHeader = dynamic(
  () => import('./profit-loss/PnlHeader').then(m => m.PnlHeader),
  { ssr: false },
)
const KpiCards = dynamic(
  () => import('./profit-loss/KpiCards').then(m => m.KpiCards),
  { ssr: false },
)
const SummaryTab = dynamic(
  () => import('./profit-loss/SummaryTab').then(m => m.SummaryTab),
  { ssr: false },
)
const RevenueTab = dynamic(
  () => import('./profit-loss/RevenueTab').then(m => m.RevenueTab),
  { ssr: false },
)
const ExpensesTab = dynamic(
  () => import('./profit-loss/ExpensesTab').then(m => m.ExpensesTab),
  { ssr: false },
)

export const ProfitLossReport = memo(function ProfitLossReport() {
  const [data, setData] = useState<PnLData | null>(null)
  const [_loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PnLPeriod>('month')
  const [_compareEnabled, _setCompareEnabled] = useState(false)

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
      const ordersRes = await authFetch(`/api/orders?startDate=${periodStart.toISOString()}&endDate=${periodEnd.toISOString()}`)
      const ordersData = await ordersRes.json()
      // Naloži stroške
      const expensesRes = await authFetch('/api/expenses')
      const expensesData = await expensesRes.json()
      // Naloži zaposlene za izračun stroškov dela
      const empRes = await authFetch('/api/employees')
      const empData = await empRes.json()
      // Naloži nabavna naročila za COGS
      const poRes = await authFetch('/api/purchase-orders')
      const _poData = await poRes.json()
      // Izračunaj prihodke
      const completedOrders = (ordersData || []).filter((o: OrderRow) => o.status === 'completed' || o.status === 'paid')
      const totalRevenue = completedOrders.reduce((sum: number, o: OrderRow) => sum + (o.total || 0), 0)
      // Razdeli prihodke po kategorijah
      let foodRevenue = 0
      let beverageRevenue = 0
      let deliveryRevenue = 0
      completedOrders.forEach((order: OrderRow) => {
        const items = order.items || order.orderItems || []
        items.forEach((item: OrderItemRow) => {
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
      const totalExpenses = (expensesData || []).reduce((sum: number, e: ExpenseRow) => {
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
        period: PERIOD_NAMES[period],
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
    } catch {
      toast.error('Napaka pri nalaganju P&L poročila')
    } finally {
      setLoading(false)
    }
  }

  // ─── Nalagalni indikator ────────────────────────────────────
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
      <PnlHeader
        period={period}
        onPeriodChange={setPeriod}
        isProfitable={isProfitable}
        periodName={data.period}
      />
      {/* KPI kartice */}
      <KpiCards data={data} isProfitable={isProfitable} />
      <Tabs defaultValue="summary" className="space-y-3">
        <TabsList>
          <TabsTrigger value="summary">Povzetek</TabsTrigger>
          <TabsTrigger value="revenue">Prihodki</TabsTrigger>
          <TabsTrigger value="expenses">Stroški</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="space-y-3">
          <SummaryTab data={data} isProfitable={isProfitable} />
        </TabsContent>
        <TabsContent value="revenue" className="space-y-3">
          <RevenueTab data={data} />
        </TabsContent>
        <TabsContent value="expenses" className="space-y-3">
          <ExpensesTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  )
})
