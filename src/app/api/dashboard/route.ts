import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

export async function GET(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za dashboard
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayOrders = await db.order.findMany({
    where: { createdAt: { gte: today, lt: tomorrow } },
    include: { orderItems: { include: { menuItem: { include: { category: true } } } }, table: true, employee: true },
    orderBy: { createdAt: 'desc' },
  })

  const todayRevenue = todayOrders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.total, 0)
  const totalOrders = todayOrders.length
  const avgOrderValue = totalOrders > 0 ? todayRevenue / totalOrders : 0
  const pendingOrders = todayOrders.filter(o => o.status === 'pending').length
  const inProgressOrders = todayOrders.filter(o => o.status === 'in-progress').length

  const activeTables = await db.table.count({ where: { status: 'occupied' } })
  const totalTables = await db.table.count()

  const allInventory = await db.inventoryItem.findMany()
  const lowStockItems = allInventory.filter(item => item.quantity <= item.minQuantity).slice(0, 5)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const recentOrders = await db.order.findMany({
    take: 10,
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
    dailyRevenue.push({ date: day.toISOString().split('T')[0], revenue: Math.round(dayRevenue * 100) / 100 })
  }

  // ============================================
  // NOVA ANALITIKA
  // ============================================

  // 1. Category breakdown - prihodek po kategorijah
  const categoryMap: Record<string, { name: string; revenue: number; count: number }> = {}
  for (const order of todayOrders.filter(o => o.paymentStatus === 'paid')) {
    for (const oi of order.orderItems) {
      const catName = oi.menuItem?.category?.name || 'Ostalo'
      if (!categoryMap[catName]) categoryMap[catName] = { name: catName, revenue: 0, count: 0 }
      categoryMap[catName].revenue += oi.price * oi.quantity
      categoryMap[catName].count += oi.quantity
    }
  }
  const categoryBreakdown = Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue)

  // 2. Hourly revenue - prihodek po urah
  const hourlyMap: Record<number, number> = {}
  for (let h = 0; h < 24; h++) hourlyMap[h] = 0
  for (const order of todayOrders.filter(o => o.paymentStatus === 'paid')) {
    const hour = new Date(order.createdAt).getHours()
    hourlyMap[hour] += order.total
  }
  const hourlyRevenue = Object.entries(hourlyMap).map(([hour, revenue]) => ({
    hour: parseInt(hour),
    label: `${hour}:00`,
    revenue: Math.round(revenue * 100) / 100,
  }))

  // 3. DDV breakdown - DDV po stopnjah
  const vatMap: Record<string, { base: number; vat: number }> = {}
  for (const order of todayOrders.filter(o => o.paymentStatus === 'paid')) {
    for (const oi of order.orderItems) {
      const rate = String(oi.vatRate ?? 22)
      if (!vatMap[rate]) vatMap[rate] = { base: 0, vat: 0 }
      const base = oi.price * oi.quantity
      vatMap[rate].base += base
      vatMap[rate].vat += base * ((oi.vatRate ?? 22) / 100)
    }
  }
  const vatBreakdown = Object.entries(vatMap).map(([rate, data]) => ({
    rate,
    base: Math.round(data.base * 100) / 100,
    vat: Math.round(data.vat * 100) / 100,
  }))

  // 4. Payment method breakdown
  const paymentMap: Record<string, number> = {}
  for (const order of todayOrders.filter(o => o.paymentStatus === 'paid')) {
    const method = order.paymentMethod || 'unknown'
    paymentMap[method] = (paymentMap[method] || 0) + order.total
  }
  const paymentMethodBreakdown = Object.entries(paymentMap).map(([method, total]) => ({
    method,
    total: Math.round(total * 100) / 100,
  }))

  // 5. Order type breakdown
  const typeMap: Record<string, { revenue: number; count: number }> = {}
  for (const order of todayOrders.filter(o => o.paymentStatus === 'paid')) {
    const type = order.type || 'unknown'
    if (!typeMap[type]) typeMap[type] = { revenue: 0, count: 0 }
    typeMap[type].revenue += order.total
    typeMap[type].count += 1
  }
  const orderTypeBreakdown = Object.entries(typeMap).map(([type, data]) => ({
    type,
    revenue: Math.round(data.revenue * 100) / 100,
    count: data.count,
  }))

  // 6. Top selling items
  const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {}
  for (const order of todayOrders.filter(o => o.paymentStatus === 'paid')) {
    for (const oi of order.orderItems) {
      const name = oi.menuItem?.name || 'Neznan artikel'
      if (!itemMap[oi.menuItemId]) itemMap[oi.menuItemId] = { name, quantity: 0, revenue: 0 }
      itemMap[oi.menuItemId].quantity += oi.quantity
      itemMap[oi.menuItemId].revenue += oi.price * oi.quantity
    }
  }
  const topSellingItems = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity).slice(0, 10)

  // 7. Employee performance
  const empMap: Record<string, { name: string; orders: number; revenue: number }> = {}
  for (const order of todayOrders.filter(o => o.paymentStatus === 'paid')) {
    const empId = order.employeeId || 'none'
    const empName = order.employee ? order.employee.name : 'Nedodeljeno'
    if (!empMap[empId]) empMap[empId] = { name: empName, orders: 0, revenue: 0 }
    empMap[empId].orders += 1
    empMap[empId].revenue += order.total
  }
  const employeePerformance = Object.values(empMap).sort((a, b) => b.revenue - a.revenue)

  // 8. Average wait time (updatedAt - createdAt za completed orders)
  const completedOrders = todayOrders.filter(o => o.status === 'completed')
  const avgWaitMinutes = completedOrders.length > 0
    ? completedOrders.reduce((sum, o) => {
        const created = new Date(o.createdAt).getTime()
        const completed = new Date(o.updatedAt).getTime()
        return sum + (completed - created) / 60000
      }, 0) / completedOrders.length
    : 0

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
    // Nova analitika
    categoryBreakdown,
    hourlyRevenue,
    vatBreakdown,
    paymentMethodBreakdown,
    orderTypeBreakdown,
    topSellingItems,
    employeePerformance,
    avgWaitMinutes: Math.round(avgWaitMinutes),
  })
  } catch (error) {
    console.error('Napaka pri pridobivanju dashboard podatkov:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju dashboard podatkov' }, { status: 500 })
  }
}
