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
    include: { orderItems: { include: { menuItem: { include: { category: true } } } }, table: true },
    orderBy: { createdAt: 'desc' },
  })

  const todayRevenue = todayOrders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.total, 0)
  const todayTips = todayOrders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.tip, 0)
  const todayTax = todayOrders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.tax, 0)
  const todayDiscount = todayOrders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.discount, 0)
  const totalOrders = todayOrders.length
  const paidOrderCount = todayOrders.filter(o => o.paymentStatus === 'paid').length
  const completedOrders = todayOrders.filter(o => o.status === 'completed').length
  const cancelledOrders = todayOrders.filter(o => o.status === 'cancelled').length
  const avgOrderValue = paidOrderCount > 0 ? todayRevenue / paidOrderCount : 0
  const pendingOrders = todayOrders.filter(o => o.status === 'pending').length
  const inProgressOrders = todayOrders.filter(o => o.status === 'in-progress').length
  const readyOrders = todayOrders.filter(o => o.status === 'ready').length

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
    const empName = 'Nedodeljeno' // Order nima employee relacije
    if (!empMap[empId]) empMap[empId] = { name: empName, orders: 0, revenue: 0 }
    empMap[empId].orders += 1
    empMap[empId].revenue += order.total
  }
  const employeePerformance = Object.values(empMap).sort((a, b) => b.revenue - a.revenue)

  // 8. Average wait time (updatedAt - createdAt za completed orders)
  const completedOrdersList = todayOrders.filter(o => o.status === 'completed')
  const avgWaitMinutes = completedOrdersList.length > 0
    ? completedOrdersList.reduce((sum, o) => {
        const created = new Date(o.createdAt).getTime()
        const completed = new Date(o.updatedAt).getTime()
        return sum + (completed - created) / 60000
      }, 0) / completedOrdersList.length
    : 0

  // ─── FURS status ───
  const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
  const todayVerifiedReceipts = await db.receipt.count({
    where: {
      createdAt: { gte: today, lt: tomorrow },
      fiscalVerified: true,
    },
  })
  const todayUnverifiedReceipts = await db.receipt.count({
    where: {
      createdAt: { gte: today, lt: tomorrow },
      fiscalVerified: false,
    },
  })

  // ─── Aktivna blagajniška izmena ───
  const activeShift = await db.cashRegisterShift.findFirst({
    where: { status: 'open' },
    orderBy: { openedAt: 'desc' },
  })

  // ─── Stroški zaloge (COGS) ───
  const stockMovements = await db.stockTransaction.findMany({
    where: { createdAt: { gte: today, lt: tomorrow }, type: 'sale' },
  })
  const todayCogs = stockMovements.reduce((sum, t) => sum + Math.abs(t.totalCost), 0)
  const grossProfit = todayRevenue - todayCogs

  // ============================================
  // NAPREDNA ANALITIKA (WoW, Heatmap, Trends)
  // ============================================

  // 9. Week-over-Week comparison (ta teden vs prejšnji teden)
  const thisWeekStart = new Date(today)
  thisWeekStart.setDate(today.getDate() - today.getDay() + 1) // Ponedeljek
  thisWeekStart.setHours(0, 0, 0, 0)
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  const lastWeekEnd = new Date(thisWeekStart)

  const thisWeekOrders = await db.order.findMany({
    where: { createdAt: { gte: thisWeekStart }, paymentStatus: 'paid' },
  })
  const lastWeekOrders = await db.order.findMany({
    where: { createdAt: { gte: lastWeekStart, lt: lastWeekEnd }, paymentStatus: 'paid' },
  })

  const thisWeekRevenue = thisWeekOrders.reduce((sum, o) => sum + o.total, 0)
  const lastWeekRevenue = lastWeekOrders.reduce((sum, o) => sum + o.total, 0)
  const thisWeekOrderCount = thisWeekOrders.length
  const lastWeekOrderCount = lastWeekOrders.length
  const thisWeekAvg = thisWeekOrderCount > 0 ? thisWeekRevenue / thisWeekOrderCount : 0
  const lastWeekAvg = lastWeekOrderCount > 0 ? lastWeekRevenue / lastWeekOrderCount : 0

  const wowRevenueChange = lastWeekRevenue > 0 ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0
  const wowOrderChange = lastWeekOrderCount > 0 ? ((thisWeekOrderCount - lastWeekOrderCount) / lastWeekOrderCount) * 100 : 0
  const wowAvgChange = lastWeekAvg > 0 ? ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100 : 0

  // Daily breakdown for this week and last week
  const thisWeekDaily: { date: string; revenue: number; orders: number }[] = []
  const lastWeekDaily: { date: string; revenue: number; orders: number }[] = []
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(thisWeekStart)
    dayStart.setDate(dayStart.getDate() + i)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const thisDayRev = thisWeekOrders.filter(o => new Date(o.createdAt) >= dayStart && new Date(o.createdAt) < dayEnd).reduce((s, o) => s + o.total, 0)
    const thisDayCount = thisWeekOrders.filter(o => new Date(o.createdAt) >= dayStart && new Date(o.createdAt) < dayEnd).length
    thisWeekDaily.push({ date: dayStart.toISOString().split('T')[0], revenue: Math.round(thisDayRev * 100) / 100, orders: thisDayCount })

    const lastDayStart = new Date(lastWeekStart)
    lastDayStart.setDate(lastDayStart.getDate() + i)
    const lastDayEnd = new Date(lastDayStart)
    lastDayEnd.setDate(lastDayEnd.getDate() + 1)

    const lastDayRev = lastWeekOrders.filter(o => new Date(o.createdAt) >= lastDayStart && new Date(o.createdAt) < lastDayEnd).reduce((s, o) => s + o.total, 0)
    const lastDayCount = lastWeekOrders.filter(o => new Date(o.createdAt) >= lastDayStart && new Date(o.createdAt) < lastDayEnd).length
    lastWeekDaily.push({ date: lastDayStart.toISOString().split('T')[0], revenue: Math.round(lastDayRev * 100) / 100, orders: lastDayCount })
  }

  // 10. Revenue Heatmap (zadnjih 4 tedne po urah in dnevih)
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
  const heatmapOrders = await db.order.findMany({
    where: { createdAt: { gte: fourWeeksAgo }, paymentStatus: 'paid' },
  })
  const heatmapData: { day: number; hour: number; revenue: number; orders: number }[] = []
  for (let d = 0; d < 7; d++) {
    for (let h = 6; h <= 23; h++) {
      const matching = heatmapOrders.filter(o => {
        const date = new Date(o.createdAt)
        const dayOfWeek = (date.getDay() + 6) % 7 // Pon=0, Ned=6
        return dayOfWeek === d && date.getHours() === h
      })
      const rev = matching.reduce((s, o) => s + o.total, 0)
      heatmapData.push({ day: d, hour: h, revenue: Math.round(rev * 100) / 100, orders: matching.length })
    }
  }

  // 11. Guest frequency (povratni gostje)
  const repeatGuests = await db.guest.count({
    where: { visitCount: { gt: 1 } },
  })
  const totalGuests = await db.guest.count()
  const guestReturnRate = totalGuests > 0 ? (repeatGuests / totalGuests) * 100 : 0

  return NextResponse.json({
    todayRevenue,
    todayTips,
    todayTax,
    todayDiscount,
    totalOrders,
    completedOrders,
    cancelledOrders,
    avgOrderValue,
    activeTables,
    totalTables,
    lowStockItems,
    recentOrders,
    dailyRevenue,
    pendingOrders,
    inProgressOrders,
    readyOrders,
    // Nova analitika
    categoryBreakdown,
    hourlyRevenue,
    vatBreakdown,
    paymentMethodBreakdown,
    orderTypeBreakdown,
    topSellingItems,
    employeePerformance,
    avgWaitMinutes: Math.round(avgWaitMinutes),
    // FURS & Blagajna
    fursStatus: {
      configured: !!(settings?.fursCertPath),
      environment: settings?.fursEnvironment || 'test',
      todayVerified: todayVerifiedReceipts,
      todayUnverified: todayUnverifiedReceipts,
    },
    activeShift: activeShift ? {
      id: activeShift.id,
      openedAt: activeShift.openedAt,
      startingCash: activeShift.startingCash,
      cashSales: activeShift.cashSales,
      cardSales: activeShift.cardSales,
      totalSales: activeShift.totalSales,
      totalOrders: activeShift.totalOrders,
    } : null,
    // Stroški
    todayCogs: Math.round(todayCogs * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossMargin: todayRevenue > 0 ? Math.round((grossProfit / todayRevenue) * 100 * 100) / 100 : 0,
    // Napredna analitika
    wowComparison: {
      thisWeek: { revenue: Math.round(thisWeekRevenue * 100) / 100, orders: thisWeekOrderCount, avgOrder: Math.round(thisWeekAvg * 100) / 100 },
      lastWeek: { revenue: Math.round(lastWeekRevenue * 100) / 100, orders: lastWeekOrderCount, avgOrder: Math.round(lastWeekAvg * 100) / 100 },
      changes: { revenue: Math.round(wowRevenueChange * 100) / 100, orders: Math.round(wowOrderChange * 100) / 100, avgOrder: Math.round(wowAvgChange * 100) / 100 },
      thisWeekDaily,
      lastWeekDaily,
    },
    heatmapData,
    guestAnalytics: {
      totalGuests,
      repeatGuests,
      guestReturnRate: Math.round(guestReturnRate * 100) / 100,
    },
  })
  } catch (error) {
    console.error('Napaka pri pridobivanju dashboard podatkov:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju dashboard podatkov' }, { status: 500 })
  }
}
