import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

export async function GET(req: Request) {
  try {
    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do prodajnih podatkov
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Record<string, unknown> = {
      status: 'completed',
      paymentStatus: 'paid',
    }
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {}
      if (startDate) createdAt.gte = new Date(startDate)
      if (endDate) createdAt.lte = new Date(endDate)
      where.createdAt = createdAt
    }

    // FIX MEDIUM: Omeji obdobje na maksimalno 1 leto — prepreči nalaganje preveč podatkov
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      if (diffDays > 366) {
        return NextResponse.json(
          { error: 'Obdobje ne sme preseči 366 dni. Uporabite manjše obdobje.' },
          { status: 400 }
        )
      }
    }

    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })

    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0)
    const totalOrders = orders.length
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    const dailyRevenue: Record<string, { date: string; revenue: number; orders: number }> = {}
    orders.forEach(order => {
      const dateKey = new Date(order.createdAt).toISOString().split('T')[0]
      if (!dailyRevenue[dateKey]) {
        dailyRevenue[dateKey] = { date: dateKey, revenue: 0, orders: 0 }
      }
      dailyRevenue[dateKey].revenue += order.total
      dailyRevenue[dateKey].orders += 1
    })

    const typeBreakdown: Record<string, { type: string; revenue: number; count: number }> = {}
    orders.forEach(order => {
      if (!typeBreakdown[order.type]) {
        typeBreakdown[order.type] = { type: order.type, revenue: 0, count: 0 }
      }
      typeBreakdown[order.type].revenue += order.total
      typeBreakdown[order.type].count += 1
    })

    return NextResponse.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      dailyRevenue: Object.values(dailyRevenue),
      typeBreakdown: Object.values(typeBreakdown),
    })
  } catch (error) {
    console.error('Napaka pri pridobivanju prodajnega poročila:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju prodajnega poročila' }, { status: 500 })
  }
}
