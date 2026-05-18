// ============================================
// END OF DAY API — Celoten proces zaključka dneva
// Toast POS + Restaurant365 standard
// Z-poročilo, FURS zaključek, uskladitev gotovine, dnevni povzetek
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    const startDate = new Date(date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)

    // ── Naročila ──────────────────────────────────────────────
    const orders = await db.order.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { orderItems: true },
    })

    const completedOrders = orders.filter(o => o.status === 'completed')
    const cancelledOrders = orders.filter(o => o.status === 'cancelled')
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0)
    const totalOrders = orders.length
    const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0

    // ── Plačila po metodi ─────────────────────────────────────
    const payments = await db.payment.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
    })

    const paymentsByMethod: Record<string, { count: number; total: number; tips: number }> = {}
    for (const p of payments) {
      const method = p.type || 'unknown'
      if (!paymentsByMethod[method]) paymentsByMethod[method] = { count: 0, total: 0, tips: 0 }
      paymentsByMethod[method].count++
      paymentsByMethod[method].total += p.amount || 0
      paymentsByMethod[method].tips += p.tipAmount || 0
    }

    const totalTips = payments.reduce((sum, p) => sum + (p.tipAmount || 0), 0)

    // ── DDV po stopnjah ───────────────────────────────────────
    const vatBreakdown: Record<string, { base: number; vat: number }> = {}
    for (const order of completedOrders) {
      for (const oi of order.orderItems) {
        const rate = oi.vatRate?.toString() || '22'
        if (!vatBreakdown[rate]) vatBreakdown[rate] = { base: 0, vat: 0 }
        vatBreakdown[rate].base += (oi.price || 0) * (oi.quantity || 1) - (oi.vatAmount || 0) * (oi.quantity || 1)
        vatBreakdown[rate].vat += (oi.vatAmount || 0) * (oi.quantity || 1)
      }
    }

    // ── Izmena (cash register shift) ──────────────────────────
    const activeShift = await db.cashRegisterShift.findFirst({
      where: { openedAt: { gte: startDate, lte: endDate } },
      orderBy: { openedAt: 'desc' },
    })

    // ── FURS status ───────────────────────────────────────────
    const fursInvoices = await db.auditLog.findMany({
      where: {
        action: { in: ['FURS_INVOICE_VERIFIED', 'FURS_INVOICE_QUEUED', 'FURS_INVOICE_FAILED'] },
        timestamp: { gte: startDate, lte: endDate },
      },
    })

    const fursVerified = fursInvoices.filter(f => f.action === 'FURS_INVOICE_VERIFIED').length
    const fursQueued = fursInvoices.filter(f => f.action === 'FURS_INVOICE_QUEUED').length
    const fursFailed = fursInvoices.filter(f => f.action === 'FURS_INVOICE_FAILED').length

    // ── Rezervacije ───────────────────────────────────────────
    const reservations = await db.reservation.findMany({
      where: { dateTime: { gte: startDate, lte: endDate } },
    })

    const confirmedReservations = reservations.filter(r => r.status === 'confirmed' || r.status === 'completed').length
    const noShowReservations = reservations.filter(r => r.status === 'no_show').length

    // ── Gosti ─────────────────────────────────────────────────
    const guests = await db.guest.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
    })

    // ── Stroški ───────────────────────────────────────────────
    const expenseEntries = await db.auditLog.findMany({
      where: {
        entityType: 'Expense',
        timestamp: { gte: startDate, lte: endDate },
      },
    })

    const parseDetails = (d: unknown): Record<string, unknown> => {
      if (typeof d === 'string') { try { return JSON.parse(d) } catch { return {} } }
      return (d as Record<string, unknown>) || {}
    }

    const totalExpenses = expenseEntries.reduce((sum, e) => {
      const details = parseDetails(e.details)
      return sum + ((details.amount as number) || 0)
    }, 0)

    // ── Neto dobiček ──────────────────────────────────────────
    const netProfit = totalRevenue - totalExpenses

    // ── Najbolj prodajani artikli ─────────────────────────────
    const itemSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {}
    for (const order of completedOrders) {
      for (const oi of order.orderItems) {
        const name = (oi as { menuItemName?: string }).menuItemName || 'Artikel'
        if (!itemSalesMap[name]) itemSalesMap[name] = { name, quantity: 0, revenue: 0 }
        itemSalesMap[name].quantity += oi.quantity || 1
        itemSalesMap[name].revenue += (oi.price || 0) * (oi.quantity || 1)
      }
    }
    const topItems = Object.values(itemSalesMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

    // ── Preveri ali je EOD že zaključen ───────────────────────
    const existingEOD = await db.auditLog.findFirst({
      where: {
        entityType: 'EndOfDay',
        action: 'EOD_COMPLETED',
        timestamp: { gte: startDate, lte: endDate },
      },
    })

    const eodCompleted = !!existingEOD

    return NextResponse.json({
      date,
      eodCompleted,
      // Naročila
      orders: {
        total: totalOrders,
        completed: completedOrders.length,
        cancelled: cancelledOrders.length,
        revenue: totalRevenue,
        avgOrderValue,
      },
      // Plačila
      payments: {
        byMethod: paymentsByMethod,
        totalTips,
        totalPayments: payments.length,
      },
      // DDV
      vat: vatBreakdown,
      // FURS
      furs: {
        verified: fursVerified,
        queued: fursQueued,
        failed: fursFailed,
        allVerified: fursFailed === 0 && fursQueued === 0,
      },
      // Izmena
      shift: activeShift ? {
        id: activeShift.id,
        startingCash: activeShift.startingCash,
        cashSales: activeShift.cashSales,
        cardSales: activeShift.cardSales,
        totalSales: activeShift.totalSales,
        cashDiff: activeShift.cashDifference,
        openedAt: activeShift.openedAt,
        closedAt: activeShift.closedAt,
        isClosed: !!activeShift.closedAt,
      } : null,
      // Rezervacije
      reservations: {
        total: reservations.length,
        confirmed: confirmedReservations,
        noShow: noShowReservations,
      },
      // Gosti
      guests: {
        newToday: guests.length,
      },
      // Stroški
      expenses: {
        total: totalExpenses,
        count: expenseEntries.length,
      },
      // Neto
      netProfit,
      // Top artikli
      topItems,
      // Checklisti
      checklists: {
        opening: 'Preveri kontrolni seznam za odpiranje',
        closing: 'Preveri kontrolni seznam za zapiranje',
      },
    })
  } catch (error) {
    console.error('[END-OF-DAY GET]', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju EOD podatkov' }, { status: 500 })
  }
}

// ============================================
// POST — Zaključi dan
// ============================================
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const { date, actualCash, notes } = body

    if (!date) {
      return NextResponse.json({ error: 'Datum je obvezen' }, { status: 400 })
    }

    // Zaključi izmeno
    const activeShift = await db.cashRegisterShift.findFirst({
      where: { closedAt: null },
      orderBy: { openedAt: 'desc' },
    })

    if (activeShift) {
      const cashDifference = (actualCash || 0) - activeShift.startingCash - (activeShift.cashSales || 0)
      await db.cashRegisterShift.update({
        where: { id: activeShift.id },
        data: {
          closedAt: new Date(),
          closingCash: actualCash || 0,
          cashDifference,
          notes: notes || '',
        },
      })
    }

    // Zapiši EOD audit log
    await createAuditLog({
      action: 'EOD_COMPLETED',
      entityType: 'EndOfDay',
      details: {
        date,
        actualCash: actualCash || 0,
        notes: notes || '',
        closedBy: authResult.session?.employeeId,
        shiftId: activeShift?.id,
      } as Record<string, unknown>,
      userId: authResult.session?.employeeId,
    })

    return NextResponse.json({
      success: true,
      message: `Dan ${date} je uspešno zaključen`,
      cashDiff: activeShift ? (actualCash || 0) - activeShift.startingCash - (activeShift.cashSales || 0) : 0,
    })
  } catch (error) {
    console.error('[END-OF-DAY POST]', error)
    return NextResponse.json({ error: 'Napaka pri zaključku dneva' }, { status: 500 })
  }
}
