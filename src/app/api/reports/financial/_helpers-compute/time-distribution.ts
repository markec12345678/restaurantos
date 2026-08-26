// Pomožne funkcije za finančno poročanje — Časovna porazdelitev

import { toNum } from '@/lib/decimal'
import type { TimeDistOrder } from './types'

// ─── Časovna porazdelitev ───
export function computeTimeDistribution(
  period: string, refDate: Date,
  completedOrdersLight: TimeDistOrder[], prevPaidOrdersLight: TimeDistOrder[]
) {
  const timeDistribution: Record<string, { period: string; revenue: number; orders: number; prevRevenue: number; prevOrders: number }> = {}

  if (period === 'daily') {
    for (let h = 0; h < 24; h++) {
      timeDistribution[String(h).padStart(2, '0')] = {
        period: `${String(h).padStart(2, '0')}:00`,
        revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0,
      }
    }
    for (const order of completedOrdersLight) {
      const hour = new Date(order.paidAt || order.createdAt).getHours()
      const key = String(hour).padStart(2, '0')
      if (timeDistribution[key]) { timeDistribution[key].revenue += toNum(order.total); timeDistribution[key].orders += 1 }
    }
    for (const order of prevPaidOrdersLight) {
      const hour = new Date(order.paidAt || order.createdAt).getHours()
      const key = String(hour).padStart(2, '0')
      if (timeDistribution[key]) { timeDistribution[key].prevRevenue += toNum(order.total); timeDistribution[key].prevOrders += 1 }
    }
  } else if (period === 'weekly') {
    const dayNames = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']
    for (const d of dayNames) { timeDistribution[d] = { period: d, revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 } }
    for (const order of completedOrdersLight) {
      const dayIdx = (new Date(order.paidAt || order.createdAt).getDay() + 6) % 7
      const key = dayNames[dayIdx]
      if (timeDistribution[key]) { timeDistribution[key].revenue += toNum(order.total); timeDistribution[key].orders += 1 }
    }
    for (const order of prevPaidOrdersLight) {
      const dayIdx = (new Date(order.paidAt || order.createdAt).getDay() + 6) % 7
      const key = dayNames[dayIdx]
      if (timeDistribution[key]) { timeDistribution[key].prevRevenue += toNum(order.total); timeDistribution[key].prevOrders += 1 }
    }
  } else if (period === 'monthly') {
    const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const key = String(d).padStart(2, '0')
      timeDistribution[key] = { period: String(d), revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 }
    }
    for (const order of completedOrdersLight) {
      const day = new Date(order.paidAt || order.createdAt).getDate()
      const key = String(day).padStart(2, '0')
      if (timeDistribution[key]) { timeDistribution[key].revenue += toNum(order.total); timeDistribution[key].orders += 1 }
    }
    for (const order of prevPaidOrdersLight) {
      const day = new Date(order.paidAt || order.createdAt).getDate()
      const key = String(day).padStart(2, '0')
      if (timeDistribution[key]) { timeDistribution[key].prevRevenue += toNum(order.total); timeDistribution[key].prevOrders += 1 }
    }
  } else {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec']
    for (const m of monthNames) { timeDistribution[m] = { period: m, revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 } }
    for (const order of completedOrdersLight) {
      const monthIdx = new Date(order.paidAt || order.createdAt).getMonth()
      const key = monthNames[monthIdx]
      if (timeDistribution[key]) { timeDistribution[key].revenue += toNum(order.total); timeDistribution[key].orders += 1 }
    }
    for (const order of prevPaidOrdersLight) {
      const monthIdx = new Date(order.paidAt || order.createdAt).getMonth()
      const key = monthNames[monthIdx]
      if (timeDistribution[key]) { timeDistribution[key].prevRevenue += toNum(order.total); timeDistribution[key].prevOrders += 1 }
    }
  }
  return timeDistribution
}
