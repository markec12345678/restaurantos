
// ============================================
// END-OF-DAY (ZOD - Zaključek obratovalnega dneva)
// GET: Pridobi podatke za zaključek dneva
// POST: Zaključi obratovalni dan (zapri blagajno, generiraj izpiske)
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { toNum, round2, abs, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { eodCloseSchema, validateReportDateRange } from '@/lib/validations'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('reports-eod', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // FIX HIGH: Validiraj datumski format
    const dateError = validateReportDateRange(date, date)
    if (dateError) return dateError

    const dayStart = new Date(date + 'T00:00:00.000Z')
    const dayEnd = new Date(date + 'T23:59:59.999Z')

    // FIX EOD-1 HIGH: Dodaj locationId filter — brez tega se prikažejo naročila iz VSEH lokacij
    const locationId = searchParams.get('locationId')

    // Skupni where pogoji
    // FIX HIGH: Uporabi PAIDAT za finančna poročila — naročilo, ustvarjeno včeraj
    // a plačano danes, sodi v danesnji dan. Za statusna poročila uporabimo createdAt.
    const paidOrderWhere = {
      paidAt: { gte: dayStart, lte: dayEnd },
      paymentStatus: 'paid' as const,
      ...(locationId ? { locationId } : {}),
    }
    const statusOrderWhere = {
      createdAt: { gte: dayStart, lte: dayEnd },
    }

    // BLAGAJNA — where pogoj pred Promise.all
    // FIX EOD-1 HIGH: Dodaj locationId filter za blagajno
    const shiftWhere: Record<string, unknown> = { status: 'open' }
    if (locationId) shiftWhere.locationId = locationId

    // ─── VSE NEODVISNE POIZVEDBE VZPOREDNO ───
    const [
      statusCounts,
      revenueAgg,
      cancelledAgg,
      pendingCount,
      vatGroups,
      paymentGroups,
      categoryItemGroups,
      employeeGroups,
      hourlyOrders,
      stockCostGroups,
      activeShift,
      voidedItemsData,
    ] = await Promise.all([
      // 1. Status counts — groupBy po statusu
      db.order.groupBy({
        by: ['status'],
        where: statusOrderWhere,
        _count: true,
      }),

      // 2. Za finančne podatke uporabimo paidAt — naročila plačana ta dan
      db.order.aggregate({
        where: paidOrderWhere,
        _sum: { total: true, subtotal: true, tax: true, discount: true, tip: true, totalWithTip: true },
        _count: true,
      }),

      // 3. Preklicana naročila
      db.order.aggregate({
        where: { ...statusOrderWhere, status: 'cancelled' },
        _sum: { total: true },
        _count: true,
      }),

      // 4. Odprta naročila (pending, in-progress, ready)
      db.order.count({
        where: { ...statusOrderWhere, status: { in: ['pending', 'in-progress', 'ready'] } },
      }),

      // 5. DDV RAZČLENITEV — groupBy po vatRate
      db.orderItem.groupBy({
        by: ['vatRate'],
        where: { voided: false, order: paidOrderWhere },
        _sum: { vatAmount: true },
      }),

      // 6. PLAČILNE METODE — groupBy po type
      db.payment.groupBy({
        by: ['type'],
        where: { check: { order: paidOrderWhere } },
        _sum: { amount: true, tipAmount: true },
        _count: true,
      }),

      // 7. PO KATEGORIJAH — groupBy po menuItemId in price (sekundarna poizvedba za imena kategorij)
      db.orderItem.groupBy({
        by: ['menuItemId', 'price'],
        where: { voided: false, order: paidOrderWhere },
        _sum: { quantity: true },
      }),

      // 8. PO ZAPOSLENIH — groupBy po employeeId
      db.order.groupBy({
        by: ['employeeId'],
        where: paidOrderWhere,
        _sum: { total: true, tip: true },
        _count: true,
      }),

      // 9. PO URAH — samo potrebna polja za enopasovno obdelavo
      db.order.findMany({
        where: paidOrderWhere,
        select: { paidAt: true, createdAt: true, total: true },
      }),

      // 10. STROŠKI — groupBy po type
      db.stockTransaction.groupBy({
        by: ['type'],
        where: { createdAt: { gte: dayStart, lte: dayEnd } },
        _sum: { totalCost: true },
      }),

      // 11. BLAGAJNA
      db.cashRegisterShift.findFirst({
        where: shiftWhere,
        orderBy: { openedAt: 'desc' },
      }),

      // 12. VOIDANI ARTIKLI — select za zmanjšanje prenašanja podatkov
      db.orderItem.findMany({
        where: { voided: true, order: statusOrderWhere },
        select: {
          menuItem: { select: { name: true } },
          quantity: true,
          price: true,
        },
      }),
    ])

    // ─── OSNOVNE STATISTIKE ───
    const totalOrders = statusCounts.reduce((s, g) => s + g._count, 0)
    const completedOrders = revenueAgg._count
    const cancelledOrders = cancelledAgg._count
    const paidOrders = completedOrders

    // ─── PRIHODEK (na podlagi paidAt — plačana naročila) ───
    const totalRevenue = toNum(revenueAgg._sum.total)
    const totalSubtotal = toNum(revenueAgg._sum.subtotal)
    const totalTax = toNum(revenueAgg._sum.tax)
    const totalDiscount = toNum(revenueAgg._sum.discount)
    const totalTips = toNum(revenueAgg._sum.tip)
    const totalWithTips = toNum(revenueAgg._sum.totalWithTip)

    // ─── DDV RAZČLENITEV (na podlagi paidOrders) ───
    const vatBreakdown: Record<string, { base: number; vat: number; rate: number }> = {}
    for (const g of vatGroups) {
      const rate = toNum(g.vatRate)
      const vat = toNum(g._sum.vatAmount)
      // Base izpeljemo iz DDV: base = vat * 100 / rate (za rate > 0)
      const base = rate > 0 ? round2(vat * 100 / rate) : 0
      vatBreakdown[String(g.vatRate)] = { base, vat, rate }
    }

    // ─── PLAČILNE METODE (na podlagi paidOrders) ───
    const paymentMethods: Record<string, { count: number; revenue: number; tips: number }> = {}
    for (const g of paymentGroups) {
      paymentMethods[g.type] = {
        count: g._count,
        revenue: toNum(g._sum.amount),
        tips: toNum(g._sum.tipAmount),
      }
    }

    // ─── PO KATEGORIJAH (na podlagi paidOrders) ───
    // Sekundarna poizvedba za imena kategorij
    const menuItemIds = [...new Set(categoryItemGroups.map(g => g.menuItemId))]
    const menuItemsWithCategories = menuItemIds.length > 0
      ? await db.menuItem.findMany({
          where: { id: { in: menuItemIds } },
          select: {
            id: true,
            category: {
              select: {
                name: true,
                menu: { select: { name: true } },
              },
            },
          },
        })
      : []
    const menuItemMap = new Map(menuItemsWithCategories.map(m => [m.id, m]))

    const categoryBreakdown: Record<string, { category: string; quantity: number; revenue: number; menu: string }> = {}
    for (const g of categoryItemGroups) {
      const catInfo = menuItemMap.get(g.menuItemId)
      const cat = catInfo?.category?.name || 'Ostalo'
      const menu = catInfo?.category?.menu?.name || ''
      const key = `${menu}::${cat}`
      const revenue = toNum(g.price) * (g._sum.quantity || 0)
      if (!categoryBreakdown[key]) {
        categoryBreakdown[key] = { category: cat, quantity: 0, revenue: 0, menu }
      }
      categoryBreakdown[key].quantity += g._sum.quantity || 0
      categoryBreakdown[key].revenue += revenue
    }

    // ─── PO ZAPOSLENIH (na podlagi paidOrders) ───
    const employeeBreakdown: Record<string, { employeeId: string; orderCount: number; revenue: number; tips: number }> = {}
    const empIds: string[] = []
    for (const g of employeeGroups) {
      const empId = g.employeeId || 'unknown'
      employeeBreakdown[empId] = {
        employeeId: empId,
        orderCount: g._count,
        revenue: toNum(g._sum.total),
        tips: toNum(g._sum.tip),
      }
      if (empId !== 'unknown') empIds.push(empId)
    }
    // Sekundarna poizvedba za imena zaposlenih
    if (empIds.length > 0) {
      const employees = await db.employee.findMany({
        where: { id: { in: empIds } },
        select: { id: true, name: true },
      })
      for (const emp of employees) {
        if (employeeBreakdown[emp.id]) {
          (employeeBreakdown[emp.id] as Record<string, unknown>).employeeName = emp.name
        }
      }
    }

    // ─── PO URAH ───
    // FIX HIGH: Uporabi paidAt za finančno urno razdelitev (ne createdAt!)
    // Naročilo, ustvarjeno ob 23:30 a plačano ob 00:15, sodi v uro 00 za finančna poročila
    // Enopasovna obdelava namesto 24 iteracij
    const localOffset = new Date().getTimezoneOffset() // v minutah, negativno za CET
    const hourlyMap: Record<number, { revenue: number; orders: number }> = {}
    for (const o of hourlyOrders) {
      // Uporabi paidAt za finančno razdelitev, fallback na createdAt
      const refDate = o.paidAt || o.createdAt
      const localDate = new Date(refDate.getTime() - localOffset * 60000)
      const h = localDate.getUTCHours()
      if (!hourlyMap[h]) hourlyMap[h] = { revenue: 0, orders: 0 }
      hourlyMap[h].revenue += toNum(o.total)
      hourlyMap[h].orders += 1
    }
    const hourlyBreakdown = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      revenue: hourlyMap[h]?.revenue || 0,
      orders: hourlyMap[h]?.orders || 0,
    }))

    // ─── STROŠKI ───
    const stockCostByType: Record<string, number> = {}
    for (const g of stockCostGroups) {
      stockCostByType[g.type] = toNum(g._sum.totalCost)
    }
    const procurementCost = stockCostByType['procurement'] || 0
    const writeOffCost = toNum(abs(stockCostByType['write-off'] || 0))
    const cogs = toNum(abs(stockCostByType['sale'] || 0))
    const grossProfit = totalRevenue - cogs - writeOffCost
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

    // ─── VOIDANI ARTIKLI ───
    const voidedItems = voidedItemsData.map(i => ({
      name: i.menuItem.name,
      quantity: i.quantity,
      price: toNum(i.price),
    }))

    // FIX EOD-2 MEDIUM: cancelledRevenue uporabi abs — storno naročila imajo negativen total
    const cancelledRevenue = toNum(abs(cancelledAgg._sum.total))

    return NextResponse.json({
      date,
      summary: {
        totalOrders,
        completedOrders,
        cancelledOrders,
        pendingOrders: pendingCount,
        paidOrders,
        totalRevenue,
        totalSubtotal,
        totalTax,
        totalDiscount,
        totalTips,
        totalWithTips,
        avgOrderValue: completedOrders > 0 ? totalRevenue / completedOrders : 0,
        cancelledRevenue,
      },
      vatBreakdown: Object.values(vatBreakdown).sort((a: { rate: number }, b: { rate: number }) => b.rate - a.rate),
      paymentMethods: Object.entries(paymentMethods).map(([method, data]) => ({ method, ...data })),
      categoryBreakdown: Object.values(categoryBreakdown).sort((a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue),
      employeeBreakdown: Object.values(employeeBreakdown).sort((a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue),
      hourlyBreakdown,
      costs: { procurementCost, writeOffCost, cogs, grossProfit, grossMargin },
      voidedItems,
      activeShift: deepToNumbers(activeShift),
      isDayClosed: !activeShift,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/eod', 'Napaka pri pridobivanju poročila')
  }
}

// ============================================
// POST — ZAKLJUČI OBRATOVALNI DAN
// ============================================
export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('reports-eod', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX: Zod validacija za zaključek dneva
    const { data, error: validationError } = validateBody(eodCloseSchema, bodyResult.data)
    if (validationError) return validationError

    const { date, closingCash, notes } = data

    const targetDate = date || new Date().toISOString().split('T')[0]
    const dayStart = new Date(targetDate + 'T00:00:00.000Z')
    const dayEnd = new Date(targetDate + 'T23:59:59.999Z')

    // Preveri, da so vsa naročila zaključena ali preklicana
    const pendingOrders = await db.order.count({
      where: {
        createdAt: { gte: dayStart, lte: dayEnd },
        status: { in: ['pending', 'in-progress', 'ready'] },
      },
    })

    if (pendingOrders > 0) {
      return NextResponse.json({
        error: `Obstaja ${pendingOrders} odprtih naročil. Najprej zaključite ali prekličite vsa naročila.`,
        pendingCount: pendingOrders,
      }, { status: 400 })
    }

    // Pridobi aktivno izmeno
    const activeShift = await db.cashRegisterShift.findFirst({
      where: { status: 'open' },
      orderBy: { openedAt: 'desc' },
    })

    if (!activeShift) {
      return NextResponse.json({ error: 'Ni odprte blagajniške izmene' }, { status: 400 })
    }

    // Izračunaj zaključne podatke
    // FIX CRITICAL: Uporabi ACTUAL payments iz checkov + paidAt za zaključek dneva
    const completedOrders = await db.order.findMany({
      where: {
        paidAt: { gte: dayStart, lte: dayEnd },
        paymentStatus: 'paid',
      },
      select: {
        id: true,
        total: true,
        discount: true,
        tip: true,
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

    // FIX CRITICAL: Izračunaj po ACTUAL plačilih (uporabi payments iz checkov)
    const allPayments = completedOrders.flatMap(o => o.checks.flatMap(c => c.payments))
    const cashSales = allPayments.filter(p => p.type === 'cash').reduce((s, p) => s + toNum(p.amount), 0)
    const cardSales = allPayments.filter(p => p.type === 'card').reduce((s, p) => s + toNum(p.amount), 0)
    const mobileSales = allPayments.filter(p => p.type === 'mobile').reduce((s, p) => s + toNum(p.amount), 0)
    const alternateSales = allPayments.filter(p => ['voucher', 'loyalty', 'giftcard', 'alternate'].includes(p.type)).reduce((s, p) => s + toNum(p.amount), 0)
    const totalSales = allPayments.reduce((s, p) => s + toNum(p.amount), 0)
    const totalTips = allPayments.reduce((s, p) => s + toNum(p.tipAmount), 0)
    // FIX MEDIUM: Gotovinske napitnine se prištejejo k pričakovani gotovini
    const cashTips = allPayments.filter(p => p.type === 'cash').reduce((s, p) => s + toNum(p.tipAmount), 0)
    const totalDiscounts = completedOrders.reduce((s, o) => s + toNum(o.discount), 0)
    const voidedItems = await db.orderItem.aggregate({
      where: { voided: true, order: { createdAt: { gte: dayStart, lte: dayEnd } } },
      _sum: { price: true },
    })

    const expectedCash = toNum(activeShift.startingCash) + cashSales + cashTips
    const actualClosingCash = closingCash ?? expectedCash
    // FIX MEDIUM: cashDifference mora upoštevati tip v gotovinskih plačilih
    // cashTips se pravilno prištejejo k expectedCash zgoraj
    const cashDifference = actualClosingCash - expectedCash

    // FIX BUG-4 CRITICAL: Zapri izmeno ZNOTRAJ transakcije — prepreči double-close race condition
    // Prejšnja koda je brala status izven transakcije, nato posodabljala brez preverjanja
    await db.$transaction(async (tx) => {
      const shiftToClose = await tx.cashRegisterShift.findUnique({ where: { id: activeShift.id } })
      if (!shiftToClose) throw new Error('SHIFT_NOT_FOUND')
      if (shiftToClose.status === 'closed') throw new Error('SHIFT_ALREADY_CLOSED')

      await tx.cashRegisterShift.update({
        where: { id: activeShift.id },
        data: {
          status: 'closed',
          closedAt: new Date(),
          closingCash: actualClosingCash,
          expectedCash,
          cashDifference,
          cashSales,
          cardSales,
          mobileSales,
          alternateSales,
          totalSales,
          totalOrders: completedOrders.length,
          totalDiscounts,
          totalTips,
          totalVoided: toNum(voidedItems._sum.price),
          notes: notes || shiftToClose.notes,
        },
      })
    })

    // Revizijski dnevnik
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'CLOSE_REGISTER_SHIFT',
      entityType: 'CashRegisterShift',
      entityId: activeShift.id,
      details: { date: targetDate, totalSales, cashSales, cardSales, mobileSales, cashDifference },
    })

    return NextResponse.json({
      success: true,
      message: 'Obratovalni dan uspešno zaključen',
      shiftId: activeShift.id,
      closedAt: new Date().toISOString(),
      summary: {
        totalSales,
        cashSales,
        cardSales,
        mobileSales,
        totalTips,
        totalDiscounts,
        startingCash: toNum(activeShift.startingCash),
        expectedCash,
        closingCash: actualClosingCash,
        cashDifference,
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/reports/eod', 'Napaka pri zaključku dneva')
  }
}
