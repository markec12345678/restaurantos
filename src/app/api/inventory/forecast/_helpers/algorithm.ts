// ============================================
// AI PREDIKTIVNA ANALÍTIKA ZALOGE — Napovedni algoritmi
// Holt-Winters, trend, zaupanje, tveganje
// ============================================

import type { DailyUsage } from './types'

// ─── Algoritem za napoved povpraševanja ─────────────────────

/**
 * Eksponentno glajenje z sezonskim faktorjem
 * Uporabi Holt-Winters metodo za napovedovanje
 */
export function holtWintersForecast(
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
  const forecast: number[] = []
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
export function calculateTrend(data: DailyUsage[]): 'increasing' | 'decreasing' | 'stable' {
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
export function calculateConfidence(dataPoints: number, variance: number, avg: number): number {
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
export function assessRisk(
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
