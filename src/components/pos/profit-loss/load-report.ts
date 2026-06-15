'use client'

// P&L loadReport utility — izračun P&L podatkov iz API-ja

import { OrderRow, OrderItemRow, ExpenseRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import type { PnLData, PnLPeriod } from '../profit-loss/constants'
import { PERIOD_NAMES } from '../profit-loss/constants'

export function getPeriodDates(period: PnLPeriod, now: Date): { periodStart: Date; periodEnd: Date } {
  let periodStart: Date
  const periodEnd = now
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
    case 'quarter': {
      const quarter = Math.floor(now.getMonth() / 3)
      periodStart = new Date(now.getFullYear(), quarter * 3, 1)
      break
    }
  }
  return { periodStart, periodEnd }
}

export async function loadPnlReport(period: PnLPeriod): Promise<PnLData> {
  const now = new Date()
  const { periodStart, periodEnd } = getPeriodDates(period, now)

  // Naloži podatke iz API-jev
  const ordersRes = await authFetch(`/api/orders?startDate=${periodStart.toISOString()}&endDate=${periodEnd.toISOString()}`)
  const ordersData = await ordersRes.json()
  const expensesRes = await authFetch('/api/expenses')
  const expensesData = await expensesRes.json()
  const empRes = await authFetch('/api/employees')
  const empData = await empRes.json()
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

  // COGS
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

  // Stroški dela
  const laborCost = (empData || []).length * 12 * 8 * 22
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

  return {
    period: PERIOD_NAMES[period],
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    revenue: { food: foodRevenue, beverages: beverageRevenue, delivery: deliveryRevenue, other: totalRevenue - foodRevenue - beverageRevenue - deliveryRevenue, total: totalRevenue },
    costOfGoods: { food: foodCOGS, beverages: beverageCOGS, total: totalCOGS },
    grossProfit, grossMargin, operatingExpenses, operatingProfit, operatingMargin,
    otherIncome: 0, otherExpenses: totalExpenses,
    netProfit, netMargin, covers, avgCheck,
  }
}
