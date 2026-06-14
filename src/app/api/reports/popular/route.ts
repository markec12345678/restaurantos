
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { toNum, multiply, round2 } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'

export async function GET(req: Request) {
  try {
    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do prodajnih podatkov
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // FIX HIGH: Validiraj datumski obseg
    const dateError = validateReportDateRange(startDate, endDate)
    if (dateError) return dateError

    // FIX HIGH: Filtriraj na bazi — samo artikli iz plačanih naročil
    const orderWhere: Record<string, unknown> = {
      paymentStatus: 'paid',
    }
    if (startDate || endDate) {
      const paidAt: Record<string, Date> = {}
      if (startDate) paidAt.gte = new Date(startDate)
      if (endDate) paidAt.lte = new Date(endDate)
      orderWhere.paidAt = paidAt
    }

    const paidItems = await db.orderItem.findMany({
      where: {
        voided: false,
        order: orderWhere,
      },
      include: { menuItem: { include: { category: true } } },
    })

    const itemMap: Record<string, { name: string; category: string; quantity: number; revenue: number }> = {}
    paidItems.forEach(item => {
      if (!itemMap[item.menuItemId]) {
        itemMap[item.menuItemId] = {
          name: item.menuItem.name,
          category: item.menuItem.category?.name || 'Unknown',
          quantity: 0,
          revenue: 0,
        }
      }
      itemMap[item.menuItemId].quantity += item.quantity
      itemMap[item.menuItemId].revenue += toNum(multiply(item.price, item.quantity))
    })

    const popularItems = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity)

    const categoryMap: Record<string, { category: string; revenue: number; quantity: number }> = {}
    popularItems.forEach(item => {
      if (!categoryMap[item.category]) {
        categoryMap[item.category] = { category: item.category, revenue: 0, quantity: 0 }
      }
      categoryMap[item.category].revenue += item.revenue
      categoryMap[item.category].quantity += item.quantity
    })

    // FIX: Zaokroži zneske
    Object.values(categoryMap).forEach(c => {
      c.revenue = round2(c.revenue)
    })

    return NextResponse.json({
      popularItems: popularItems.slice(0, 20).map(i => ({
        ...i,
        revenue: round2(i.revenue),
      })),
      categoryBreakdown: Object.values(categoryMap),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/popular', 'Napaka pri pridobivanju poročila')
  }
}
