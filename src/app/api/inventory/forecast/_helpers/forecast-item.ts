// Per-item processing for forecast data

import { toNum, abs } from '@/lib/decimal'
import type { DecimalLike } from '@/lib/decimal'
import { holtWintersForecast, calculateTrend, calculateConfidence, assessRisk } from './algorithm'
import type { ForecastResult, DailyUsage } from './types'

interface InventoryItem {
  id: string
  name: string
  unit: string
  quantity: DecimalLike
  minQuantity: DecimalLike
  menuItem: { name: string } | null
}

interface ProcurementLookup {
  quantity: DecimalLike
  createdAt: Date | null
}

export function processInventoryItem(
  item: InventoryItem,
  transactions: { inventoryItemId: string; createdAt: Date; quantity: DecimalLike }[],
  lastProcurement: ProcurementLookup | undefined,
  since: Date,
): ForecastResult {
  // Združi po dnevih
  const dailyMap = new Map<string, number>()
  for (const tx of transactions) {
    const dateKey = new Date(tx.createdAt).toISOString().split('T')[0]
    dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + toNum(abs(tx.quantity)))
  }

  // Izpolni manjkajoče dneve z 0
  const dailyUsage: DailyUsage[] = []
  for (let d = new Date(since); d <= new Date(); d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0]
    dailyUsage.push({ date: key, quantity: dailyMap.get(key) || 0 })
  }

  // Izračunaj osnovne metrike
  const totalUsage = dailyUsage.reduce((s, d) => s + d.quantity, 0)
  const daysWithData = dailyUsage.length
  const avgDailyUsage = daysWithData > 0 ? totalUsage / daysWithData : 0

  // Porazdelitev po dnevih v tednu
  // FIX LOW: Uporabi ISO dneve (1-7) namesto hardcoded imen — frontend naj lokalizira
  const weekdayIsoNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const weekdayUsage: number[][] = [[], [], [], [], [], [], []]
  for (const du of dailyUsage) {
    const jsDay = new Date(du.date).getDay() // 0=Sun, 1=Mon, ..., 6=Sat
    // Pretvori v ISO: 0=Mon, 1=Tue, ..., 6=Sun
    const isoDay = jsDay === 0 ? 6 : jsDay - 1
    weekdayUsage[isoDay].push(du.quantity)
  }
  const weekdayBreakdown = weekdayIsoNames.map((day, i) => ({
    day,
    avgUsage: weekdayUsage[i].length > 0
      ? weekdayUsage[i].reduce((s, v) => s + v, 0) / weekdayUsage[i].length
      : 0,
  }))

  // Sezonski faktor: vikend (petek, sobota) vs delavni dnevi
  // FIX: ISO dnevi — 4=Fri, 5=Sat
  const weekendAvg = [4, 5].flatMap(i => weekdayUsage[i]).reduce((s, v) => s + v, 0)
    / Math.max(1, [4, 5].flatMap(i => weekdayUsage[i]).length)
  const weekdayAvg = [0, 1, 2, 3].flatMap(i => weekdayUsage[i]).reduce((s, v) => s + v, 0)
    / Math.max(1, [0, 1, 2, 3].flatMap(i => weekdayUsage[i]).length)
  const seasonalityFactor = weekdayAvg > 0 ? weekendAvg / weekdayAvg : 1

  // Napoved s Holt-Winters
  const { forecast } = holtWintersForecast(dailyUsage)
  const forecast7d = forecast.slice(0, 7).reduce((s, v) => s + v, 0)
  const forecast14d = forecast.slice(0, 14).reduce((s, v) => s + v, 0)
  const forecast30d = forecast.reduce((s, v) => s + v, 0)

  // Dnevi do izpraznitve
  let daysUntilEmpty: number | null = null
  if (avgDailyUsage > 0) {
    daysUntilEmpty = Math.floor(toNum(item.quantity) / avgDailyUsage)
  }

  // Trend analiza
  const trend = calculateTrend(dailyUsage)

  // Variacija za zaupanje
  const variance = dailyUsage.length > 0
    ? dailyUsage.reduce((s, d) => s + Math.pow(d.quantity - avgDailyUsage, 2), 0) / dailyUsage.length
    : 0
  const confidence = calculateConfidence(dailyUsage.length, variance, avgDailyUsage)

  // Ali je potrebno naročilo?
  const safetyStock = avgDailyUsage * 3 // 3 dni varnostna zaloga
  const reorderPoint = forecast7d + safetyStock
  const needsReorder = toNum(item.quantity) <= reorderPoint || (daysUntilEmpty !== null && daysUntilEmpty <= 7)

  // Predlagana količina naročila
  const reorderQty = needsReorder
    ? Math.ceil(forecast14d + safetyStock - toNum(item.quantity))
    : 0

  // Oceni tveganje
  const riskLevel = assessRisk(daysUntilEmpty, needsReorder, trend, confidence)

  return {
    inventoryItemId: item.id,
    itemName: item.menuItem?.name || item.name,
    unit: item.unit,
    currentStock: toNum(item.quantity),
    minStock: toNum(item.minQuantity),
    avgDailyUsage: Math.round(avgDailyUsage * 100) / 100,
    forecast7d: Math.round(forecast7d * 100) / 100,
    forecast14d: Math.round(forecast14d * 100) / 100,
    forecast30d: Math.round(forecast30d * 100) / 100,
    daysUntilEmpty,
    needsReorder,
    suggestedOrderQty: Math.max(0, reorderQty),
    confidence: Math.round(confidence * 100) / 100,
    seasonalityFactor: Math.round(seasonalityFactor * 100) / 100,
    trend,
    riskLevel,
    weekdayBreakdown: weekdayBreakdown.map(wb => ({
      day: wb.day,
      avgUsage: Math.round(wb.avgUsage * 100) / 100,
    })),
    lastRestockDate: lastProcurement?.createdAt?.toISOString() || null,
    lastRestockQty: toNum(lastProcurement?.quantity),
  }
}
