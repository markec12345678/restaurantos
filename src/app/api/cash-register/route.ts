import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/cash-register — Get current and recent shifts
export async function GET() {
  // Get currently open shift
  const activeShift = await db.cashRegisterShift.findFirst({
    where: { status: 'open' },
    orderBy: { openedAt: 'desc' },
  })

  // If there's an active shift, calculate live stats
  let liveStats = null
  if (activeShift) {
    const paidOrders = await db.order.findMany({
      where: {
        paymentStatus: 'paid',
        createdAt: { gte: activeShift.openedAt },
      },
      select: {
        total: true,
        discount: true,
        paymentMethod: true,
        createdAt: true,
      },
    })

    const cashSales = paidOrders.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + o.total, 0)
    const cardSales = paidOrders.filter(o => o.paymentMethod === 'card').reduce((sum, o) => sum + o.total, 0)
    const mobileSales = paidOrders.filter(o => o.paymentMethod === 'mobile').reduce((sum, o) => sum + o.total, 0)
    const splitPayments = paidOrders.filter(o => o.paymentMethod === 'split').reduce((sum, o) => sum + o.total, 0)
    const totalSales = paidOrders.reduce((sum, o) => sum + o.total, 0)
    const totalDiscounts = paidOrders.reduce((sum, o) => sum + o.discount, 0)
    const totalOrders = paidOrders.length
    const expectedCash = activeShift.startingCash + cashSales

    liveStats = {
      cashSales,
      cardSales,
      mobileSales,
      splitPayments,
      totalSales,
      totalOrders,
      totalDiscounts,
      expectedCash,
    }
  }

  // Get recent closed shifts
  const recentShifts = await db.cashRegisterShift.findMany({
    where: { status: 'closed' },
    orderBy: { closedAt: 'desc' },
    take: 10,
  })

  return NextResponse.json({ activeShift, liveStats, recentShifts })
}

// POST /api/cash-register — Open a new shift
export async function POST(req: Request) {
  const body = await req.json()

  // Check if there's already an open shift
  const existingShift = await db.cashRegisterShift.findFirst({
    where: { status: 'open' },
  })

  if (existingShift) {
    return NextResponse.json(
      { error: 'Že obstaja odprta izmena. Najprej zaprite trenutno izmeno.' },
      { status: 400 }
    )
  }

  const shift = await db.cashRegisterShift.create({
    data: {
      employeeId: body.employeeId || null,
      employeeName: body.employeeName || '',
      startingCash: body.startingCash || 0,
      status: 'open',
    },
  })

  return NextResponse.json(shift)
}
