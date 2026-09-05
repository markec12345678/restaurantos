
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
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


export const dynamic = 'force-dynamic'
// FIX NAPAKA 5 (HTTP 503): Dashboard izvede 8+ zaporednih query-jev;
// na Vercel Hobby planu je default limit 10s. Povečamo na 30s (max za Pro plan,
// varno za Hobby čeprav Vercel rezidualno omeji). Prepreči timeout 503.
export const maxDuration = 30

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('dashboard', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX C-07: Zahtevaj avtentikacijo za dashboard
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // FIX NAPAKA 5 (HTTP 503): Prej so bili query-ji izvedeni ZAPOREDNO (8x await),
    // kar je lahko trajalo 8-16s in preseglo Vercel Hobby 10s timeout.
    // Sedaj izvajamo Vzporedno z Promise.all — skupni čas je max(query), ne vsota.
    // fursShiftCogs je odvisen od agg.todayRevenue, zato mora počakati na prvi batch.

    // ─── PRVI BATCH (vsi neodvisni query-ji vzporedno) ────────
    const [
      agg,
      tablesStockRecent,
      dailyRevenue,
      analytics,
      avgWaitMinutes,
      wowComparison,
      heatmapData,
      guestAnalytics,
    ] = await Promise.all([
      fetchTodayAggregation(today, tomorrow),
      fetchTablesStockRecent(),
      computeWeeklyRevenue(sevenDaysAgo),
      fetchAnalyticsBreakdowns(today, tomorrow),
      computeAvgWaitTime(today, tomorrow),
      computeWowComparison(today),
      computeHeatmapData(),
      fetchGuestAnalytics(),
    ])

    // ─── DRUGI BATCH (odvisen od agg.todayRevenue) ───────────
    // FIX P0-C3A: Prenos session.locationId za pravilno FURS status prikaz
    const fursShiftCogs = await fetchFursShiftCogs(today, tomorrow, agg.todayRevenue, authResult.session?.locationId)

    const { activeTables, totalTables, lowStockItems, recentOrders } = tablesStockRecent

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
      pendingReceipts: fursShiftCogs.fursStatus.todayUnverified, // FIX Test 3.3: alias za enostavnejši dostop
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
