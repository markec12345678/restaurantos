import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, eodCloseSchema } from '@/lib/validations'

// ============================================
// END-OF-DAY (ZOD - Zaključek obratovalnega dneva)
// GET: Pridobi podatke za zaključek dneva
// POST: Zaključi obratovalni dan (zapri blagajno, generiraj izpiske)
// ============================================

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    const dayStart = new Date(date + 'T00:00:00.000Z')
    const dayEnd = new Date(date + 'T23:59:59.999Z')

    // ─── VSA NAROČILA TEGA DNE ───
    const orders = await db.order.findMany({
      where: {
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      include: {
        orderItems: {
          include: {
            menuItem: {
              include: {
                category: {
                  include: {
                    menu: true,
                  },
                },
              },
            },
          },
        },
        checks: {
          include: {
            payments: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // ─── OSNOVNE STATISTIKE ───
    const completedOrders = orders.filter(o => o.status === 'completed')
    const cancelledOrders = orders.filter(o => o.status === 'cancelled')
    const pendingOrders = orders.filter(o => ['pending', 'in-progress', 'ready'].includes(o.status))
    const paidOrders = orders.filter(o => o.paymentStatus === 'paid')

    // ─── PRIHODEK ───
    const totalRevenue = completedOrders.reduce((s, o) => s + o.total, 0)
    const totalSubtotal = completedOrders.reduce((s, o) => s + o.subtotal, 0)
    const totalTax = completedOrders.reduce((s, o) => s + o.tax, 0)
    const totalDiscount = completedOrders.reduce((s, o) => s + o.discount, 0)
    const totalTips = completedOrders.reduce((s, o) => s + o.tip, 0)
    const totalWithTips = completedOrders.reduce((s, o) => s + o.totalWithTip, 0)

    // ─── DDV RAZČLENITEV ───
    const vatBreakdown: Record<string, { base: number; vat: number; rate: number }> = {}
    for (const order of completedOrders) {
      for (const item of order.orderItems) {
        if (item.voided) continue
        const rateKey = String(item.vatRate)
        if (!vatBreakdown[rateKey]) {
          vatBreakdown[rateKey] = { base: 0, vat: 0, rate: item.vatRate }
        }
        const itemBase = item.price * item.quantity
        const itemVat = item.vatAmount || (itemBase * item.vatRate / 100)
        vatBreakdown[rateKey].base += itemBase
        vatBreakdown[rateKey].vat += itemVat
      }
    }

    // ─── PLAČILNE METODE ───
    const paymentMethods: Record<string, { count: number; revenue: number; tips: number }> = {}
    for (const order of paidOrders) {
      const checks = (order as any).checks || []
      for (const check of checks) {
        for (const payment of check.payments || []) {
          const method = payment.type
          if (!paymentMethods[method]) {
            paymentMethods[method] = { count: 0, revenue: 0, tips: 0 }
          }
          paymentMethods[method].count += 1
          paymentMethods[method].revenue += payment.amount
          paymentMethods[method].tips += payment.tipAmount
        }
      }
    }

    // ─── PO KATEGORIJAH ───
    const categoryBreakdown: Record<string, { category: string; quantity: number; revenue: number; menu: string }> = {}
    for (const order of completedOrders) {
      for (const item of order.orderItems) {
        if (item.voided) continue
        const cat = item.menuItem.category?.name || 'Ostalo'
        const menu = item.menuItem.category?.menu?.name || ''
        const key = `${menu}::${cat}`
        if (!categoryBreakdown[key]) {
          categoryBreakdown[key] = { category: cat, quantity: 0, revenue: 0, menu }
        }
        categoryBreakdown[key].quantity += item.quantity
        categoryBreakdown[key].revenue += item.price * item.quantity
      }
    }

    // ─── PO ZAPOSLENIH ───
    const employeeBreakdown: Record<string, { employeeId: string; orderCount: number; revenue: number; tips: number }> = {}
    for (const order of completedOrders) {
      const empId = order.employeeId || 'unknown'
      if (!employeeBreakdown[empId]) {
        employeeBreakdown[empId] = { employeeId: empId, orderCount: 0, revenue: 0, tips: 0 }
      }
      employeeBreakdown[empId].orderCount += 1
      employeeBreakdown[empId].revenue += order.total
      employeeBreakdown[empId].tips += order.tip
    }
    const empIds = Object.keys(employeeBreakdown).filter(id => id !== 'unknown')
    if (empIds.length > 0) {
      const employees = await db.employee.findMany({ where: { id: { in: empIds } } })
      for (const emp of employees) {
        if (employeeBreakdown[emp.id]) {
          (employeeBreakdown[emp.id] as Record<string, unknown>).employeeName = emp.name
        }
      }
    }

    // ─── PO URAH ───
    const hourlyBreakdown: Array<{ hour: number; revenue: number; orders: number }> = []
    for (let h = 0; h < 24; h++) {
      const hourOrders = completedOrders.filter(o => new Date(o.createdAt).getHours() === h)
      hourlyBreakdown.push({
        hour: h,
        revenue: hourOrders.reduce((s, o) => s + o.total, 0),
        orders: hourOrders.length,
      })
    }

    // ─── STROŠKI ───
    const stockTransactions = await db.stockTransaction.findMany({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
    })
    const procurementCost = stockTransactions.filter(t => t.type === 'procurement').reduce((s, t) => s + t.totalCost, 0)
    const writeOffCost = stockTransactions.filter(t => t.type === 'write-off').reduce((s, t) => s + Math.abs(t.totalCost), 0)
    const cogs = stockTransactions.filter(t => t.type === 'sale').reduce((s, t) => s + Math.abs(t.totalCost), 0)
    const grossProfit = totalRevenue - cogs - writeOffCost
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

    // ─── BLAGAJNA ───
    const activeShift = await db.cashRegisterShift.findFirst({
      where: { status: 'open' },
      orderBy: { openedAt: 'desc' },
    })

    // ─── VOIDANI ARTIKLI ───
    const voidedItems = orders.flatMap(o =>
      o.orderItems.filter(i => i.voided).map(i => ({
        name: i.menuItem.name,
        quantity: i.quantity,
        price: i.price,
      }))
    )

    const cancelledRevenue = cancelledOrders.reduce((s, o) => s + o.total, 0)

    return NextResponse.json({
      date,
      summary: {
        totalOrders: orders.length,
        completedOrders: completedOrders.length,
        cancelledOrders: cancelledOrders.length,
        pendingOrders: pendingOrders.length,
        paidOrders: paidOrders.length,
        totalRevenue,
        totalSubtotal,
        totalTax,
        totalDiscount,
        totalTips,
        totalWithTips,
        avgOrderValue: completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0,
        cancelledRevenue,
      },
      vatBreakdown: Object.values(vatBreakdown).sort((a: { rate: number }, b: { rate: number }) => b.rate - a.rate),
      paymentMethods: Object.entries(paymentMethods).map(([method, data]) => ({ method, ...data })),
      categoryBreakdown: Object.values(categoryBreakdown).sort((a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue),
      employeeBreakdown: Object.values(employeeBreakdown).sort((a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue),
      hourlyBreakdown,
      costs: { procurementCost, writeOffCost, cogs, grossProfit, grossMargin },
      voidedItems,
      activeShift,
      isDayClosed: !activeShift,
    })
  } catch (error) {
    console.error('EOD report error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju poročila' }, { status: 500 })
  }
}

// ============================================
// POST — ZAKLJUČI OBRATOVALNI DAN
// ============================================
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX: Zod validacija za zaključek dneva
    const { data, error: validationError } = validateBody(eodCloseSchema, body)
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
    const completedOrders = await db.order.findMany({
      where: {
        createdAt: { gte: dayStart, lte: dayEnd },
        status: 'completed',
        paymentStatus: 'paid',
      },
    })

    const cashSales = completedOrders.filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + o.total, 0)
    const cardSales = completedOrders.filter(o => o.paymentMethod === 'card').reduce((s, o) => s + o.total, 0)
    const mobileSales = completedOrders.filter(o => o.paymentMethod === 'mobile').reduce((s, o) => s + o.total, 0)
    const totalSales = completedOrders.reduce((s, o) => s + o.total, 0)
    const totalTips = completedOrders.reduce((s, o) => s + o.tip, 0)
    const totalDiscounts = completedOrders.reduce((s, o) => s + o.discount, 0)
    const voidedItems = await db.orderItem.aggregate({
      where: { voided: true, order: { createdAt: { gte: dayStart, lte: dayEnd } } },
      _sum: { price: true },
    })

    const expectedCash = activeShift.startingCash + cashSales
    const actualClosingCash = closingCash || expectedCash
    const cashDifference = actualClosingCash - expectedCash

    // Zapri izmeno
    await db.cashRegisterShift.update({
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
        totalSales,
        totalOrders: completedOrders.length,
        totalDiscounts,
        totalTips,
        totalVoided: voidedItems._sum.price || 0,
        notes: notes || activeShift.notes,
      },
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
        startingCash: activeShift.startingCash,
        expectedCash,
        closingCash: actualClosingCash,
        cashDifference,
      },
    })
  } catch (error) {
    console.error('EOD close error:', error)
    return NextResponse.json({ error: 'Napaka pri zaključku dneva' }, { status: 500 })
  }
}
