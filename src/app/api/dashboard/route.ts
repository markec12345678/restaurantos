
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError, validateApiResponse } from '@/lib/api-utils'
import { dashboardResponseSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import {
  fetchTodayAggregation,
  fetchTablesStockRecent,
  computeWeeklyRevenue,
  computeAvgWaitTime,
  fetchFursShiftCogs,
  computeWowComparison,
  computeHeatmapData,
  fetchGuestAnalytics,
} from './_helpers'
import { fetchAnalyticsBreakdowns } from './_helpers-analytics'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('dashboard', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX C-07: Zahtevaj avtentikacijo za dashboard
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // ─── OSNOVNA AGREGACIJA ────────────────────────────────
    const agg = await fetchTodayAggregation(today, tomorrow)

    // ─── MIZE, ZALOGA, ZADNJA NAROČILA ─────────────────────
    const { activeTables, totalTables, lowStockItems, recentOrders } = await fetchTablesStockRecent()

    // ─── TEDENSKA PORABA ────────────────────────────────────
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const dailyRevenue = await computeWeeklyRevenue(sevenDaysAgo)

    // ─── ANALITIKA ──────────────────────────────────────────
    const analytics = await fetchAnalyticsBreakdowns(today, tomorrow)

    // ─── POVPREČNI ČAKALNI ČAS ─────────────────────────────
    const avgWaitMinutes = await computeAvgWaitTime(today, tomorrow)

    // ─── FURS, IZMENA, COGS ─────────────────────────────────
    const fursShiftCogs = await fetchFursShiftCogs(today, tomorrow, agg.todayRevenue)

    // ─── WOW PRIMERJAVA ─────────────────────────────────────
    const wowComparison = await computeWowComparison(today)

    // ─── HEATMAP ────────────────────────────────────────────
    const heatmapData = await computeHeatmapData()

    // ─── GOSTI ──────────────────────────────────────────────
    const guestAnalytics = await fetchGuestAnalytics()

    const responseBody = {
      todayRevenue: agg.todayRevenue,
      todayTips: agg.todayTips,
      todayTax: agg.todayTax,
      todayDiscount: agg.todayDiscount,
      totalOrders: agg.totalOrders,
      completedOrders: agg.completedOrders,
      cancelledOrders: agg.cancelledOrders,
      avgOrderValue: agg.avgOrderValue,
      activeTables,
      totalTables,
      lowStockItems,
      recentOrders,
      dailyRevenue,
      pendingOrders: agg.pendingOrders,
      inProgressOrders: agg.inProgressOrders,
      readyOrders: agg.readyOrders,
      // Nova analitika
      categoryBreakdown: analytics.categoryBreakdown,
      hourlyRevenue: analytics.hourlyBreakdown,
      vatBreakdown: analytics.vatBreakdown,
      paymentMethodBreakdown: analytics.paymentMethodBreakdown,
      orderTypeBreakdown: analytics.orderTypeBreakdown,
      topSellingItems: analytics.topSellingItems,
      employeePerformance: analytics.employeeBreakdown,
      avgWaitMinutes,
      // FURS & Blagajna
      fursStatus: fursShiftCogs.fursStatus,
      activeShift: fursShiftCogs.activeShift,
      // Stroški
      todayCogs: fursShiftCogs.todayCogs,
      grossProfit: fursShiftCogs.grossProfit,
      grossMargin: fursShiftCogs.grossMargin,
      // Napredna analitika
      wowComparison,
      heatmapData,
      guestAnalytics,
    }

    // Validiraj odziv pred vračanjem
    try {
      dashboardResponseSchema.parse(responseBody)
    } catch (validationError: unknown) {
      logger.error('API', 'Dashboard response validation failed:', validationError)
      return NextResponse.json({ error: 'Notranja napaka strežnika' }, { status: 500 })
    }

    return NextResponse.json(validateApiResponse(responseBody, dashboardResponseSchema, 'GET /api/dashboard'))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/dashboard', 'Napaka pri pridobivanju dashboard podatkov')
  }
}
