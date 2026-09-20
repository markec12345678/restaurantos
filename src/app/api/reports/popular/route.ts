
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { toNum, multiply, round2 } from '@/lib/decimal'
import { endOfDayParam, handleApiError } from '@/lib/api-utils'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do prodajnih podatkov
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)

    // FIX R84-1 HIGH: Tenant scope — popular artikli so prej zajemali plačana
    // naročila VSEH lokacij (mešanica izdelkov/prihodkov čez tenant-e).
    // Fail-closed za regular uporabnika brez lokacije. null scope = globalno.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/reports/popular',
    })
    if ('error' in scope) return scope.error

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // FIX HIGH: Validiraj datumski obseg
    const dateError = validateReportDateRange(startDate, endDate)
    if (dateError) return dateError

    // FIX HIGH: Filtriraj na bazi — samo artikli iz plačanih naročil
    const orderWhere: Record<string, unknown> = {
      paymentStatus: 'paid',
      // R84: tenant filter (null scope = PRAZEN filter, nikoli { locationId: null })
      ...(scope.locationId ? { locationId: scope.locationId } : {}),
    }
    if (startDate || endDate) {
      const paidAt: Record<string, Date> = {}
      if (startDate) paidAt.gte = new Date(startDate)
      if (endDate) paidAt.lte = endOfDayParam(endDate) // FIX r35: konec dneva, ne polnoč
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
