import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const where: Record<string, unknown> = { status: 'completed' }
  if (startDate || endDate) {
    const createdAt: Record<string, Date> = {}
    if (startDate) createdAt.gte = new Date(startDate)
    if (endDate) createdAt.lte = new Date(endDate)
    where.createdAt = createdAt
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
    totalRevenue,
    totalOrders,
    avgOrderValue,
    dailyRevenue: Object.values(dailyRevenue),
    typeBreakdown: Object.values(typeBreakdown),
  })
}
