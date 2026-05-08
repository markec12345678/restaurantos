import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// PUT /api/cash-register/[id] — Close a shift
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const shift = await db.cashRegisterShift.findUnique({ where: { id } })
  if (!shift) {
    return NextResponse.json({ error: 'Izmena ni najdena' }, { status: 404 })
  }
  if (shift.status === 'closed') {
    return NextResponse.json({ error: 'Izmena je že zaprta' }, { status: 400 })
  }

  // Calculate final stats from paid orders during this shift
  const paidOrders = await db.order.findMany({
    where: {
      paymentStatus: 'paid',
      createdAt: { gte: shift.openedAt },
    },
    select: {
      total: true,
      discount: true,
      paymentMethod: true,
    },
  })

  const cashSales = paidOrders.filter(o => o.paymentMethod === 'cash').reduce((sum, o) => sum + o.total, 0)
  const cardSales = paidOrders.filter(o => o.paymentMethod === 'card').reduce((sum, o) => sum + o.total, 0)
  const mobileSales = paidOrders.filter(o => o.paymentMethod === 'mobile').reduce((sum, o) => sum + o.total, 0)
  const splitPayments = paidOrders.filter(o => o.paymentMethod === 'split').reduce((sum, o) => sum + o.total, 0)
  const totalSales = paidOrders.reduce((sum, o) => sum + o.total, 0)
  const totalDiscounts = paidOrders.reduce((sum, o) => sum + o.discount, 0)
  const totalOrders = paidOrders.length
  const expectedCash = shift.startingCash + cashSales
  const closingCash = body.closingCash ?? expectedCash
  const cashDifference = closingCash - expectedCash

  const closedShift = await db.cashRegisterShift.update({
    where: { id },
    data: {
      status: 'closed',
      closedAt: new Date(),
      closingCash,
      expectedCash,
      cashSales,
      cardSales,
      mobileSales,
      splitPayments,
      totalSales,
      totalOrders,
      totalDiscounts,
      totalTips: body.totalTips || 0,
      cashDifference,
      notes: body.notes || '',
    },
  })

  return NextResponse.json(closedShift)
}
