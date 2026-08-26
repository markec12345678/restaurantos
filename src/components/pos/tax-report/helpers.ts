// Pomožne funkcije za TaxReport — Izračun obdobja in nalaganje podatkov

import { OrderRow, OrderItemRow, ZReportRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import type { TaxReportData } from './constants'

// ============================================
// POMOŽNA FUNKCIJA — Izračun obdobja
// ============================================

export function getPeriodRange(period: 'month' | 'quarter' | 'year') {
  const now = new Date()
  let periodStart: Date
  const periodEnd = now

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

  return { periodStart, periodEnd }
}

// ============================================
// POMOŽNA FUNKCIJA — Nalaganje poročila
// ============================================

export async function loadReportData(period: 'month' | 'quarter' | 'year'): Promise<TaxReportData> {
  const { periodStart, periodEnd } = getPeriodRange(period)

  // Naloži naročila
  const ordersRes = await authFetch(`/api/orders?startDate=${periodStart.toISOString()}&endDate=${periodEnd.toISOString()}`)
  const ordersData = await ordersRes.json()

  // Naloži Z-poročila
  const zRes = await authFetch('/api/z-report')
  const zData = await zRes.json()

  // Naloži FURS podatke
  const fursRes = await authFetch('/api/furs')
  const fursData = await fursRes.json()

  // FIX: Pravilen filter — status je 'completed', paymentStatus je 'paid'
  const completedOrders = (ordersData || []).filter((o: OrderRow) =>
    o.status === 'completed' && o.paymentStatus === 'paid'
  )

  // Izračunaj davčne stopnje (slovenski DDV)
  let tax22Base = 0, tax22Tax = 0
  let tax95Base = 0, tax95Tax = 0
  let tax5Base = 0, tax5Tax = 0
  let tax0Base = 0

  completedOrders.forEach((order: OrderRow) => {
    const items = order.items || order.orderItems || []
    items.forEach((item: OrderItemRow) => {
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

  // FIX CRITICAL: Dnevni pregled — pravilen DDV izracun po posameznih postnjah (ne 18%!)
  const dailyMap: Record<string, { revenue: number; tax: number; zReport: boolean }> = {}
  completedOrders.forEach((order: OrderRow) => {
    const date = new Date(order.createdAt || order.completedAt || '').toISOString().split('T')[0]
    if (!dailyMap[date]) dailyMap[date] = { revenue: 0, tax: 0, zReport: false }
    dailyMap[date].revenue += order.total || 0
    // Izracunaj DDV iz posameznih artiklov, ne s fiksno stopnjo
    const items = order.items || order.orderItems || []
    let orderTax = 0
    items.forEach((item: OrderItemRow) => {
      const price = (item.price || item.unitPrice || 0) * (item.quantity || 1)
      const taxRate = item.taxRate || 22
      if (taxRate > 0) {
        orderTax += price - (price / (1 + taxRate / 100))
      }
    })
    dailyMap[date].tax += orderTax
  })

  // Označi dneve z Z-poročili
  ;(zData || []).forEach((z: ZReportRow) => {
    const date = new Date(z.createdAt || z.date).toISOString().split('T')[0]
    if (dailyMap[date]) dailyMap[date].zReport = true
  })

  const dailyBreakdown = Object.entries(dailyMap)
    .map(([date, info]) => ({ date, ...info }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    period: period === 'month' ? 'Mesečno' : period === 'quarter' ? 'Četrtletno' : 'Letno',
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    // FIX CRITICAL: totalRevenue = davcna osnova (brez DDV), ne skupaj z DDV
    totalRevenue: totalRevenue,
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
  }
}
