// ============================================
// GET /api/sustainability — Carbon footprint dashboard
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { generateDailyCarbonReport, calculateMenuItemCarbon } from '@/lib/carbon'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date()
    const menuItemId = searchParams.get('menuItemId')

    // Če je menuItemId podan — izračunaj CO2e za en artikel
    if (menuItemId) {
      const carbon = await calculateMenuItemCarbon(menuItemId)
      return NextResponse.json({ menuItemId, ...carbon })
    }

    // Sicer generiraj dnevno poročilo
    const report = await generateDailyCarbonReport(date)

    // Dodaj še tedenski trend (zadnjih 7 dni)
    const weeklyTrend: Array<{ date: string; co2e: number; orders: number }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(date)
      d.setDate(d.getDate() - i)
      const dailyReport = await generateDailyCarbonReport(d)
      weeklyTrend.push({
        date: dailyReport.date,
        co2e: dailyReport.totalCo2e,
        orders: dailyReport.totalOrders,
      })
    }

    return NextResponse.json({
      ...report,
      weeklyTrend,
      comparison: {
        avgCo2ePerOrder: report.co2ePerOrder,
        industryAverage: 1.7, // Povprečje restavracij (kg CO2e per order)
        betterThanAverage: report.co2ePerOrder < 1.7,
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/sustainability', 'Napaka pri pridobivanju poročila održljivosti')
  }
}
