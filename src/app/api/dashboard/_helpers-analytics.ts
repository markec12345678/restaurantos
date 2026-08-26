// Pomožne funkcije za Dashboard API — analitične poizvedbe
// Izvlečene iz _helpers.ts za boljšo berljivost

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'

// ─── Analitika — kategorije, ure, DDV, plačila, tipi, top artikli, zaposleni ───

export async function fetchAnalyticsBreakdowns(today: Date, tomorrow: Date) {
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

  return {
    categoryBreakdown,
    hourlyBreakdown,
    vatBreakdown,
    paymentMethodBreakdown,
    orderTypeBreakdown,
    topSellingItems,
    employeeBreakdown,
  }
}
