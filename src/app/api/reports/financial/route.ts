import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/reports/financial — Celovito poslovno poročanje z izpiski za knjiženje
// Parametri: period=daily|weekly|monthly|yearly, date=YYYY-MM-DD (referenčni datum)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'daily'
    const refDateStr = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const refDate = new Date(refDateStr)

    // Izračunaj obdobje glede na tip
    let startDate: Date
    let endDate: Date
    let prevStartDate: Date
    let prevEndDate: Date
    let periodLabel: string

    switch (period) {
      case 'daily': {
        startDate = new Date(refDate); startDate.setHours(0, 0, 0, 0)
        endDate = new Date(refDate); endDate.setHours(23, 59, 59, 999)
        prevStartDate = new Date(refDate); prevStartDate.setDate(prevStartDate.getDate() - 1); prevStartDate.setHours(0, 0, 0, 0)
        prevEndDate = new Date(refDate); prevEndDate.setDate(prevEndDate.getDate() - 1); prevEndDate.setHours(23, 59, 59, 999)
        periodLabel = startDate.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })
        break
      }
      case 'weekly': {
        const dayOfWeek = refDate.getDay() || 7 // Ponedeljek = 1
        startDate = new Date(refDate); startDate.setDate(refDate.getDate() - dayOfWeek + 1); startDate.setHours(0, 0, 0, 0)
        endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23, 59, 59, 999)
        prevStartDate = new Date(startDate); prevStartDate.setDate(prevStartDate.getDate() - 7)
        prevEndDate = new Date(endDate); prevEndDate.setDate(prevEndDate.getDate() - 7)
        periodLabel = `${startDate.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit' })} - ${endDate.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
        break
      }
      case 'monthly': {
        startDate = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
        endDate = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59, 999)
        prevStartDate = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1)
        prevEndDate = new Date(refDate.getFullYear(), refDate.getMonth(), 0, 23, 59, 59, 999)
        periodLabel = startDate.toLocaleDateString('sl-SI', { month: 'long', year: 'numeric' })
        break
      }
      case 'yearly': {
        startDate = new Date(refDate.getFullYear(), 0, 1)
        endDate = new Date(refDate.getFullYear(), 11, 31, 23, 59, 59, 999)
        prevStartDate = new Date(refDate.getFullYear() - 1, 0, 1)
        prevEndDate = new Date(refDate.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
        periodLabel = String(refDate.getFullYear())
        break
      }
      default: {
        startDate = new Date(refDate); startDate.setHours(0, 0, 0, 0)
        endDate = new Date(refDate); endDate.setHours(23, 59, 59, 999)
        prevStartDate = new Date(refDate); prevStartDate.setDate(prevStartDate.getDate() - 1); prevStartDate.setHours(0, 0, 0, 0)
        prevEndDate = new Date(refDate); prevEndDate.setDate(prevEndDate.getDate() - 1); prevEndDate.setHours(23, 59, 59, 999)
        periodLabel = startDate.toLocaleDateString('sl-SI')
      }
    }

    // === POIZVEDBE ===

    // Trenutno obdobje - vsa naročila
    const orders = await db.order.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { orderItems: { include: { menuItem: { include: { category: true } } } }, table: true },
      orderBy: { createdAt: 'asc' },
    })

    // Prejšnje obdobje za primerjavo
    const prevOrders = await db.order.findMany({
      where: { createdAt: { gte: prevStartDate, lte: prevEndDate } },
    })

    // === OSNOVNI KAZALCI ===
    const completedOrders = orders.filter(o => o.status === 'completed')
    const paidOrders = orders.filter(o => o.paymentStatus === 'paid')
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0)
    const totalSubtotal = completedOrders.reduce((sum, o) => sum + o.subtotal, 0)
    const totalTax = completedOrders.reduce((sum, o) => sum + o.tax, 0)
    const totalDiscount = completedOrders.reduce((sum, o) => sum + o.discount, 0)
    const totalOrdersCount = orders.length
    const completedCount = completedOrders.length
    const cancelledCount = orders.filter(o => o.status === 'cancelled').length
    const avgOrderValue = completedCount > 0 ? totalRevenue / completedCount : 0

    // Prejšnje obdobje primerjava
    const prevCompletedOrders = prevOrders.filter(o => o.status === 'completed')
    const prevRevenue = prevCompletedOrders.reduce((sum, o) => sum + o.total, 0)
    const prevCount = prevCompletedOrders.length
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0
    const orderChange = prevCount > 0 ? ((completedCount - prevCount) / prevCount) * 100 : 0

    // === PLAČILNE METODE ===
    const normalizeMethod = (m: string): string => {
      const map: Record<string, string> = { cash: 'gotovina', card: 'kartica', mobile: 'mobilno', valuto: 'kartica' }
      return map[m] || m || 'gotovina'
    }
    const paymentMethods: Record<string, { method: string; count: number; revenue: number; tax: number }> = {}
    paidOrders.forEach(order => {
      const method = normalizeMethod(order.paymentMethod)
      if (!paymentMethods[method]) {
        paymentMethods[method] = { method, count: 0, revenue: 0, tax: 0 }
      }
      paymentMethods[method].count += 1
      paymentMethods[method].revenue += order.total
      paymentMethods[method].tax += order.tax
    })

    // === VRSTE NAROČIL ===
    const orderTypes: Record<string, { type: string; count: number; revenue: number }> = {}
    completedOrders.forEach(order => {
      const type = order.type || 'dine-in'
      if (!orderTypes[type]) {
        orderTypes[type] = { type, count: 0, revenue: 0 }
      }
      orderTypes[type].count += 1
      orderTypes[type].revenue += order.total
    })

    // === PO KATEGORIJAH ===
    const categoryBreakdown: Record<string, { category: string; revenue: number; quantity: number; items: number }> = {}
    completedOrders.forEach(order => {
      order.orderItems.forEach(oi => {
        const cat = oi.menuItem?.category?.name || 'Ostalo'
        if (!categoryBreakdown[cat]) {
          categoryBreakdown[cat] = { category: cat, revenue: 0, quantity: 0, items: 0 }
        }
        categoryBreakdown[cat].revenue += oi.price * oi.quantity
        categoryBreakdown[cat].quantity += oi.quantity
        categoryBreakdown[cat].items += 1
      })
    })

    // === PO ARTIKLIH (ZA IZPISKE) ===
    const itemBreakdown: Record<string, { name: string; category: string; quantity: number; revenue: number; avgPrice: number }> = {}
    completedOrders.forEach(order => {
      order.orderItems.forEach(oi => {
        if (!itemBreakdown[oi.menuItemId]) {
          itemBreakdown[oi.menuItemId] = {
            name: oi.menuItem?.name || 'Neznan',
            category: oi.menuItem?.category?.name || 'Ostalo',
            quantity: 0,
            revenue: 0,
            avgPrice: oi.price,
          }
        }
        itemBreakdown[oi.menuItemId].quantity += oi.quantity
        itemBreakdown[oi.menuItemId].revenue += oi.price * oi.quantity
      })
    })
    // Izračunaj povprečno ceno
    Object.values(itemBreakdown).forEach(item => {
      if (item.quantity > 0) item.avgPrice = item.revenue / item.quantity
    })

    // === ČASOVNA RAZDELITEV (za grafikon) ===
    const timeDistribution: Record<string, { period: string; revenue: number; orders: number }> = {}

    if (period === 'daily') {
      // Po urah
      for (let h = 0; h < 24; h++) {
        timeDistribution[String(h).padStart(2, '0')] = {
          period: `${String(h).padStart(2, '0')}:00`,
          revenue: 0, orders: 0,
        }
      }
      completedOrders.forEach(order => {
        const hour = new Date(order.createdAt).getHours()
        const key = String(hour).padStart(2, '0')
        if (timeDistribution[key]) {
          timeDistribution[key].revenue += order.total
          timeDistribution[key].orders += 1
        }
      })
    } else if (period === 'weekly') {
      // Po dneh v tednu
      const dayNames = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']
      dayNames.forEach(d => { timeDistribution[d] = { period: d, revenue: 0, orders: 0 } })
      completedOrders.forEach(order => {
        const dayIdx = (new Date(order.createdAt).getDay() + 6) % 7 // 0=Pon
        const key = dayNames[dayIdx]
        if (timeDistribution[key]) {
          timeDistribution[key].revenue += order.total
          timeDistribution[key].orders += 1
        }
      })
    } else if (period === 'monthly') {
      // Po dnevih v mesecu
      const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate()
      for (let d = 1; d <= daysInMonth; d++) {
        const key = String(d).padStart(2, '0')
        timeDistribution[key] = { period: String(d), revenue: 0, orders: 0 }
      }
      completedOrders.forEach(order => {
        const day = new Date(order.createdAt).getDate()
        const key = String(day).padStart(2, '0')
        if (timeDistribution[key]) {
          timeDistribution[key].revenue += order.total
          timeDistribution[key].orders += 1
        }
      })
    } else {
      // Po mesecih v letu
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec']
      monthNames.forEach(m => { timeDistribution[m] = { period: m, revenue: 0, orders: 0 } })
      completedOrders.forEach(order => {
        const monthIdx = new Date(order.createdAt).getMonth()
        const key = monthNames[monthIdx]
        if (timeDistribution[key]) {
          timeDistribution[key].revenue += order.total
          timeDistribution[key].orders += 1
        }
      })
    }

    // === STROŠKI ZALOG (iz transakcij) ===
    const stockTransactions = await db.stockTransaction.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { inventoryItem: { select: { name: true, category: true } } },
    })

    const procurementCost = stockTransactions
      .filter(t => t.type === 'procurement')
      .reduce((sum, t) => sum + t.totalCost, 0)

    const writeOffCost = stockTransactions
      .filter(t => t.type === 'write-off' || t.type === 'return')
      .reduce((sum, t) => sum + Math.abs(t.totalCost), 0)

    const cogs = stockTransactions
      .filter(t => t.type === 'sale')
      .reduce((sum, t) => sum + Math.abs(t.totalCost), 0)

    const grossProfit = totalRevenue - cogs
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

    // === NAPITNINE ===
    const totalTips = paidOrders.reduce((sum, o) => {
      // Če ima order tip polje - dodaj, sicer 0
      return sum + 0
    }, 0)

    // === BLAGAJNA IZPISKI ===
    const cashRegisterShifts = await db.cashRegisterShift.findMany({
      where: { openedAt: { gte: startDate, lte: endDate } },
    })
    const totalCashSales = cashRegisterShifts.reduce((sum, s) => sum + s.cashSales, 0)
    const totalCardSales = cashRegisterShifts.reduce((sum, s) => sum + s.cardSales, 0)
    const totalMobileSales = cashRegisterShifts.reduce((sum, s) => sum + s.mobileSales, 0)

    // Če blagajna nima podatkov, uporabi plačilne metode iz naročil
    const effectiveCashSales = totalCashSales > 0 ? totalCashSales : (paymentMethods['gotovina']?.revenue || 0)
    const effectiveCardSales = totalCardSales > 0 ? totalCardSales : (paymentMethods['kartica']?.revenue || 0)
    const effectiveMobileSales = totalMobileSales > 0 ? totalMobileSales : (paymentMethods['mobilno']?.revenue || 0)

    // === SESTAVEK IZPISKA ZA KNJIŽENJE ===
    const bookingEntry = {
      date: periodLabel,
      period,
      debit: {
        '1140 - Potrošniki - Gotovina': Math.round(effectiveCashSales * 100) / 100,
        '1140 - Potrošniki - Kartice': Math.round(effectiveCardSales * 100) / 100,
        '1140 - Potrošniki - Mobilno': Math.round(effectiveMobileSales * 100) / 100,
      },
      credit: {
        '7600 - Prihodki od prodaje jedi in pijač': Math.round(totalSubtotal * 100) / 100,
        '2530 - DDV obveznosti': Math.round(totalTax * 100) / 100,
      },
      totalDebit: Math.round((effectiveCashSales + effectiveCardSales + effectiveMobileSales) * 100) / 100,
      totalCredit: Math.round((totalSubtotal + totalTax) * 100) / 100,
    }

    return NextResponse.json({
      period,
      periodLabel,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      // Osnovni kazalci
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalSubtotal: Math.round(totalSubtotal * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        totalOrdersCount,
        completedCount,
        cancelledCount,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        // Primerjava s prejšnjim obdobjem
        prevRevenue: Math.round(prevRevenue * 100) / 100,
        revenueChange: Math.round(revenueChange * 100) / 100,
        orderChange: Math.round(orderChange * 100) / 100,
      },
      // Plačilne metode
      paymentMethods: Object.values(paymentMethods),
      // Vrste naročil
      orderTypes: Object.values(orderTypes),
      // Kategorije
      categoryBreakdown: Object.values(categoryBreakdown).sort((a, b) => b.revenue - a.revenue),
      // Artikli
      itemBreakdown: Object.values(itemBreakdown).sort((a, b) => b.revenue - a.revenue),
      // Časovna porazdelitev
      timeDistribution: Object.values(timeDistribution),
      // Stroški in dobiček
      costs: {
        procurementCost: Math.round(procurementCost * 100) / 100,
        cogs: Math.round(cogs * 100) / 100,
        writeOffCost: Math.round(writeOffCost * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossMargin: Math.round(grossMargin * 100) / 100,
      },
      // Napitnine
      totalTips,
      // Blagajna
      cashRegister: {
        totalCashSales: Math.round(effectiveCashSales * 100) / 100,
        totalCardSales: Math.round(effectiveCardSales * 100) / 100,
        totalMobileSales: Math.round(effectiveMobileSales * 100) / 100,
        shiftCount: cashRegisterShifts.length,
      },
      // Knjižbeni izpisek
      bookingEntry,
    })
  } catch (error) {
    console.error('Financial report error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju poročila' }, { status: 500 })
  }
}
