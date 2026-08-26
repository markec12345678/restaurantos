// ============================================
// WAIT TIME ESTIMATOR — Pomožne funkcije
// ============================================

import type { OrderRow } from '@/lib/types'
import type { TableData, WaitlistData, EstimationResult, AreaOccupancyItem } from './constants'
import { AREA_LABELS } from './constants'

// Izračunaj čakalno dobo
export function computeEstimation(
  tables: TableData[] | undefined,
  waitlist: WaitlistData[] | undefined,
  orders: OrderRow[] | undefined,
  partySize: string,
  diningType: string,
): EstimationResult {
  const allTables = (tables || []) as TableData[]
  const activeWaitlist = (waitlist || []) as WaitlistData[]
  const _activeOrders = (orders || []) as OrderRow[]
  const size = parseInt(partySize) || 2

  // Proste mize, ki ustrezajo velikosti skupine
  const availableTables = allTables.filter(t => t.status === 'available' && t.capacity >= size)
  const occupiedTables = allTables.filter(t => t.status === 'occupied')
  const totalCapacity = allTables.reduce((sum, t) => sum + t.capacity, 0)
  const occupiedCapacity = occupiedTables.reduce((sum, t) => sum + t.capacity, 0)
  const occupancyRate = totalCapacity > 0 ? (occupiedCapacity / totalCapacity) * 100 : 0

  // Povprečen čas obroka (ocena)
  const now = new Date()
  const hour = now.getHours()
  const dayOfWeek = now.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6
  const isPeakHour = hour >= 11 && hour <= 14 || hour >= 18 && hour <= 21

  let avgMealTime = 60 // minut - osnovna ocena
  if (isPeakHour) avgMealTime += 15
  if (isWeekend) avgMealTime += 10
  if (diningType === 'takeout') avgMealTime = 15
  if (diningType === 'delivery') avgMealTime = 30

  // Čakalna doba
  let estimatedWait = 0
  let confidence: 'high' | 'medium' | 'low' = 'high'

  if (availableTables.length > 0) {
    estimatedWait = diningType === 'dine-in' ? 5 : 0
    confidence = 'high'
  } else if (activeWaitlist.length === 0) {
    estimatedWait = Math.round(avgMealTime * 0.6)
    confidence = 'medium'
  } else {
    const avgQuotedTime = activeWaitlist.reduce((sum, w) => sum + (w.quotedTime || 15), 0) / Math.max(activeWaitlist.length, 1)
    estimatedWait = Math.round(avgQuotedTime * (1 + activeWaitlist.length * 0.2))
    confidence = 'low'
  }

  // Prilagoditev glede na skupino
  if (size >= 6) estimatedWait = Math.round(estimatedWait * 1.4)
  else if (size >= 4) estimatedWait = Math.round(estimatedWait * 1.2)

  // Zasedenost prilagoditev
  if (occupancyRate > 90) estimatedWait = Math.round(estimatedWait * 1.5)
  else if (occupancyRate > 75) estimatedWait = Math.round(estimatedWait * 1.2)

  return {
    estimatedWait,
    confidence,
    availableTables: availableTables.length,
    occupiedTables: occupiedTables.length,
    totalTables: allTables.length,
    occupancyRate,
    waitlistCount: activeWaitlist.length,
    avgMealTime,
    isPeakHour,
    isWeekend,
  }
}

export function computeAreaOccupancy(tables: TableData[] | undefined): AreaOccupancyItem[] {
  const allTables = (tables || []) as TableData[]
  const areas = [...new Set(allTables.map(t => t.area))]
  return areas.map(area => {
    const areaTables = allTables.filter(t => t.area === area)
    const occupied = areaTables.filter(t => t.status === 'occupied').length
    const total = areaTables.length
    const pct = total > 0 ? (occupied / total) * 100 : 0
    return { area, label: AREA_LABELS[area] || area, occupied, total, pct }
  })
}
