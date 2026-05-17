import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// GET /api/reports/financial — Celovito poslovno poročanje z izpiski za knjiženje
// Parametri: period=daily|weekly|monthly|yearly, date=YYYY-MM-DD (referenčni datum)
export async function GET(req: Request) {
  try {
    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do finančnih podatkov
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

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

    // FIX CRITICAL: Za finančna poročila uporabimo paidAt (datum plačila) namesto createdAt.
    // Naročilo, ustvarjeno včeraj a plačano danes, sodi v današnji dan.
    // Trenutno obdobje - vsa naročila (za status poročila uporabimo createdAt)
    const orders = await db.order.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { orderItems: { include: { menuItem: { include: { category: true } } } }, table: true },
      orderBy: { createdAt: 'asc' },
    })

    // FIX CRITICAL: Za finančne podatke uporabimo paidAt — naročila plačana v tem obdobju
    const paidOrdersForPeriod = await db.order.findMany({
      where: {
        paidAt: { gte: startDate, lte: endDate },
        paymentStatus: 'paid',
      },
      include: {
        orderItems: { include: { menuItem: { include: { category: true } } } },
        table: true,
        checks: {
          select: {
            payments: {
              where: { status: 'completed' },
              select: { type: true, amount: true, tipAmount: true },
            },
          },
        },
      },
      orderBy: { paidAt: 'asc' },
    })

    // Prejšnje obdobje za primerjavo (status poročilo)
    const prevOrders = await db.order.findMany({
      where: { createdAt: { gte: prevStartDate, lte: prevEndDate } },
      include: { orderItems: { include: { menuItem: { include: { category: true } } } }, table: true },
    })

    // FIX CRITICAL: Prejšnje obdobje za finančno primerjavo — uporabi paidAt
    const prevPaidOrders = await db.order.findMany({
      where: {
        paidAt: { gte: prevStartDate, lte: prevEndDate },
        paymentStatus: 'paid',
      },
      include: {
        orderItems: { include: { menuItem: { include: { category: true } } } },
        table: true,
        checks: {
          select: {
            payments: {
              where: { status: 'completed' },
              select: { type: true, amount: true, tipAmount: true },
            },
          },
        },
      },
    })

    // === OSNOVNI KAZALCI ===
    // FIX CRITICAL: Za finančne podatke uporabimo paidOrdersForPeriod (plačana naročila v obdobju)
    const completedOrders = orders.filter(o => o.status === 'completed') // Za status poročila
    const paidOrders = paidOrdersForPeriod // Za finančne podatke — plačana v tem obdobju
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0)
    const totalSubtotal = paidOrders.reduce((sum, o) => sum + o.subtotal, 0)
    const totalTax = paidOrders.reduce((sum, o) => sum + o.tax, 0)
    const totalDiscount = paidOrders.reduce((sum, o) => sum + o.discount, 0)
    const totalOrdersCount = orders.length // Vsa naročila (za status pregled)
    const completedCount = paidOrders.length // Plačana naročila
    const cancelledCount = orders.filter(o => o.status === 'cancelled').length
    const avgOrderValue = completedCount > 0 ? totalRevenue / completedCount : 0

    // Prejšnje obdobje primerjava — uporabi prevPaidOrders za finančne podatke
    const prevCompletedOrders = prevPaidOrders
    const prevRevenue = prevCompletedOrders.reduce((sum, o) => sum + o.total, 0)
    const prevSubtotal = prevCompletedOrders.reduce((sum, o) => sum + o.subtotal, 0)
    const prevTax = prevCompletedOrders.reduce((sum, o) => sum + o.tax, 0)
    const prevDiscount = prevCompletedOrders.reduce((sum, o) => sum + o.discount, 0)
    const prevCount = prevCompletedOrders.length
    const prevAvgOrderValue = prevCount > 0 ? prevRevenue / prevCount : 0
    const prevTips = prevPaidOrders.reduce((sum, o) => sum + (o.tip || 0), 0)
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0
    const orderChange = prevCount > 0 ? ((completedCount - prevCount) / prevCount) * 100 : 0

    // === PLAČILNE METODE ===
    // FIX CRITICAL: Uporabi ACTUAL payments iz checkov namesto order.paymentMethod
    // order.paymentMethod je en string — ne upošteva split plačil (več metod na eno naročilo)
    const normalizeMethod = (m: string): string => {
      const map: Record<string, string> = { cash: 'gotovina', card: 'kartica', mobile: 'mobilno', voucher: 'bon', loyalty: 'zvestoba', giftcard: 'darilna kartica', alternate: 'alternativno', valuto: 'kartica' }
      return map[m] || m || 'gotovina'
    }
    const paymentMethods: Record<string, { method: string; count: number; revenue: number; tax: number; tips: number }> = {}
    // FIX CRITICAL: Iteriraj po ACTUAL plačilih iz checkov — pravilna razčlenitev za split plačila
    const allPayments = paidOrders.flatMap(o => (o as any).checks?.flatMap((c: any) => c.payments || []) || [])
    for (const payment of allPayments) {
      const method = normalizeMethod(payment.type)
      if (!paymentMethods[method]) {
        paymentMethods[method] = { method, count: 0, revenue: 0, tax: 0, tips: 0 }
      }
      paymentMethods[method].count += 1
      paymentMethods[method].revenue += payment.amount
      paymentMethods[method].tips += (payment.tipAmount || 0)
      // DDV se porazdeli proporcionalno — za preprostost uporabimo razmerje zneska plačila / total naročila
      // Natančnejša porazdelitev bi zahtevala orderItem → check povezavo
    }
    // Dodaj DDV porazdelitev proporcionalno po plačilih
    if (totalRevenue > 0) {
      const totalPaymentsAmount = allPayments.reduce((s, p) => s + p.amount, 0)
      for (const pm of Object.values(paymentMethods)) {
        pm.tax = Math.round((pm.revenue / totalPaymentsAmount) * totalTax * 100) / 100
      }
    }

    // === VRSTE NAROČIL ===
    const orderTypes: Record<string, { type: string; count: number; revenue: number; avgValue: number }> = {}
    paidOrders.forEach(order => {
      const type = order.type || 'dine-in'
      if (!orderTypes[type]) {
        orderTypes[type] = { type, count: 0, revenue: 0, avgValue: 0 }
      }
      orderTypes[type].count += 1
      orderTypes[type].revenue += order.total
    })
    Object.values(orderTypes).forEach(ot => {
      ot.avgValue = ot.count > 0 ? Math.round((ot.revenue / ot.count) * 100) / 100 : 0
    })

    // === PO KATEGORIJAH z DDV razčlenitvijo ===
    const categoryBreakdown: Record<string, { category: string; revenue: number; quantity: number; items: number; vat22: number; vat95: number; vat0: number }> = {}
    paidOrders.forEach(order => {
      order.orderItems.forEach(oi => {
        const cat = oi.menuItem?.category?.name || 'Ostalo'
        if (!categoryBreakdown[cat]) {
          categoryBreakdown[cat] = { category: cat, revenue: 0, quantity: 0, items: 0, vat22: 0, vat95: 0, vat0: 0 }
        }
        categoryBreakdown[cat].revenue += oi.price * oi.quantity
        categoryBreakdown[cat].quantity += oi.quantity
        categoryBreakdown[cat].items += 1
        // DDV po stopnjah znotraj kategorije
        if (oi.vatRate >= 20) categoryBreakdown[cat].vat22 += oi.price * oi.quantity
        else if (oi.vatRate > 0) categoryBreakdown[cat].vat95 += oi.price * oi.quantity
        else categoryBreakdown[cat].vat0 += oi.price * oi.quantity
      })
    })

    // === PO ARTIKLIH (ZA IZPISKE) ===
    const itemBreakdown: Record<string, { name: string; category: string; quantity: number; revenue: number; avgPrice: number; vatRate: number }> = {}
    paidOrders.forEach(order => {
      order.orderItems.forEach(oi => {
        if (!itemBreakdown[oi.menuItemId]) {
          itemBreakdown[oi.menuItemId] = {
            name: oi.menuItem?.name || 'Neznan',
            category: oi.menuItem?.category?.name || 'Ostalo',
            quantity: 0,
            revenue: 0,
            avgPrice: oi.price,
            vatRate: oi.vatRate,
          }
        }
        itemBreakdown[oi.menuItemId].quantity += oi.quantity
        itemBreakdown[oi.menuItemId].revenue += oi.price * oi.quantity
      })
    })
    Object.values(itemBreakdown).forEach(item => {
      if (item.quantity > 0) item.avgPrice = item.revenue / item.quantity
    })

    // === ČASOVNA RAZDELITEV (za grafikon) ===
    const timeDistribution: Record<string, { period: string; revenue: number; orders: number; prevRevenue: number; prevOrders: number }> = {}

    if (period === 'daily') {
      for (let h = 0; h < 24; h++) {
        timeDistribution[String(h).padStart(2, '0')] = {
          period: `${String(h).padStart(2, '0')}:00`,
          revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0,
        }
      }
      completedOrders.forEach(order => {
        const hour = new Date(order.paidAt || order.createdAt).getHours()
        const key = String(hour).padStart(2, '0')
        if (timeDistribution[key]) {
          timeDistribution[key].revenue += order.total
          timeDistribution[key].orders += 1
        }
      })
      // Prejšnje obdobje na časovno razdelitev
      prevCompletedOrders.forEach(order => {
        const hour = new Date(order.paidAt || order.createdAt).getHours()
        const key = String(hour).padStart(2, '0')
        if (timeDistribution[key]) {
          timeDistribution[key].prevRevenue += order.total
          timeDistribution[key].prevOrders += 1
        }
      })
    } else if (period === 'weekly') {
      const dayNames = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']
      dayNames.forEach(d => { timeDistribution[d] = { period: d, revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 } })
      completedOrders.forEach(order => {
        const dayIdx = (new Date(order.paidAt || order.createdAt).getDay() + 6) % 7
        const key = dayNames[dayIdx]
        if (timeDistribution[key]) {
          timeDistribution[key].revenue += order.total
          timeDistribution[key].orders += 1
        }
      })
      prevCompletedOrders.forEach(order => {
        const dayIdx = (new Date(order.paidAt || order.createdAt).getDay() + 6) % 7
        const key = dayNames[dayIdx]
        if (timeDistribution[key]) {
          timeDistribution[key].prevRevenue += order.total
          timeDistribution[key].prevOrders += 1
        }
      })
    } else if (period === 'monthly') {
      const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate()
      for (let d = 1; d <= daysInMonth; d++) {
        const key = String(d).padStart(2, '0')
        timeDistribution[key] = { period: String(d), revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 }
      }
      completedOrders.forEach(order => {
        const day = new Date(order.paidAt || order.createdAt).getDate()
        const key = String(day).padStart(2, '0')
        if (timeDistribution[key]) {
          timeDistribution[key].revenue += order.total
          timeDistribution[key].orders += 1
        }
      })
      prevCompletedOrders.forEach(order => {
        const day = new Date(order.paidAt || order.createdAt).getDate()
        const key = String(day).padStart(2, '0')
        if (timeDistribution[key]) {
          timeDistribution[key].prevRevenue += order.total
          timeDistribution[key].prevOrders += 1
        }
      })
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec']
      monthNames.forEach(m => { timeDistribution[m] = { period: m, revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 } })
      completedOrders.forEach(order => {
        const monthIdx = new Date(order.paidAt || order.createdAt).getMonth()
        const key = monthNames[monthIdx]
        if (timeDistribution[key]) {
          timeDistribution[key].revenue += order.total
          timeDistribution[key].orders += 1
        }
      })
      prevCompletedOrders.forEach(order => {
        const monthIdx = new Date(order.paidAt || order.createdAt).getMonth()
        const key = monthNames[monthIdx]
        if (timeDistribution[key]) {
          timeDistribution[key].prevRevenue += order.total
          timeDistribution[key].prevOrders += 1
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

    // === NAPITNINE z razčlenitvijo ===
    // FIX CRITICAL: Uporabi ACTUAL payments iz checkov za napitnine
    const totalTips = allPayments.reduce((sum, p) => sum + (p.tipAmount || 0), 0)
    const avgTipPerOrder = paidOrders.length > 0 ? totalTips / paidOrders.length : 0
    const tipPercentage = totalRevenue > 0 ? (totalTips / totalRevenue) * 100 : 0

    // Napitnine po zaposlenih
    const tipsByEmployee: Record<string, { employeeId: string; employeeName: string; tips: number; orderCount: number; avgTip: number }> = {}
    paidOrders.forEach(order => {
      const empId = order.employeeId || 'unknown'
      if (!tipsByEmployee[empId]) {
        tipsByEmployee[empId] = { employeeId: empId, employeeName: '', tips: 0, orderCount: 0, avgTip: 0 }
      }
      // FIX CRITICAL: Uporabi tips iz actual payments (checkov) namesto order.tip
      const orderTips = ((order as any).checks || []).flatMap((c: any) => (c.payments || [])).reduce((sum: number, p: any) => sum + (p.tipAmount || 0), 0)
      tipsByEmployee[empId].tips += orderTips
      tipsByEmployee[empId].orderCount += 1
    })
    // Pridobi imena zaposlenih
    const empIds = Object.keys(tipsByEmployee).filter(id => id !== 'unknown')
    if (empIds.length > 0) {
      const employees = await db.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, name: true } })
      employees.forEach(emp => {
        if (tipsByEmployee[emp.id]) tipsByEmployee[emp.id].employeeName = emp.name
      })
    }
    if (tipsByEmployee['unknown']) tipsByEmployee['unknown'].employeeName = 'Nedoločen'
    Object.values(tipsByEmployee).forEach(t => {
      t.avgTip = t.orderCount > 0 ? Math.round((t.tips / t.orderCount) * 100) / 100 : 0
      t.tips = Math.round(t.tips * 100) / 100
    })

    // === PRIHODEK PO MIZAH ===
    const tableRevenue: Record<string, { tableNumber: number; area: string; revenue: number; orderCount: number; avgOrder: number; tips: number; guests: number }> = {}
    paidOrders.forEach(order => {
      if (order.type === 'dine-in' && order.tableId) {
        const tableId = order.tableId
        if (!tableRevenue[tableId]) {
          tableRevenue[tableId] = {
            tableNumber: order.table?.number || 0,
            area: order.table?.area || 'main',
            revenue: 0,
            orderCount: 0,
            avgOrder: 0,
            tips: 0,
            guests: 0,
          }
        }
        tableRevenue[tableId].revenue += order.total
        tableRevenue[tableId].orderCount += 1
        tableRevenue[tableId].tips += (order.tip || 0)
      }
    })
    Object.values(tableRevenue).forEach(t => {
      t.avgOrder = t.orderCount > 0 ? Math.round((t.revenue / t.orderCount) * 100) / 100 : 0
      t.revenue = Math.round(t.revenue * 100) / 100
      t.tips = Math.round(t.tips * 100) / 100
    })

    // === URNA TOPLOTNA KARTA (dopoldne/popoldan/večer razdelitev) ===
    const hourlyHeatmap: Array<{ hour: number; label: string; revenue: number; orders: number; intensity: number }> = []
    let maxHourlyRevenue = 0
    const hourlyBuckets: Record<number, { revenue: number; orders: number }> = {}
    for (let h = 0; h < 24; h++) {
      hourlyBuckets[h] = { revenue: 0, orders: 0 }
    }
    completedOrders.forEach(order => {
      const hour = new Date(order.paidAt || order.createdAt).getHours()
      hourlyBuckets[hour].revenue += order.total
      hourlyBuckets[hour].orders += 1
      if (hourlyBuckets[hour].revenue > maxHourlyRevenue) maxHourlyRevenue = hourlyBuckets[hour].revenue
    })
    for (let h = 0; h < 24; h++) {
      const label = h < 6 ? 'Noč' : h < 10 ? 'Jutro' : h < 14 ? 'Kosilo' : h < 17 ? 'Popoldne' : h < 21 ? 'Večerja' : 'Po večerji'
      hourlyHeatmap.push({
        hour: h,
        label,
        revenue: Math.round(hourlyBuckets[h].revenue * 100) / 100,
        orders: hourlyBuckets[h].orders,
        intensity: maxHourlyRevenue > 0 ? Math.round((hourlyBuckets[h].revenue / maxHourlyRevenue) * 100) : 0,
      })
    }

    // === DDV RAZČLENITEV (podrobna) ===
    const vatBreakdown: Record<string, { rate: number; label: string; code: string; baseAmount: number; vatAmount: number; totalAmount: number }> = {}
    paidOrders.forEach(order => {
      order.orderItems.forEach(oi => {
        const rateKey = String(oi.vatRate)
        if (!vatBreakdown[rateKey]) {
          vatBreakdown[rateKey] = {
            rate: oi.vatRate,
            label: oi.vatRate >= 20 ? 'DDV 22% (Standardna)' : oi.vatRate > 0 ? 'DDV 9.5% (Znižana)' : 'DDV 0% (Oproščeno)',
            code: oi.vatRate >= 20 ? 'S' : oi.vatRate > 0 ? 'R' : 'Z',
            baseAmount: 0,
            vatAmount: 0,
            totalAmount: 0,
          }
        }
        const base = oi.price * oi.quantity
        const vat = oi.vatAmount || 0
        vatBreakdown[rateKey].baseAmount += base
        vatBreakdown[rateKey].vatAmount += vat
        vatBreakdown[rateKey].totalAmount += base + vat
      })
    })
    Object.values(vatBreakdown).forEach(vr => {
      vr.baseAmount = Math.round(vr.baseAmount * 100) / 100
      vr.vatAmount = Math.round(vr.vatAmount * 100) / 100
      vr.totalAmount = Math.round(vr.totalAmount * 100) / 100
    })

    // === BLAGAJNA IZPISKI ===
    const cashRegisterShifts = await db.cashRegisterShift.findMany({
      where: { openedAt: { gte: startDate, lte: endDate } },
    })
    const totalCashSales = cashRegisterShifts.reduce((sum, s) => sum + s.cashSales, 0)
    const totalCardSales = cashRegisterShifts.reduce((sum, s) => sum + s.cardSales, 0)
    const totalMobileSales = cashRegisterShifts.reduce((sum, s) => sum + s.mobileSales, 0)

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

    // === PRIMERJAVA OBDOBIJ (podrobna) ===
    const periodComparison = {
      current: {
        revenue: Math.round(totalRevenue * 100) / 100,
        subtotal: Math.round(totalSubtotal * 100) / 100,
        tax: Math.round(totalTax * 100) / 100,
        discount: Math.round(totalDiscount * 100) / 100,
        tips: Math.round(totalTips * 100) / 100,
        orders: completedCount,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      },
      previous: {
        revenue: Math.round(prevRevenue * 100) / 100,
        subtotal: Math.round(prevSubtotal * 100) / 100,
        tax: Math.round(prevTax * 100) / 100,
        discount: Math.round(prevDiscount * 100) / 100,
        tips: Math.round(prevTips * 100) / 100,
        orders: prevCount,
        avgOrderValue: Math.round(prevAvgOrderValue * 100) / 100,
      },
      changes: {
        revenue: Math.round(revenueChange * 100) / 100,
        orders: Math.round(orderChange * 100) / 100,
        avgOrderValue: prevAvgOrderValue > 0 ? Math.round((((avgOrderValue - prevAvgOrderValue) / prevAvgOrderValue) * 100) * 100) / 100 : 0,
        tips: prevTips > 0 ? Math.round((((totalTips - prevTips) / prevTips) * 100) * 100) / 100 : 0,
      },
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
        prevRevenue: Math.round(prevRevenue * 100) / 100,
        revenueChange: Math.round(revenueChange * 100) / 100,
        orderChange: Math.round(orderChange * 100) / 100,
      },
      // Plačilne metode
      paymentMethods: Object.values(paymentMethods),
      // Vrste naročil
      orderTypes: Object.values(orderTypes),
      // Kategorije z DDV
      categoryBreakdown: Object.values(categoryBreakdown).sort((a, b) => b.revenue - a.revenue),
      // Artikli z DDV
      itemBreakdown: Object.values(itemBreakdown).sort((a, b) => b.revenue - a.revenue),
      // Časovna porazdelitev s primerjavo
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
      totalTips: Math.round(totalTips * 100) / 100,
      avgTipPerOrder: Math.round(avgTipPerOrder * 100) / 100,
      tipPercentage: Math.round(tipPercentage * 100) / 100,
      tipsByEmployee: Object.values(tipsByEmployee).sort((a, b) => b.tips - a.tips),
      // Prihodek po mizah
      tableRevenue: Object.values(tableRevenue).sort((a, b) => b.revenue - a.revenue),
      // Urna toplotna karta
      hourlyHeatmap,
      // DDV razčlenitev
      vatBreakdown: Object.values(vatBreakdown).sort((a, b) => b.rate - a.rate),
      // Blagajna
      cashRegister: {
        totalCashSales: Math.round(effectiveCashSales * 100) / 100,
        totalCardSales: Math.round(effectiveCardSales * 100) / 100,
        totalMobileSales: Math.round(effectiveMobileSales * 100) / 100,
        shiftCount: cashRegisterShifts.length,
      },
      // Knjižbeni izpisek
      bookingEntry,
      // Primerjava obdobij
      periodComparison,
    })
  } catch (error) {
    console.error('Financial report error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju poročila' }, { status: 500 })
  }
}
