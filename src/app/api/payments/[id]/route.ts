import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const updateData: Record<string, unknown> = {}
    if (body.amount !== undefined) updateData.amount = body.amount
    if (body.tipAmount !== undefined) updateData.tipAmount = body.tipAmount
    if (body.type !== undefined) updateData.type = body.type
    if (body.alternatePaymentTypeId !== undefined) updateData.alternatePaymentTypeId = body.alternatePaymentTypeId || null
    if (body.cardType !== undefined) updateData.cardType = body.cardType
    if (body.cardLast4 !== undefined) updateData.cardLast4 = body.cardLast4
    if (body.authorizationCode !== undefined) updateData.authorizationCode = body.authorizationCode
    if (body.giftCardId !== undefined) updateData.giftCardId = body.giftCardId || null
    if (body.loyaltyAccountId !== undefined) updateData.loyaltyAccountId = body.loyaltyAccountId || null
    if (body.loyaltyPointsUsed !== undefined) updateData.loyaltyPointsUsed = body.loyaltyPointsUsed
    if (body.status !== undefined) updateData.status = body.status
    if (body.employeeId !== undefined) updateData.employeeId = body.employeeId || null

    const payment = await db.payment.update({
      where: { id },
      data: updateData,
      include: {
        check: true,
        alternatePaymentType: true,
        giftCard: true,
        loyaltyAccount: true,
      },
    })

    return NextResponse.json(payment)
  } catch (error) {
    console.error('Failed to update payment:', error)
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
  }
}
