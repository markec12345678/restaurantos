import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayOrders = await db.order.findMany({
    where: { createdAt: { gte: today, lt: tomorrow } },
    include: { orderItems: { include: { menuItem: true } }, table: true },
    orderBy: { createdAt: 'desc' },
  })

  const todayRevenue = todayOrders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.total, 0)
  const totalOrders = todayOrders.length
  const avgOrderValue = totalOrders > 0 ? todayRevenue / totalOrders : 0

  const activeTables = await db.table.count({ where: { status: 'occupied' } })
  const totalTables = await db.table.count()

  const allInventory = await db.inventoryItem.findMany()
  const lowStockItems = allInventory.filter(item => item.quantity <= item.minQuantity).slice(0, 5)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const recentOrders = await db.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { table: true, orderItems: { include: { menuItem: true } } },
  })

  const weekOrders = await db.order.findMany({
    where: { createdAt: { gte: sevenDaysAgo }, status: 'completed' },
  })

  const dailyRevenue: { date: string; revenue: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const day = new Date()
    day.setDate(day.getDate() - i)
    day.setHours(0, 0, 0, 0)
    const nextDay = new Date(day)
    nextDay.setDate(nextDay.getDate() + 1)

    const dayRevenue = weekOrders
      .filter(o => new Date(o.createdAt) >= day && new Date(o.createdAt) < nextDay)
      .reduce((sum, o) => sum + o.total, 0)

    dailyRevenue.push({
      date: day.toISOString().split('T')[0],
      revenue: Math.round(dayRevenue * 100) / 100,
    })
  }

  const pendingOrders = todayOrders.filter(o => o.status === 'pending').length
  const inProgressOrders = todayOrders.filter(o => o.status === 'in-progress').length

  return NextResponse.json({
    todayRevenue,
    totalOrders,
    avgOrderValue,
    activeTables,
    totalTables,
    lowStockItems,
    recentOrders,
    dailyRevenue,
    pendingOrders,
    inProgressOrders,
  })
}
