import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getNextCounter } from '@/lib/counters'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const paymentStatus = searchParams.get('paymentStatus')

    const where: Record<string, unknown> = {}
    if (orderId) where.orderId = orderId
    if (paymentStatus) where.paymentStatus = paymentStatus

    const checks = await db.check.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { id: true, orderNumber: true, customerName: true } },
        orderItems: { include: { menuItem: { select: { id: true, name: true } } } },
        payments: true,
        appliedDiscount: true,
      },
    })

    return NextResponse.json(checks)
  } catch (error) {
    console.error('Napaka pri pridobivanju čekov:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju čekov' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // FIX 1: Atomna številka čeka
    const checkNumber = await getNextCounter('checkNumber')

    const check = await db.check.create({
      data: {
        checkNumber,
        orderId: body.orderId,
        subtotal: body.subtotal || 0,
        tax: body.tax || 0,
        discount: body.discount || 0,
        serviceCharge: body.serviceCharge || 0,
        total: body.total || 0,
        tip: body.tip || 0,
        totalWithTip: body.totalWithTip || 0,
        paymentStatus: body.paymentStatus || 'unpaid',
        paymentMethod: body.paymentMethod || '',
        appliedDiscountId: body.appliedDiscountId || null,
      },
      include: {
        order: true,
        orderItems: true,
        payments: true,
      },
    })

    return NextResponse.json(check, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju čeka:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju čeka' }, { status: 500 })
  }
}
