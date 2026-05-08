import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const checkId = searchParams.get('checkId')
    const type = searchParams.get('type')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (checkId) where.checkId = checkId
    if (type) where.type = type
    if (status) where.status = status

    const payments = await db.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        check: { select: { id: true, checkNumber: true, orderId: true } },
        alternatePaymentType: true,
        giftCard: true,
        loyaltyAccount: true,
      },
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error('Failed to fetch payments:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const payment = await db.payment.create({
      data: {
        checkId: body.checkId,
        amount: body.amount,
        tipAmount: body.tipAmount || 0,
        type: body.type,
        alternatePaymentTypeId: body.alternatePaymentTypeId || null,
        cardType: body.cardType || '',
        cardLast4: body.cardLast4 || '',
        authorizationCode: body.authorizationCode || '',
        giftCardId: body.giftCardId || null,
        loyaltyAccountId: body.loyaltyAccountId || null,
        loyaltyPointsUsed: body.loyaltyPointsUsed || 0,
        status: body.status || 'completed',
        employeeId: body.employeeId || null,
      },
      include: {
        check: true,
        alternatePaymentType: true,
        giftCard: true,
        loyaltyAccount: true,
      },
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error('Failed to create payment:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}
