// ============================================
// POST /api/ai/forecast — AI napoved prometa
// ============================================
// Uporablja novo forecast engine (src/lib/forecast) z:
//   - linearna regresija (math pravilna)
//   - moving average (weighted)
//   - day-of-week povprečje
//   - ensemble (utežena kombinacija vseh)
//
// Po raziskavi 2025 do 50% boljša natančnost z AI forecasting.
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'
import { autoForecast, type ForecastMethod, type TimeSeriesPoint } from '@/lib/forecast'

export const dynamic = 'force-dynamic'

const forecastSchema = z.object({
  days: z.number().int().min(1).max(30).default(7), // Koliko dni naprej
  method: z.enum(['auto', 'linear_regression', 'moving_average', 'day_of_week', 'ensemble']).default('auto'),
})

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({ days: 7, method: 'auto' }))
    const { days, method } = forecastSchema.parse(body)

    // Pridobi zadnjih 90 dni zgodovine (za vzpostavitev pattern-a)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const historicalOrders = await db.order.findMany({
      where: {
        paidAt: { gte: ninetyDaysAgo },
        paymentStatus: 'paid',
      },
      select: {
        paidAt: true,
        total: true,
        tip: true,
        orderItems: { where: { voided: false }, select: { menuItemId: true, quantity: true } },
      },
    })

    if (historicalOrders.length === 0) {
      return NextResponse.json({
        forecast: [],
        message: 'Ni dovolj zgodovinskih podatkov za napoved (potrebnih vsaj 7 dni).',
      })
    }

    // Agregiraj po dnevih v TimeSeriesPoint[]
    const dailyData: Record<string, { revenue: number; orders: number; tips: number; items: Record<string, number> }> = {}
    for (const order of historicalOrders) {
      if (!order.paidAt) continue
      const dateKey = new Date(order.paidAt).toISOString().split('T')[0]
      if (!dailyData[dateKey]) dailyData[dateKey] = { revenue: 0, orders: 0, tips: 0, items: {} }
      dailyData[dateKey].revenue += toNum(order.total)
      dailyData[dateKey].tips += toNum(order.tip)
      dailyData[dateKey].orders++
      for (const oi of order.orderItems) {
        dailyData[dateKey].items[oi.menuItemId] = (dailyData[dateKey].items[oi.menuItemId] || 0) + oi.quantity
      }
    }

    // Pretvori v TimeSeriesPoint[] (sortirano po datumu)
    const sortedDates = Object.keys(dailyData).sort()
    const revenueSeries: TimeSeriesPoint[] = sortedDates.map(date => ({
      period: date,
      value: dailyData[date].revenue,
    }))
    const ordersSeries: TimeSeriesPoint[] = sortedDates.map(date => ({
      period: date,
      value: dailyData[date].orders,
    }))
    const tipsSeries: TimeSeriesPoint[] = sortedDates.map(date => ({
      period: date,
      value: dailyData[date].tips,
    }))

    // Uporabi novo forecast engine
    const preferredMethod = method === 'auto' ? undefined : method as ForecastMethod
    const revenueForecast = autoForecast(revenueSeries, days, preferredMethod)
    const ordersForecast = autoForecast(ordersSeries, days, preferredMethod)
    const tipsForecast = autoForecast(tipsSeries, days, preferredMethod)

    // Generiraj napoved za naslednjih N dni
    const dayNames = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota']
    const forecast: Array<{
      date: string
      dayOfWeek: string
      predictedRevenue: number
      predictedOrders: number
      predictedTips: number
      confidence: 'high' | 'medium' | 'low'
    }> = []

    for (let i = 0; i < days; i++) {
      const forecastDate = new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000)
      const dow = forecastDate.getDay()
      const revValue = revenueForecast.forecast[i]?.value || 0
      const ordValue = ordersForecast.forecast[i]?.value || 0
      const tipValue = tipsForecast.forecast[i]?.value || 0

      forecast.push({
        date: forecastDate.toISOString().split('T')[0],
        dayOfWeek: dayNames[dow],
        predictedRevenue: round2(revValue),
        predictedOrders: Math.round(ordValue),
        predictedTips: round2(tipValue),
        confidence: revenueForecast.confidence,
      })
    }

    // Top artikli napoved (kateri artikli bodo najbolj prodajani)
    const allItems: Record<string, number> = {}
    for (const data of Object.values(dailyData)) {
      for (const [itemId, qty] of Object.entries(data.items)) {
        allItems[itemId] = (allItems[itemId] || 0) + qty
      }
    }
    const topItemIds = Object.entries(allItems).sort((a, b) => b[1] - a[1]).slice(0, 10)
    const menuItemIds = topItemIds.map(([id]) => id)
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, name: true },
    })

    const topItemsForecast = topItemIds.map(([id, totalQty]) => {
      const mi = menuItems.find(m => m.id === id)
      const avgPerDay = totalQty / Math.max(sortedDates.length, 1)
      return {
        name: mi?.name || 'Neznan artikel',
        avgPerDay: round2(avgPerDay),
        predictedNext7Days: Math.round(avgPerDay * 7),
      }
    })

    // Skupni povzetek
    const totalPredictedRevenue = forecast.reduce((s, f) => s + f.predictedRevenue, 0)
    const totalPredictedOrders = forecast.reduce((s, f) => s + f.predictedOrders, 0)

    // Trend iz linear regresije (slope > 0 = growing)
    const slope = revenueForecast.slope || 0
    const trendPercentage = revenueSeries.length > 0 && revenueSeries[0].value > 0
      ? round2((slope / (revenueSeries.reduce((s, p) => s + p.value, 0) / revenueSeries.length)) * 100)
      : 0

    return NextResponse.json({
      forecast,
      summary: {
        totalPredictedRevenue: round2(totalPredictedRevenue),
        totalPredictedOrders,
        avgDailyRevenue: round2(totalPredictedRevenue / days),
        trend: slope > 0.5 ? 'growing' : slope < -0.5 ? 'declining' : 'stable',
        trendPercentage,
        historicalDays: sortedDates.length,
        confidence: revenueForecast.confidence,
        method: revenueForecast.method,
        metrics: revenueForecast.metrics,
      },
      topItemsForecast,
      insights: generateInsights(forecast, slope, sortedDates.length, revenueForecast),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/ai/forecast', 'Napaka pri napovedi prometa')
  }
}

function generateInsights(
  forecast: Array<{ dayOfWeek: string; predictedRevenue: number; predictedOrders: number; confidence: string }>,
  slope: number,
  historicalDays: number,
  forecastResult: { method: string; confidenceNote: string; metrics?: { mape?: number; rmse?: number } },
): string[] {
  const insights: string[] = []

  // Najboljši dan
  const bestDay = forecast.reduce((best, f) => f.predictedRevenue > best.predictedRevenue ? f : best, forecast[0])
  if (bestDay) {
    insights.push(`📊 Najboljši dan v napovedi: ${bestDay.dayOfWeek} s pričakovanim prometom ${bestDay.predictedRevenue.toFixed(2)}€`)
  }

  // Trend iz slope
  if (slope > 0.5) {
    insights.push(`📈 Trend prometa je naraščajoč (slope=${slope.toFixed(2)}) — razmislite o dodatnem osebju`)
  } else if (slope < -0.5) {
    insights.push(`📉 Trend prometa je padajoč (slope=${slope.toFixed(2)}) — preverite sezonske vzorce`)
  } else {
    insights.push(`➡️ Trend prometa je stabilen (slope=${slope.toFixed(2)})`)
  }

  // Confidence
  if (historicalDays < 14) {
    insights.push(`⚠️ Nizko zaupanje — potrebno vsaj 14 dni zgodovine za boljšo napoved`)
  } else if (historicalDays >= 30) {
    insights.push(`✅ Visoko zaupanje — napoved temelji na ${historicalDays} dneh zgodovine`)
  }

  // Metrika natančnosti (MAPE)
  if (forecastResult.metrics?.mape !== undefined) {
    const mape = forecastResult.metrics.mape
    if (mape < 10) {
      insights.push(`🎯 Model natančnost: MAPE=${mape.toFixed(1)}% (odlična)`)
    } else if (mape < 20) {
      insights.push(`🎯 Model natančnost: MAPE=${mape.toFixed(1)}% (dobra)`)
    } else {
      insights.push(`🎯 Model natančnost: MAPE=${mape.toFixed(1)}% (potrebna izboljšava)`)
    }
  }

  // Metoda
  insights.push(`🔧 Uporabljena metoda: ${forecastResult.method}`)

  // Staffing suggestion
  const busyDays = forecast.filter(f => f.predictedOrders > 30)
  if (busyDays.length > 0) {
    insights.push(`👥 Pričakujemo prometne dni: ${busyDays.map(d => d.dayOfWeek).join(', ')} — priporočamo dodatno osebje`)
  }

  return insights
}
