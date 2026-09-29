// Pomožne funkcije za finančno poročanje — Časovna porazdelitev

import { toNum } from '@/lib/decimal'
import { ljubljanaDateTimeParts } from '@/lib/timezone-sl'
import type { TimeDistOrder } from './types'

// ─── Časovna porazdelitev ───
export function computeTimeDistribution(
  period: string, refDate: Date,
  completedOrdersLight: TimeDistOrder[], prevPaidOrdersLight: TimeDistOrder[]
) {
  const timeDistribution: Record<string, { period: string; revenue: number; orders: number; prevRevenue: number; prevOrders: number }> = {}

  // R160 (N1): LJ dele naročila ENKRAT (urna/dnevna/tedenska/mesečna/
  // letna vedra po LJ poslovnemu dnevu — prej getHours/getDay/getDate/
  // getMonth po strežniškem TZ). Mesečna ključi so padStart '01'–'31'
  // (vedra 1..daysInMonth), LJ dan jih VEDNO pokrije, ker je okno iz
  // calcDateRange že LJ mesec → tihi izpad ('31' v 30-dnevnem mesecu,
  // guard spusti naročilo) je odstranjen po konstrakciji.
  const ljPartsOf = (order: TimeDistOrder) =>
    ljubljanaDateTimeParts((order.paidAt || order.createdAt).toISOString())

  if (period === 'daily') {
    for (let h = 0; h < 24; h++) {
      timeDistribution[String(h).padStart(2, '0')] = {
        period: `${String(h).padStart(2, '0')}:00`,
        revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0,
      }
    }
    for (const order of completedOrdersLight) {
      const key = ljPartsOf(order).time.slice(0, 2) // 'HH' — že padStart
      if (timeDistribution[key]) { timeDistribution[key].revenue += toNum(order.total); timeDistribution[key].orders += 1 }
    }
    for (const order of prevPaidOrdersLight) {
      const key = ljPartsOf(order).time.slice(0, 2)
      if (timeDistribution[key]) { timeDistribution[key].prevRevenue += toNum(order.total); timeDistribution[key].prevOrders += 1 }
    }
  } else if (period === 'weekly') {
    const dayNames = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']
    for (const d of dayNames) { timeDistribution[d] = { period: d, revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 } }
    for (const order of completedOrdersLight) {
      // ponedeljkov indeks iz LJ YMD (getUTCDay na YMD polnoč — R159-b vzorec)
      const dayIdx = (new Date(`${ljPartsOf(order).date}T00:00:00Z`).getUTCDay() + 6) % 7
      const key = dayNames[dayIdx]
      if (timeDistribution[key]) { timeDistribution[key].revenue += toNum(order.total); timeDistribution[key].orders += 1 }
    }
    for (const order of prevPaidOrdersLight) {
      const dayIdx = (new Date(`${ljPartsOf(order).date}T00:00:00Z`).getUTCDay() + 6) % 7
      const key = dayNames[dayIdx]
      if (timeDistribution[key]) { timeDistribution[key].prevRevenue += toNum(order.total); timeDistribution[key].prevOrders += 1 }
    }
  } else if (period === 'monthly') {
    // R160 (N1): daysInMonth iz UTC delov refDate (route poda new Date('YYYY-MM-DD')
    // = UTC polnoč) — prej getFullYear/getMonth po strežniškem TZ (odmik na
    // negativnih conah bi premaknil mesečno ogrodje)
    const daysInMonth = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() + 1, 0)).getUTCDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const key = String(d).padStart(2, '0')
      timeDistribution[key] = { period: String(d), revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 }
    }
    for (const order of completedOrdersLight) {
      const key = ljPartsOf(order).date.slice(8, 10) // 'DD' — že padStart
      if (timeDistribution[key]) { timeDistribution[key].revenue += toNum(order.total); timeDistribution[key].orders += 1 }
    }
    for (const order of prevPaidOrdersLight) {
      const key = ljPartsOf(order).date.slice(8, 10)
      if (timeDistribution[key]) { timeDistribution[key].prevRevenue += toNum(order.total); timeDistribution[key].prevOrders += 1 }
    }
  } else {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec']
    for (const m of monthNames) { timeDistribution[m] = { period: m, revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 } }
    for (const order of completedOrdersLight) {
      const monthIdx = Number(ljPartsOf(order).date.slice(5, 7)) - 1
      const key = monthNames[monthIdx]
      if (timeDistribution[key]) { timeDistribution[key].revenue += toNum(order.total); timeDistribution[key].orders += 1 }
    }
    for (const order of prevPaidOrdersLight) {
      const monthIdx = Number(ljPartsOf(order).date.slice(5, 7)) - 1
      const key = monthNames[monthIdx]
      if (timeDistribution[key]) { timeDistribution[key].prevRevenue += toNum(order.total); timeDistribution[key].prevOrders += 1 }
    }
  }
  return timeDistribution
}
