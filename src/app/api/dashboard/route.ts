
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum, round2, abs } from '@/lib/decimal'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError, validateApiResponse } from '@/lib/api-utils'
import { dashboardResponseSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('dashboard', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX C-07: Zahtevaj avtentikacijo za dashboard
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // ─── OSNOVNA AGREGACIJA — ena poizvedba namesto 7+ filter klicev ───
    const [todayPaidAgg, todayStatusCounts] = await Promise.all([
      db.order.aggregate({
        where: { createdAt: { gte: today, lt: tomorrow }, paymentStatus: 'paid' },
        _sum: { total: true, tip: true, tax: true, discount: true },
        _count: true,
        _avg: { total: true },
      }),
      db.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: today, lt: tomorrow } },
        _count: true,
      }),
    ])

    const todayRevenue = toNum(todayPaidAgg._sum.total)
    const todayTips = toNum(todayPaidAgg._sum.tip)
    const todayTax = toNum(todayPaidAgg._sum.tax)
    const todayDiscount = toNum(todayPaidAgg._sum.discount)
    const paidOrderCount = todayPaidAgg._count
    const avgOrderValue = paidOrderCount > 0 ? todayRevenue / paidOrderCount : 0
    const totalOrders = todayStatusCounts.reduce((sum, g) => sum + g._count, 0)
    const completedOrders = todayStatusCounts.find(g => g.status === 'completed')?._count ?? 0
    const cancelledOrders = todayStatusCounts.find(g => g.status === 'cancelled')?._count ?? 0
    const pendingOrders = todayStatusCounts.find(g => g.status === 'pending')?._count ?? 0
    const inProgressOrders = todayStatusCounts.find(g => g.status === 'in-progress')?._count ?? 0
    const readyOrders = todayStatusCounts.find(g => g.status === 'ready')?._count ?? 0

    // ─── MIZE, ZALOGA, ZADNJA NAROČILA — vzporedno ───
    const [activeTables, totalTables, lowStockItems, recentOrders] = await Promise.all([
      db.table.count({ where: { status: 'occupied' } }),
      db.table.count(),
      // Raw SQL za cross-field primerjavo (quantity <= minQuantity) — Prisma tega ne podpira
      db.$queryRaw<Array<{ id: string; name: string; quantity: number; minQuantity: number; unit: string | null }>>`
        SELECT id, name, quantity, "minQuantity", unit
        FROM InventoryItem
        WHERE quantity <= "minQuantity"
        ORDER BY name ASC
        LIMIT 5
      `,
      db.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { table: true, orderItems: { include: { menuItem: true } } },
      }),
    ])

    // ─── TEDENSKA PORABA — groupBy namesto JS loop ───
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const weeklyRevenueByDay = await db.order.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: sevenDaysAgo }, status: 'completed', paymentStatus: 'paid' },
      _sum: { total: true },
    })

    // Zgradi dailyRevenue iz groupBy rezultatov
    const dailyRevenue: { date: string; revenue: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const day = new Date()
      day.setDate(day.getDate() - i)
      day.setHours(0, 0, 0, 0)
      const nextDay = new Date(day)
      nextDay.setDate(nextDay.getDate() + 1)
      const dayStr = day.toISOString().split('T')[0]
      const dayRevenue = weeklyRevenueByDay
        .filter(g => {
          const d = new Date(g.createdAt)
          return d >= day && d < nextDay
        })
        .reduce((sum, g) => sum + toNum(g._sum.total), 0)
      dailyRevenue.push({ date: dayStr, revenue: round2(dayRevenue) })
    }

    // ─── ANALITIKA — groupBy po kategorijah, urah, DDV, plačilih ───
    const [categoryBreakdown, hourlyBreakdown, vatBreakdown, paymentMethodBreakdown, orderTypeBreakdown, topSellingItems, employeeBreakdown] = await Promise.all([
      // 1. Category breakdown — pridobi iz OrderItem s sledjo do kategorije
      db.orderItem.groupBy({
        by: ['menuItemId'],
        where: {
          order: { createdAt: { gte: today, lt: tomorrow }, paymentStatus: 'paid' },
          voided: false,
        },
        _sum: { price: true, quantity: true },
      }).then(async (items) => {
        // Pridobi imena kategorij za te menuItem-e
        if (items.length === 0) return []
        const menuItemIds = items.map(i => i.menuItemId)
        const menuItems = await db.menuItem.findMany({
          where: { id: { in: menuItemIds } },
          select: { id: true, name: true, category: { select: { name: true } } },
        })
        const catMap: Record<string, { name: string; revenue: number; count: number }> = {}
        for (const item of items) {
          const mi = menuItems.find(m => m.id === item.menuItemId)
          const catName = mi?.category?.name || 'Ostalo'
          if (!catMap[catName]) catMap[catName] = { name: catName, revenue: 0, count: 0 }
          catMap[catName].revenue += toNum(item._sum.price) * (item._sum.quantity ?? 0)
          catMap[catName].count += item._sum.quantity ?? 0
        }
        return Object.values(catMap).sort((a, b) => b.revenue - a.revenue)
      }),

      // 2. Hourly revenue — groupBy z ekstrakcijo ure
      db.order.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: today, lt: tomorrow }, paymentStatus: 'paid' },
        _sum: { total: true },
      }).then((orders) => {
        const hourlyMap: Record<number, number> = {}
        for (let h = 0; h < 24; h++) hourlyMap[h] = 0
        for (const o of orders) {
          const hour = new Date(o.createdAt).getHours()
          hourlyMap[hour] += toNum(o._sum.total)
        }
        return Object.entries(hourlyMap).map(([hour, revenue]) => ({
          hour: parseInt(hour),
          label: `${hour}:00`,
          revenue: round2(revenue),
        }))
      }),

      // 3. DDV breakdown — groupBy po vatRate
      db.orderItem.groupBy({
        by: ['vatRate'],
        where: {
          order: { createdAt: { gte: today, lt: tomorrow }, paymentStatus: 'paid' },
          voided: false,
        },
        _sum: { price: true, quantity: true },
      }).then((items) =>
        items.map(item => {
          const rate = String(item.vatRate ?? 22)
          const base = toNum(item._sum.price) * (item._sum.quantity ?? 0)
          return {
            rate,
            base: round2(base),
            vat: round2(base * (toNum(item.vatRate ?? 22) / 100)),
          }
        })
      ),

      // 4. Payment method breakdown
      db.order.groupBy({
        by: ['paymentMethod'],
        where: { createdAt: { gte: today, lt: tomorrow }, paymentStatus: 'paid' },
        _sum: { total: true },
      }).then((items) =>
        items.map(item => ({
          method: item.paymentMethod || 'unknown',
          total: round2(toNum(item._sum.total)),
        }))
      ),

      // 5. Order type breakdown
      db.order.groupBy({
        by: ['type'],
        where: { createdAt: { gte: today, lt: tomorrow }, paymentStatus: 'paid' },
        _sum: { total: true },
        _count: true,
      }).then((items) =>
        items.map(item => ({
          type: item.type || 'unknown',
          revenue: round2(toNum(item._sum.total)),
          count: item._count,
        }))
      ),

      // 6. Top selling items
      db.orderItem.groupBy({
        by: ['menuItemId'],
        where: {
          order: { createdAt: { gte: today, lt: tomorrow }, paymentStatus: 'paid' },
          voided: false,
        },
        _sum: { price: true, quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }).then(async (items) => {
        if (items.length === 0) return []
        const menuItemIds = items.map(i => i.menuItemId)
        const menuItems = await db.menuItem.findMany({
          where: { id: { in: menuItemIds } },
          select: { id: true, name: true },
        })
        return items.map(item => {
          const mi = menuItems.find(m => m.id === item.menuItemId)
          return {
            name: mi?.name || 'Neznan artikel',
            quantity: item._sum.quantity ?? 0,
            revenue: round2(toNum(item._sum.price) * (item._sum.quantity ?? 0)),
          }
        }).sort((a, b) => b.quantity - a.quantity)
      }),

      // 7. Employee performance — groupBy po employeeId
      db.order.groupBy({
        by: ['employeeId'],
        where: { createdAt: { gte: today, lt: tomorrow }, paymentStatus: 'paid' },
        _sum: { total: true },
        _count: true,
      }).then((items) =>
        items.map(item => ({
          name: 'Nedodeljeno', // Order nima employee relacije v groupBy
          orders: item._count,
          revenue: round2(toNum(item._sum.total)),
        })).sort((a, b) => b.revenue - a.revenue)
      ),
    ])

    // 8. Average wait time — ena poizvedba namesto filtra + reduce
    const completedOrdersForWait = await db.order.findMany({
      where: { createdAt: { gte: today, lt: tomorrow }, status: 'completed' },
      select: { createdAt: true, updatedAt: true },
    })
    const avgWaitMinutes = completedOrdersForWait.length > 0
      ? completedOrdersForWait.reduce((sum, o) => {
          const created = new Date(o.createdAt).getTime()
          const completed = new Date(o.updatedAt).getTime()
          return sum + (completed - created) / 60000
        }, 0) / completedOrdersForWait.length
      : 0

    // ─── FURS status, aktivna izmena, COGS — vzporedno ───
    const [settings, todayVerifiedReceipts, todayUnverifiedReceipts, activeShift, stockMovements] = await Promise.all([
      db.restaurantSettings.findFirst({ where: { isActive: true } }),
      db.receipt.count({
        where: { createdAt: { gte: today, lt: tomorrow }, fiscalVerified: true },
      }),
      db.receipt.count({
        where: { createdAt: { gte: today, lt: tomorrow }, fiscalVerified: false },
      }),
      db.cashRegisterShift.findFirst({
        where: { status: 'open' },
        orderBy: { openedAt: 'desc' },
      }),
      db.stockTransaction.findMany({
        where: { createdAt: { gte: today, lt: tomorrow }, type: 'sale' },
        select: { totalCost: true },
      }),
    ])

    const todayCogs = stockMovements.reduce((sum, t) => sum + toNum(abs(t.totalCost)), 0)
    const grossProfit = todayRevenue - todayCogs

    // ─── WoW COMPARISON — aggregate namesto findMany + JS reduce ───
    const thisWeekStart = new Date(today)
    thisWeekStart.setDate(today.getDate() - today.getDay() + 1) // Ponedeljek
    thisWeekStart.setHours(0, 0, 0, 0)
    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const lastWeekEnd = new Date(thisWeekStart)

    const [thisWeekAgg, lastWeekAgg, thisWeekDailyRaw, lastWeekDailyRaw] = await Promise.all([
      db.order.aggregate({
        where: { createdAt: { gte: thisWeekStart }, paymentStatus: 'paid' },
        _sum: { total: true },
        _count: true,
        _avg: { total: true },
      }),
      db.order.aggregate({
        where: { createdAt: { gte: lastWeekStart, lt: lastWeekEnd }, paymentStatus: 'paid' },
        _sum: { total: true },
        _count: true,
        _avg: { total: true },
      }),
      // Daily breakdown za ta teden
      db.order.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: thisWeekStart }, paymentStatus: 'paid' },
        _sum: { total: true },
        _count: true,
      }),
      // Daily breakdown za prejšnji teden
      db.order.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: lastWeekStart, lt: lastWeekEnd }, paymentStatus: 'paid' },
        _sum: { total: true },
        _count: true,
      }),
    ])

    const thisWeekRevenue = toNum(thisWeekAgg._sum.total)
    const lastWeekRevenue = toNum(lastWeekAgg._sum.total)
    const thisWeekOrderCount = thisWeekAgg._count
    const lastWeekOrderCount = lastWeekAgg._count
    const thisWeekAvg = thisWeekOrderCount > 0 ? thisWeekRevenue / thisWeekOrderCount : 0
    const lastWeekAvg = lastWeekOrderCount > 0 ? lastWeekRevenue / lastWeekOrderCount : 0

    const wowRevenueChange = lastWeekRevenue > 0 ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0
    const wowOrderChange = lastWeekOrderCount > 0 ? ((thisWeekOrderCount - lastWeekOrderCount) / lastWeekOrderCount) * 100 : 0
    const wowAvgChange = lastWeekAvg > 0 ? ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100 : 0

    // Zgravi daily array iz groupBy
    const thisWeekDaily: { date: string; revenue: number; orders: number }[] = []
    const lastWeekDaily: { date: string; revenue: number; orders: number }[] = []
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(thisWeekStart)
      dayStart.setDate(dayStart.getDate() + i)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const thisDayRev = thisWeekDailyRaw.filter(g => new Date(g.createdAt) >= dayStart && new Date(g.createdAt) < dayEnd).reduce((s, g) => s + toNum(g._sum.total), 0)
      const thisDayCount = thisWeekDailyRaw.filter(g => new Date(g.createdAt) >= dayStart && new Date(g.createdAt) < dayEnd).reduce((s, g) => s + g._count, 0)
      thisWeekDaily.push({ date: dayStart.toISOString().split('T')[0], revenue: round2(thisDayRev), orders: thisDayCount })

      const lastDayStart = new Date(lastWeekStart)
      lastDayStart.setDate(lastDayStart.getDate() + i)
      const lastDayEnd = new Date(lastDayStart)
      lastDayEnd.setDate(lastDayEnd.getDate() + 1)

      const lastDayRev = lastWeekDailyRaw.filter(g => new Date(g.createdAt) >= lastDayStart && new Date(g.createdAt) < lastDayEnd).reduce((s, g) => s + toNum(g._sum.total), 0)
      const lastDayCount = lastWeekDailyRaw.filter(g => new Date(g.createdAt) >= lastDayStart && new Date(g.createdAt) < lastDayEnd).reduce((s, g) => s + g._count, 0)
      lastWeekDaily.push({ date: lastDayStart.toISOString().split('T')[0], revenue: round2(lastDayRev), orders: lastDayCount })
    }

    // ─── HEATMAP — groupBy namesto 126 filter+reduce iteracij ───
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
    const heatmapRaw = await db.order.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: fourWeeksAgo }, paymentStatus: 'paid' },
      _sum: { total: true },
      _count: true,
    })
    const heatmapData: { day: number; hour: number; revenue: number; orders: number }[] = []
    for (let d = 0; d < 7; d++) {
      for (let h = 6; h <= 23; h++) {
        const matching = heatmapRaw.filter(g => {
          const date = new Date(g.createdAt)
          const dayOfWeek = (date.getDay() + 6) % 7 // Pon=0, Ned=6
          return dayOfWeek === d && date.getHours() === h
        })
        const rev = matching.reduce((s, g) => s + toNum(g._sum.total), 0)
        const count = matching.reduce((s, g) => s + g._count, 0)
        heatmapData.push({ day: d, hour: h, revenue: round2(rev), orders: count })
      }
    }

    // ─── GOSTI ───
    const [repeatGuests, totalGuests] = await Promise.all([
      db.guest.count({ where: { totalVisits: { gt: 1 } } }),
      db.guest.count(),
    ])
    const guestReturnRate = totalGuests > 0 ? (repeatGuests / totalGuests) * 100 : 0

    const responseBody = {
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
      hourlyRevenue: hourlyBreakdown,
      vatBreakdown,
      paymentMethodBreakdown,
      orderTypeBreakdown,
      topSellingItems,
      employeePerformance: employeeBreakdown,
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
        openedAt: activeShift.openedAt.toISOString(),
        startingCash: activeShift.startingCash,
        cashSales: activeShift.cashSales,
        cardSales: activeShift.cardSales,
        totalSales: activeShift.totalSales,
        totalOrders: activeShift.totalOrders,
      } : null,
      // Stroški
      todayCogs: round2(todayCogs),
      grossProfit: round2(grossProfit),
      grossMargin: todayRevenue > 0 ? round2((grossProfit / todayRevenue) * 100) : 0,
      // Napredna analitika
      wowComparison: {
        thisWeek: { revenue: round2(thisWeekRevenue), orders: thisWeekOrderCount, avgOrder: round2(thisWeekAvg) },
        lastWeek: { revenue: round2(lastWeekRevenue), orders: lastWeekOrderCount, avgOrder: round2(lastWeekAvg) },
        changes: { revenue: round2(wowRevenueChange), orders: round2(wowOrderChange), avgOrder: round2(wowAvgChange) },
        thisWeekDaily,
        lastWeekDaily,
      },
      heatmapData,
      guestAnalytics: {
        totalGuests,
        repeatGuests,
        guestReturnRate: round2(guestReturnRate),
      },
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
