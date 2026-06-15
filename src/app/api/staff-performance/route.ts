// ============================================
// STAFF PERFORMANCE API — Analitika učinkovitosti zaposlenih
// Toast POS + 7shifts + Square standard
// Napitnine, povprečni čas strežbe, obračun miz, upsell
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import {
  getDateRange,
  fetchPerformanceData,
  computeEmployeePerformance,
  calculatePerformanceScores,
  computeTotals,
} from './_helpers'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'today'
    const locationId = searchParams.get('locationId')

    const { startDate, now } = getDateRange(period)
    const rawData = await fetchPerformanceData(startDate, locationId)
    const performanceData = computeEmployeePerformance(rawData)

    calculatePerformanceScores(performanceData)
    performanceData.sort((a, b) => b.performanceScore - a.performanceScore)

    const totals = computeTotals(performanceData)

    return NextResponse.json({
      period,
      startDate,
      endDate: now,
      employees: performanceData,
      totals,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/staff-performance', 'Napaka pri pridobivanju analitike')
  }
}
