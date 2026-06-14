// ============================================
// AI PREDIKTIVNA ANALÍTIKA ZALOGE
// Napoveduje povpraševanje, predlaga naročila,
// prepozna sezonske vzorce in tveganja zmanjkanja
// ============================================
// ============================================
// TIPI
// ============================================
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum, abs } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'
interface DailyUsage {
  date: string
  quantity: number
}
interface ForecastResult {
  inventoryItemId: string
  itemName: string
  unit: string
  currentStock: number
  minStock: number
  avgDailyUsage: number
  // Napoved za naslednjih 7 dni
  forecast7d: number
  // Napoved za naslednjih 14 dni
  forecast14d: number
  // Napoved za naslednjih 30 dni
  forecast30d: number
  // Dnevi do izpraznitve zaloge
  daysUntilEmpty: number | null
  // Ali je potrebno naročilo
  needsReorder: boolean
  // Predlagana količina naročila
  suggestedOrderQty: number
  // Zaupanje napovedi (0-1)
  confidence: number
  // Sezonski faktor (npr. vikendi = večja poraba)
  seasonalityFactor: number
  // Trend (raste/pada/stabilen)
  trend: 'increasing' | 'decreasing' | 'stable'
  // Tveganje
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  // Razčlenitev po dnevih v tednu
  weekdayBreakdown: { day: string; avgUsage: number }[]
  // Zadnja dobava
  lastRestockDate: string | null
  lastRestockQty: number
}
// ============================================
// ALGORITEM ZA NAPROVED POVPRASEVANJA
// ============================================
/**
 * Eksponentno glajenje z sezonskim faktorjem
 * Uporabi Holt-Winters metodo za napovedovanje
 */
function holtWintersForecast(
  data: DailyUsage[],
  alpha: number = 0.3,  // Glajenje nivoja
  beta: number = 0.1,   // Glajenje trenda
  gamma: number = 0.2,  // Glajenje sezonskosti
  seasonLength: number = 7  // Teden = 7 dni
): { forecast: number[]; level: number; trend: number; seasonals: number[] } {
  if (data.length < seasonLength) {
    // Premalo podatkov za sezonskost — preprosta eksponentna metoda
    const avg = data.reduce((s, d) => s + d.quantity, 0) / data.length
    const trendSlope = data.length > 1
      ? (data[data.length - 1].quantity - data[0].quantity) / (data.length - 1)
      : 0
    return {
      forecast: Array(30).fill(avg + trendSlope * 7),
      level: avg,
      trend: trendSlope,
      seasonals: Array(seasonLength).fill(1 / seasonLength),
    }
  }
  // Inicializacija sezonskih indeksov
  const seasonals: number[] = []
  const numSeasons = Math.floor(data.length / seasonLength)
  for (let i = 0; i < seasonLength; i++) {
    let sum = 0
    let count = 0
    for (let s = 0; s < numSeasons; s++) {
      const idx = s * seasonLength + i
      if (idx < data.length) {
        sum += data[idx].quantity
        count++
      }
    }
    const seasonAvg = count > 0 ? sum / count : 0
    const overallAvg = data.reduce((s, d) => s + d.quantity, 0) / data.length
    seasonals.push(overallAvg > 0 ? seasonAvg / overallAvg : 1)
  }
  // Inicializacija nivoja in trenda
  let level = data.slice(0, seasonLength).reduce((s, d) => s + d.quantity, 0) / seasonLength
  let trend = (data[seasonLength]?.quantity || data[0].quantity) - data[0].quantity
  trend = trend / seasonLength
  // Iterativno posodabljanje
  const forecast: number[] = []
  for (let i = 0; i < data.length; i++) {
    const seasonalIdx = i % seasonLength
    const seasonal = seasonals[seasonalIdx]
    const forecastVal = (level + trend) * seasonal
    const _error = data[i].quantity - forecastVal
    // Posodobi nivo
    const newLevel = alpha * (data[i].quantity / seasonal) + (1 - alpha) * (level + trend)
    // Posodobi trend
    const newTrend = beta * (newLevel - level) + (1 - beta) * trend
    // Posodobi sezonski indeks
    seasonals[seasonalIdx] = gamma * (data[i].quantity / newLevel) + (1 - gamma) * seasonal
    level = newLevel
    trend = newTrend
  }
  // Generiraj napoved za 30 dni
  for (let i = 1; i <= 30; i++) {
    const seasonalIdx = (data.length + i - 1) % seasonLength
    const forecastVal = Math.max(0, (level + trend * i) * seasonals[seasonalIdx])
    forecast.push(forecastVal)
  }
  return { forecast, level, trend, seasonals }
}
/**
 * Izračunaj trend (naraščajoč/padajoč/stabilen)
 */
function calculateTrend(data: DailyUsage[]): 'increasing' | 'decreasing' | 'stable' {
  if (data.length < 7) return 'stable'
  const recent = data.slice(-7)
  const older = data.slice(-14, -7)
  if (older.length === 0) return 'stable'
  const recentAvg = recent.reduce((s, d) => s + d.quantity, 0) / recent.length
  const olderAvg = older.reduce((s, d) => s + d.quantity, 0) / older.length
  if (olderAvg === 0) return recentAvg > 0 ? 'increasing' : 'stable'
  const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100
  if (changePercent > 15) return 'increasing'
  if (changePercent < -15) return 'decreasing'
  return 'stable'
}
/**
 * Izračunaj zaupanje napovedi glede na količino podatkov
 */
function calculateConfidence(dataPoints: number, variance: number, avg: number): number {
  // Več podatkov = večje zaupanje
  let confidence = Math.min(1, dataPoints / 60) * 0.5 // Do 0.5 za 60+ dni
  // Manjša varianca = večje zaupanje
  if (avg > 0) {
    const cv = Math.sqrt(variance) / avg // Koeficient variacije
    confidence += Math.max(0, 0.5 - cv * 0.3)
  }
  return Math.min(0.95, Math.max(0.2, confidence))
}
/**
 * Določi raven tveganja
 */
function assessRisk(
  daysUntilEmpty: number | null,
  needsReorder: boolean,
  trend: string,
  confidence: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (daysUntilEmpty !== null && daysUntilEmpty <= 2) return 'critical'
  if (daysUntilEmpty !== null && daysUntilEmpty <= 5) return 'high'
  if (needsReorder && trend === 'increasing') return 'high'
  if (needsReorder) return 'medium'
  if (trend === 'increasing' && confidence > 0.6) return 'medium'
  return 'low'
}
// ============================================
// API HANDLER
// ============================================
export async function GET(req: Request) {
  try {
    // FIX HIGH: Require manage_inventory permission for forecast data
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error
    const { searchParams } = new URL(req.url)
    // FIX MEDIUM: Validiraj days parameter — prepreči nesmiselne vrednosti
    const rawDays = parseInt(searchParams.get('days') || '90')
    const days = Math.min(Math.max(Number.isNaN(rawDays) ? 90 : rawDays, 7), 365)
    const category = searchParams.get('category') || ''
    // Pridobi vse artikle zaloge
    const whereClause: Record<string, unknown> = {}
    if (category) whereClause.category = category
    const inventoryItems = await db.inventoryItem.findMany({
      where: whereClause,
      include: {
        menuItem: { select: { name: true } },
      },
    })
    // Pridobi transakcije za zadnjih N dni
    const since = new Date()
    since.setDate(since.getDate() - days)
    // FIX MEDIUM: Batch query namesto N+1 — pridobi vse transakcije naenkrat
    const allItemIds = inventoryItems.map(item => item.id)
    const [allTransactions, allProcurements] = await Promise.all([
      db.stockTransaction.findMany({
        where: {
          inventoryItemId: { in: allItemIds },
          type: 'sale',
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'asc' },
      }),
      db.stockTransaction.findMany({
        where: {
          inventoryItemId: { in: allItemIds },
          type: 'procurement',
        },
        orderBy: { createdAt: 'desc' },
        distinct: ['inventoryItemId'],
        select: { inventoryItemId: true, quantity: true, createdAt: true },
      }),
    ])
    // Zgradi lookup mapi
    const txByItem = new Map<string, typeof allTransactions>()
    for (const tx of allTransactions) {
      if (!txByItem.has(tx.inventoryItemId)) txByItem.set(tx.inventoryItemId, [])
      txByItem.get(tx.inventoryItemId)!.push(tx)
    }
    const procByItem = new Map(allProcurements.map(p => [p.inventoryItemId, p]))
    const results: ForecastResult[] = []
    for (const item of inventoryItems) {
      // Pridobi transakcije iz batch lookupa
      const transactions = txByItem.get(item.id) || []
      // Pridobi zadnjo dobavo iz batch lookupa
      const lastProcurement = procByItem.get(item.id)
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
      const { forecast, trend: _hwTrend } = holtWintersForecast(dailyUsage)
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
      // Kriterij: zmanjka v 7 dneh ALI pod minimalno zalogo ALI pod varnostno zalogo (3 dni)
      const safetyStock = avgDailyUsage * 3 // 3 dni varnostna zaloga
      const reorderPoint = forecast7d + safetyStock
      const needsReorder = toNum(item.quantity) <= reorderPoint || (daysUntilEmpty !== null && daysUntilEmpty <= 7)
      // Predlagana količina naročila
      // Uporabi economic order quantity (EOQ) poenostavljen model
      const _leadTimeDays = 3 // Privzeto 3 dni za dobavo
      const reorderQty = needsReorder
        ? Math.ceil(forecast14d + safetyStock - toNum(item.quantity))
        : 0
      // Oceni tveganje
      const riskLevel = assessRisk(daysUntilEmpty, needsReorder, trend, confidence)
      results.push({
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
      })
    }
    // Razvrsti po tveganju (critical first)
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    results.sort((a, b) => (riskOrder[a.riskLevel] || 3) - (riskOrder[b.riskLevel] || 3))
    // Povzetek
    const summary = {
      totalItems: results.length,
      criticalItems: results.filter(r => r.riskLevel === 'critical').length,
      highRiskItems: results.filter(r => r.riskLevel === 'high').length,
      needsReorderCount: results.filter(r => r.needsReorder).length,
      totalSuggestedOrderValue: 0, // Bi lahko izračunali s costPerUnit
      avgConfidence: results.length > 0
        ? Math.round((results.reduce((s, r) => s + r.confidence, 0) / results.length) * 100) / 100
        : 0,
    }
    return NextResponse.json({ summary, forecasts: results })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/inventory/forecast', 'Napaka pri napovedovanju zaloge')
  }
}
