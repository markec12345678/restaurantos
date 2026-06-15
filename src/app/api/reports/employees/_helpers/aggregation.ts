// Agregacija order itemov v statistiko zaposlenega

import { toNum, multiply } from '@/lib/decimal'
import type { EmployeeStatsEntry } from './types'

export function aggregateOrderItems(
  stats: EmployeeStatsEntry,
  order: {
    orderItems: Array<{
      voided: boolean
      quantity: number
      price: import('@/lib/decimal').DecimalLike
      menuItemId: string
      menuItem?: { name?: string; category?: { name?: string } }
    }>
    createdAt: Date
  },
): void {
  for (const oi of order.orderItems) {
    if (oi.voided) {
      stats.voidedItems += oi.quantity
      continue
    }

    stats.itemsSold += oi.quantity

    // Kategorije
    const cat = oi.menuItem?.category?.name || 'Ostalo'
    if (!stats.categoryBreakdown[cat]) {
      stats.categoryBreakdown[cat] = { category: cat, revenue: 0, quantity: 0 }
    }
    stats.categoryBreakdown[cat].revenue += toNum(multiply(oi.price, oi.quantity))
    stats.categoryBreakdown[cat].quantity += oi.quantity

    // Top artikli
    const itemKey = oi.menuItemId
    if (!stats.topItems[itemKey]) {
      stats.topItems[itemKey] = {
        name: oi.menuItem?.name || 'Neznan',
        quantity: 0,
        revenue: 0,
      }
    }
    stats.topItems[itemKey].quantity += oi.quantity
    stats.topItems[itemKey].revenue += toNum(multiply(oi.price, oi.quantity))

    // Urna porazdelitev
    const hour = String(new Date(order.createdAt).getHours()).padStart(2, '0')
    if (!stats.hourlyBreakdown[hour]) {
      stats.hourlyBreakdown[hour] = { hour: `${hour}:00`, revenue: 0, orders: 0 }
    }
    stats.hourlyBreakdown[hour].revenue += toNum(multiply(oi.price, oi.quantity))
  }

  // Dodaj urno porazdelitev naročil
  const hour = String(new Date(order.createdAt).getHours()).padStart(2, '0')
  if (stats.hourlyBreakdown[hour]) {
    stats.hourlyBreakdown[hour].orders += 1
  }
}
