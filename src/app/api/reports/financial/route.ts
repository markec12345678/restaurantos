// GET /api/reports/financial — Celovito poslovno poročanje z izpiski za knjiženje
// Parametri: period=daily|weekly|monthly|yearly, date=YYYY-MM-DD (referenčni datum)
import { db } from '@/lib/db'
import { toNum, round2, abs } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateReportDateRange } from '@/lib/validations'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-utils'
export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('reports-financial', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })
    // FIX CRITICAL: Zahtevaj avtentikacijo za dostop do finančnih podatkov
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'daily'
    const refDateStr = searchParams.get('date') || new Date().toISOString().split('T')[0]
    // FIX HIGH: Validiraj datumski format in omeji obdobje
    const dateError = validateReportDateRange(refDateStr, refDateStr)
    if (dateError) return dateError
    // FIX HIGH: Validiraj period parameter
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
      return NextResponse.json({ error: 'Neveljavno obdobje. Dovoljeno: daily, weekly, monthly, yearly' }, { status: 400 })
    }
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

    // === POIZVEDBE (vzporedno s Promise.all za optimalno hitrost) ===
    // FIX CRITICAL: Za finančna poročila uporabimo paidAt (datum plačila) namesto createdAt.
    // Naročilo, ustvarjeno včeraj a plačano danes, sodi v današnji dan.
    const [
      currentStatusGroups,
      currentFinancialAgg,
      currentPaidOrders,
      completedOrdersLight,
      prevFinancialAgg,
      prevPaidOrdersLight,
      orderItems,
      stockCostGroups,
      cashRegisterAgg,
      orderTypeGroups,
    ] = await Promise.all([
      // 1. Status counts za trenutno obdobje — groupBy namesto JS .filter()
      db.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: startDate, lte: endDate } },
        _count: true,
      }),
      // 2. Finančni agregati za trenutno obdobje — aggregate namesto findMany + reduce
      db.order.aggregate({
        where: { paidAt: { gte: startDate, lte: endDate }, paymentStatus: 'paid' },
        _sum: { total: true, subtotal: true, tax: true, discount: true, tip: true },
        _count: true,
      }),
      // 3. Plačana naročila za podrobnosti (plačilne metode, napitnine, mize) — s select za manjši payload
      // FIX CRITICAL: Za finančne podatke uporabimo paidAt — naročila plačana v tem obdobju
      db.order.findMany({
        where: {
          paidAt: { gte: startDate, lte: endDate },
          paymentStatus: 'paid',
        },
        select: {
          type: true,
          tableId: true,
          employeeId: true,
          total: true,
          tip: true,
          table: { select: { number: true, area: true } },
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
      }),
      // 4. Zaključena naročila za časovno razdelitev — lahka poizvedba s select
      // Trenutno obdobje - status poročilo uporablja createdAt
      db.order.findMany({
        where: { createdAt: { gte: startDate, lte: endDate }, status: 'completed' },
        select: { paidAt: true, createdAt: true, total: true },
      }),
      // 5. Finančni agregati za prejšnje obdobje — aggregate namesto findMany + reduce
      // FIX CRITICAL: Prejšnje obdobje za finančno primerjavo — uporabi paidAt
      db.order.aggregate({
        where: { paidAt: { gte: prevStartDate, lte: prevEndDate }, paymentStatus: 'paid' },
        _sum: { total: true, subtotal: true, tax: true, discount: true, tip: true },
        _count: true,
      }),
      // 6. Plačana naročila za prejšnje obdobje časovno razdelitev — lahka poizvedba
      db.order.findMany({
        where: { paidAt: { gte: prevStartDate, lte: prevEndDate }, paymentStatus: 'paid' },
        select: { paidAt: true, createdAt: true, total: true },
      }),
      // 7. Artikli naročil za kategorije/DDV razčlenitev — flat findMany namesto gnezdjenega include
      // Filter po relaciji order (paidAt + paymentStatus) za pravilne rezultate
      db.orderItem.findMany({
        where: {
          order: { paidAt: { gte: startDate, lte: endDate }, paymentStatus: 'paid' },
          voided: false,
        },
        select: {
          menuItemId: true,
          price: true,
          quantity: true,
          vatRate: true,
          vatAmount: true,
          menuItem: { select: { name: true, category: { select: { name: true } } } },
        },
      }),
      // 8. Stroški zaloga po tipu — groupBy namesto JS .filter()
      db.stockTransaction.groupBy({
        by: ['type'],
        where: { createdAt: { gte: startDate, lte: endDate } },
        _sum: { totalCost: true },
      }),
      // 9. Blagajna izpiski — aggregate namesto findMany + reduce
      db.cashRegisterShift.aggregate({
        where: { openedAt: { gte: startDate, lte: endDate } },
        _sum: { cashSales: true, cardSales: true, mobileSales: true },
        _count: true,
      }),
      // 10. Vrste naročil — groupBy namesto JS forEach
      db.order.groupBy({
        by: ['type'],
        where: { paidAt: { gte: startDate, lte: endDate }, paymentStatus: 'paid' },
        _sum: { total: true },
        _count: true,
      }),
    ])

    // === OSNOVNI KAZALCI ===
    // Status counts iz groupBy — namesto JS .filter()
    const totalOrdersCount = currentStatusGroups.reduce((sum, g) => sum + g._count, 0)
    const cancelledCount = currentStatusGroups.find(g => g.status === 'cancelled')?._count ?? 0
    // FIX: Decimal→number za vsa reduce in += operacije — prepreči string concatenation
    // Finančni agregati iz aggregate — namesto findMany + reduce
    const totalRevenue = toNum(currentFinancialAgg._sum.total)
    const totalSubtotal = toNum(currentFinancialAgg._sum.subtotal)
    const totalTax = toNum(currentFinancialAgg._sum.tax)
    const totalDiscount = toNum(currentFinancialAgg._sum.discount)
    const completedCount = currentFinancialAgg._count
    const avgOrderValue = completedCount > 0 ? totalRevenue / completedCount : 0

    // Prejšnje obdobje primerjava — iz aggregate namesto findMany + reduce
    const prevRevenue = toNum(prevFinancialAgg._sum.total)
    const prevSubtotal = toNum(prevFinancialAgg._sum.subtotal)
    const prevTax = toNum(prevFinancialAgg._sum.tax)
    const prevDiscount = toNum(prevFinancialAgg._sum.discount)
    const prevCount = prevFinancialAgg._count
    const prevAvgOrderValue = prevCount > 0 ? prevRevenue / prevCount : 0
    const prevTips = toNum(prevFinancialAgg._sum.tip) // FIX: Decimal truthy — toNum() instead of || 0
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
    const allPayments = currentPaidOrders.flatMap(o => o.checks?.flatMap(c => c.payments || []) || [])
    for (const payment of allPayments) {
      const method = normalizeMethod(payment.type)
      if (!paymentMethods[method]) {
        paymentMethods[method] = { method, count: 0, revenue: 0, tax: 0, tips: 0 }
      }
      paymentMethods[method].count += 1
      paymentMethods[method].revenue += toNum(payment.amount) // FIX: Decimal→number
      paymentMethods[method].tips += toNum(payment.tipAmount) // FIX: Decimal truthy — toNum() instead of || 0
      // DDV se porazdeli proporcionalno — za preprostost uporabimo razmerje zneska plačila / total naročila
      // Natančnejša porazdelitev bi zahtevala orderItem → check povezavo
    }
    // Dodaj DDV porazdelitev proporcionalno po plačilih
    if (totalRevenue > 0) {
      const totalPaymentsAmount = allPayments.reduce((s, p) => s + toNum(p.amount), 0) // FIX: Decimal→number
      for (const pm of Object.values(paymentMethods)) {
        pm.tax = round2((pm.revenue / totalPaymentsAmount) * totalTax)
      }
    }

    // === VRSTE NAROČIL (iz groupBy) ===
    const orderTypes = orderTypeGroups.map(g => ({
      type: g.type || 'dine-in',
      count: g._count,
      revenue: toNum(g._sum.total),
      avgValue: g._count > 0 ? round2(toNum(g._sum.total) / g._count) : 0,
    }))

    // === PO KATEGORIJAH z DDV razčlenitvijo (iz flat orderItems namesto gnezdjenega forEach) ===
    const categoryBreakdown: Record<string, { category: string; revenue: number; quantity: number; items: number; vat22: number; vat95: number; vat0: number }> = {}
    for (const oi of orderItems) {
      const cat = oi.menuItem?.category?.name || 'Ostalo'
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = { category: cat, revenue: 0, quantity: 0, items: 0, vat22: 0, vat95: 0, vat0: 0 }
      }
      categoryBreakdown[cat].revenue += toNum(oi.price) * oi.quantity // FIX: Decimal→number
      categoryBreakdown[cat].quantity += oi.quantity
      categoryBreakdown[cat].items += 1
      // DDV po stopnjah znotraj kategorije
      // FIX: toNum() za Decimal primerjave — prepreči leksikografsko primerjavo
      if (toNum(oi.vatRate) >= 20) categoryBreakdown[cat].vat22 += toNum(oi.price) * oi.quantity
      else if (toNum(oi.vatRate) > 0) categoryBreakdown[cat].vat95 += toNum(oi.price) * oi.quantity
      else categoryBreakdown[cat].vat0 += toNum(oi.price) * oi.quantity
    }

    // === PO ARTIKLIH (ZA IZPISKE) ===
    const itemBreakdown: Record<string, { name: string; category: string; quantity: number; revenue: number; avgPrice: number; vatRate: number }> = {}
    for (const oi of orderItems) {
      if (!itemBreakdown[oi.menuItemId]) {
        itemBreakdown[oi.menuItemId] = {
          name: oi.menuItem?.name || 'Neznan',
          category: oi.menuItem?.category?.name || 'Ostalo',
          quantity: 0,
          revenue: 0,
          avgPrice: toNum(oi.price), // FIX: Decimal→number
          vatRate: toNum(oi.vatRate), // FIX: Decimal→number
        }
      }
      itemBreakdown[oi.menuItemId].quantity += oi.quantity
      itemBreakdown[oi.menuItemId].revenue += toNum(oi.price) * oi.quantity // FIX: Decimal→number
    }
    for (const item of Object.values(itemBreakdown)) {
      if (item.quantity > 0) item.avgPrice = item.revenue / item.quantity
    }

    // === ČASOVNA RAZDELITEV (za grafikon) ===
    const timeDistribution: Record<string, { period: string; revenue: number; orders: number; prevRevenue: number; prevOrders: number }> = {}
    if (period === 'daily') {
      for (let h = 0; h < 24; h++) {
        timeDistribution[String(h).padStart(2, '0')] = {
          period: `${String(h).padStart(2, '0')}:00`,
          revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0,
        }
      }
      completedOrdersLight.forEach(order => {
        const hour = new Date(order.paidAt || order.createdAt).getHours()
        const key = String(hour).padStart(2, '0')
        if (timeDistribution[key]) {
          timeDistribution[key].revenue += toNum(order.total) // FIX: Decimal→number
          timeDistribution[key].orders += 1
        }
      })
      // Prejšnje obdobje na časovno razdelitev
      prevPaidOrdersLight.forEach(order => {
        const hour = new Date(order.paidAt || order.createdAt).getHours()
        const key = String(hour).padStart(2, '0')
        if (timeDistribution[key]) {
          timeDistribution[key].prevRevenue += toNum(order.total) // FIX: Decimal→number
          timeDistribution[key].prevOrders += 1
        }
      })
    } else if (period === 'weekly') {
      const dayNames = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']
      dayNames.forEach(d => { timeDistribution[d] = { period: d, revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 } })
      completedOrdersLight.forEach(order => {
        const dayIdx = (new Date(order.paidAt || order.createdAt).getDay() + 6) % 7
        const key = dayNames[dayIdx]
        if (timeDistribution[key]) {
          timeDistribution[key].revenue += toNum(order.total) // FIX: Decimal→number
          timeDistribution[key].orders += 1
        }
      })
      prevPaidOrdersLight.forEach(order => {
        const dayIdx = (new Date(order.paidAt || order.createdAt).getDay() + 6) % 7
        const key = dayNames[dayIdx]
        if (timeDistribution[key]) {
          timeDistribution[key].prevRevenue += toNum(order.total) // FIX: Decimal→number
          timeDistribution[key].prevOrders += 1
        }
      })
    } else if (period === 'monthly') {
      const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate()
      for (let d = 1; d <= daysInMonth; d++) {
        const key = String(d).padStart(2, '0')
        timeDistribution[key] = { period: String(d), revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 }
      }
      completedOrdersLight.forEach(order => {
        const day = new Date(order.paidAt || order.createdAt).getDate()
        const key = String(day).padStart(2, '0')
        if (timeDistribution[key]) {
          timeDistribution[key].revenue += toNum(order.total) // FIX: Decimal→number
          timeDistribution[key].orders += 1
        }
      })
      prevPaidOrdersLight.forEach(order => {
        const day = new Date(order.paidAt || order.createdAt).getDate()
        const key = String(day).padStart(2, '0')
        if (timeDistribution[key]) {
          timeDistribution[key].prevRevenue += toNum(order.total) // FIX: Decimal→number
          timeDistribution[key].prevOrders += 1
        }
      })
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec']
      monthNames.forEach(m => { timeDistribution[m] = { period: m, revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 } })
      completedOrdersLight.forEach(order => {
        const monthIdx = new Date(order.paidAt || order.createdAt).getMonth()
        const key = monthNames[monthIdx]
        if (timeDistribution[key]) {
          timeDistribution[key].revenue += toNum(order.total) // FIX: Decimal→number
          timeDistribution[key].orders += 1
        }
      })
      prevPaidOrdersLight.forEach(order => {
        const monthIdx = new Date(order.paidAt || order.createdAt).getMonth()
        const key = monthNames[monthIdx]
        if (timeDistribution[key]) {
          timeDistribution[key].prevRevenue += toNum(order.total) // FIX: Decimal→number
          timeDistribution[key].prevOrders += 1
        }
      })
    }

    // === STROŠKI ZALOG (iz groupBy namesto JS .filter()) ===
    const stockCostByType = new Map(stockCostGroups.map(g => [g.type, g._sum.totalCost]))
    const procurementCost = toNum(stockCostByType.get('procurement') ?? 0)
    const writeOffCost = toNum(abs(stockCostByType.get('write-off') ?? 0)) + toNum(abs(stockCostByType.get('return') ?? 0))
    const cogs = toNum(abs(stockCostByType.get('sale') ?? 0))
    const grossProfit = totalRevenue - cogs
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

    // === NAPITNINE z razčlenitvami ===
    // FIX CRITICAL: Uporabi ACTUAL payments iz checkov za napitnine
    const totalTips = allPayments.reduce((sum, p) => sum + toNum(p.tipAmount), 0) // FIX: Decimal truthy — toNum() instead of || 0
    const avgTipPerOrder = currentPaidOrders.length > 0 ? totalTips / currentPaidOrders.length : 0
    const tipPercentage = totalRevenue > 0 ? (totalTips / totalRevenue) * 100 : 0

    // Napitnine po zaposlenih
    const tipsByEmployee: Record<string, { employeeId: string; employeeName: string; tips: number; orderCount: number; avgTip: number }> = {}
    currentPaidOrders.forEach(order => {
      const empId = order.employeeId || 'unknown'
      if (!tipsByEmployee[empId]) {
        tipsByEmployee[empId] = { employeeId: empId, employeeName: '', tips: 0, orderCount: 0, avgTip: 0 }
      }
      // FIX CRITICAL: Uporabi tips iz actual payments (checkov) namesto order.tip
      const orderTips = (order.checks || []).flatMap(c => (c.payments || [])).reduce((sum, p) => sum + toNum(p.tipAmount), 0)
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
    for (const t of Object.values(tipsByEmployee)) {
      t.avgTip = t.orderCount > 0 ? round2(t.tips / t.orderCount) : 0
      t.tips = round2(t.tips)
    }

    // === PRIHODEK PO MIZAH ===
    const tableRevenue: Record<string, { tableNumber: number; area: string; revenue: number; orderCount: number; avgOrder: number; tips: number; guests: number }> = {}
    currentPaidOrders.forEach(order => {
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
        tableRevenue[tableId].revenue += toNum(order.total) // FIX: Decimal→number
        tableRevenue[tableId].orderCount += 1
        tableRevenue[tableId].tips += toNum(order.tip) // FIX: Decimal truthy — toNum() instead of || 0
      }
    })
    for (const t of Object.values(tableRevenue)) {
      t.avgOrder = t.orderCount > 0 ? round2(t.revenue / t.orderCount) : 0
      t.revenue = round2(t.revenue)
      t.tips = round2(t.tips)
    }

    // === URNA TOPLOTNA KARTA (dopoldne/popoldan/večer razdelitev) ===
    const hourlyHeatmap: Array<{ hour: number; label: string; revenue: number; orders: number; intensity: number }> = []
    let maxHourlyRevenue = 0
    const hourlyBuckets: Record<number, { revenue: number; orders: number }> = {}
    for (let h = 0; h < 24; h++) {
      hourlyBuckets[h] = { revenue: 0, orders: 0 }
    }
    completedOrdersLight.forEach(order => {
      const hour = new Date(order.paidAt || order.createdAt).getHours()
      hourlyBuckets[hour].revenue += toNum(order.total) // FIX: Decimal→number
      hourlyBuckets[hour].orders += 1
      if (hourlyBuckets[hour].revenue > maxHourlyRevenue) maxHourlyRevenue = hourlyBuckets[hour].revenue
    })
    for (let h = 0; h < 24; h++) {
      const label = h < 6 ? 'Noč' : h < 10 ? 'Jutro' : h < 14 ? 'Kosilo' : h < 17 ? 'Popoldne' : h < 21 ? 'Večerja' : 'Po večerji'
      hourlyHeatmap.push({
        hour: h,
        label,
        revenue: round2(hourlyBuckets[h].revenue),
        orders: hourlyBuckets[h].orders,
        intensity: maxHourlyRevenue > 0 ? Math.round((hourlyBuckets[h].revenue / maxHourlyRevenue) * 100) : 0,
      })
    }

    // === DDV RAZČLENITEV (podrobna — iz flat orderItems namesto gnezdjenega forEach) ===
    const vatBreakdown: Record<string, { rate: number; label: string; code: string; baseAmount: number; vatAmount: number; totalAmount: number }> = {}
    for (const oi of orderItems) {
      const rateKey = String(oi.vatRate)
      if (!vatBreakdown[rateKey]) {
        vatBreakdown[rateKey] = {
          rate: toNum(oi.vatRate), // FIX: Decimal→number
          label: toNum(oi.vatRate) >= 20 ? 'DDV 22% (Standardna)' : toNum(oi.vatRate) > 0 ? 'DDV 9.5% (Znižana)' : 'DDV 0% (Oproščeno)', // FIX: Decimal primerjava
          code: toNum(oi.vatRate) >= 20 ? 'S' : toNum(oi.vatRate) > 0 ? 'R' : 'Z', // FIX: Decimal primerjava
          baseAmount: 0,
          vatAmount: 0,
          totalAmount: 0,
        }
      }
      const base = toNum(oi.price) * oi.quantity // FIX: Decimal→number
      const vat = toNum(oi.vatAmount) // FIX: Decimal truthy — toNum() instead of || 0
      vatBreakdown[rateKey].baseAmount += base
      vatBreakdown[rateKey].vatAmount += vat
      vatBreakdown[rateKey].totalAmount += base + vat
    }
    for (const vr of Object.values(vatBreakdown)) {
      vr.baseAmount = round2(vr.baseAmount)
      vr.vatAmount = round2(vr.vatAmount)
      vr.totalAmount = round2(vr.totalAmount)
    }

    // === BLAGAJNA IZPISKI (iz aggregate) ===
    const totalCashSales = toNum(cashRegisterAgg._sum.cashSales)
    const totalCardSales = toNum(cashRegisterAgg._sum.cardSales)
    const totalMobileSales = toNum(cashRegisterAgg._sum.mobileSales)
    const effectiveCashSales = totalCashSales > 0 ? totalCashSales : toNum(paymentMethods['gotovina']?.revenue || 0) // FIX: totalCashSales is now number
    const effectiveCardSales = totalCardSales > 0 ? totalCardSales : toNum(paymentMethods['kartica']?.revenue || 0)
    const effectiveMobileSales = totalMobileSales > 0 ? totalMobileSales : toNum(paymentMethods['mobilno']?.revenue || 0)

    // === SESTAVEK IZPISKA ZA KNJIŽENJE ===
    const bookingEntry = {
      date: periodLabel,
      period,
      debit: {
        '1140 - Potrošniki - Gotovina': round2(effectiveCashSales),
        '1140 - Potrošniki - Kartice': round2(effectiveCardSales),
        '1140 - Potrošniki - Mobilno': round2(effectiveMobileSales),
      },
      credit: {
        '7600 - Prihodki od prodaje jedi in pijač': round2(totalSubtotal),
        '2530 - DDV obveznosti': round2(totalTax),
      },
      totalDebit: round2(effectiveCashSales + effectiveCardSales + effectiveMobileSales),
      totalCredit: round2(totalSubtotal + totalTax),
    }

    // === PRIMERJAVA OBDOBIJ (podrobna) ===
    const periodComparison = {
      current: {
        revenue: round2(totalRevenue),
        subtotal: round2(totalSubtotal),
        tax: round2(totalTax),
        discount: round2(totalDiscount),
        tips: round2(totalTips),
        orders: completedCount,
        avgOrderValue: round2(avgOrderValue),
      },
      previous: {
        revenue: round2(prevRevenue),
        subtotal: round2(prevSubtotal),
        tax: round2(prevTax),
        discount: round2(prevDiscount),
        tips: round2(prevTips),
        orders: prevCount,
        avgOrderValue: round2(prevAvgOrderValue),
      },
      changes: {
        revenue: round2(revenueChange),
        orders: round2(orderChange),
        avgOrderValue: prevAvgOrderValue > 0 ? round2(((avgOrderValue - prevAvgOrderValue) / prevAvgOrderValue) * 100) : 0,
        tips: prevTips > 0 ? round2(((totalTips - prevTips) / prevTips) * 100) : 0,
      },
    }

    return NextResponse.json({
      period,
      periodLabel,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      // Osnovni kazalci
      summary: {
        totalRevenue: round2(totalRevenue),
        totalSubtotal: round2(totalSubtotal),
        totalTax: round2(totalTax),
        totalDiscount: round2(totalDiscount),
        totalOrdersCount,
        completedCount,
        cancelledCount,
        avgOrderValue: round2(avgOrderValue),
        prevRevenue: round2(prevRevenue),
        revenueChange: round2(revenueChange),
        orderChange: round2(orderChange),
      },
      // Plačilne metode
      paymentMethods: Object.values(paymentMethods),
      // Vrste naročil
      orderTypes,
      // Kategorije z DDV
      categoryBreakdown: Object.values(categoryBreakdown).sort((a, b) => b.revenue - a.revenue),
      // Artikli z DDV
      itemBreakdown: Object.values(itemBreakdown).sort((a, b) => b.revenue - a.revenue),
      // Časovna porazdelitev s primerjavo
      timeDistribution: Object.values(timeDistribution),
      // Stroški in dobiček
      costs: {
        procurementCost: round2(procurementCost),
        cogs: round2(cogs),
        writeOffCost: round2(writeOffCost),
        grossProfit: round2(grossProfit),
        grossMargin: round2(grossMargin),
      },
      // Napitnine
      totalTips: round2(totalTips),
      avgTipPerOrder: round2(avgTipPerOrder),
      tipPercentage: round2(tipPercentage),
      tipsByEmployee: Object.values(tipsByEmployee).sort((a, b) => b.tips - a.tips),
      // Prihodek po mizah
      tableRevenue: Object.values(tableRevenue).sort((a, b) => b.revenue - a.revenue),
      // Urna toplotna karta
      hourlyHeatmap,
      // DDV razčlenitev
      vatBreakdown: Object.values(vatBreakdown).sort((a, b) => b.rate - a.rate),
      // Blagajna
      cashRegister: {
        totalCashSales: round2(effectiveCashSales),
        totalCardSales: round2(effectiveCardSales),
        totalMobileSales: round2(effectiveMobileSales),
        shiftCount: cashRegisterAgg._count,
      },
      // Knjižbeni izpisek
      bookingEntry,
      // Primerjava obdobij
      periodComparison,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/financial', 'Napaka pri pridobivanju poročila')
  }
}
