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
    return NextResponse.json({ error: 'Napaka pri pridobivanju plačil' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Validiraj osnovna polja
    if (!body.checkId) {
      return NextResponse.json({ error: 'Manjka checkId' }, { status: 400 })
    }
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ error: 'Znesek plačila mora biti pozitiven' }, { status: 400 })
    }
    if (!body.type) {
      return NextResponse.json({ error: 'Manjka vrsta plačila' }, { status: 400 })
    }

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

    // FIX H-05: Gift card balance deduction
    if (body.type === 'giftcard' && body.giftCardId) {
      const giftCard = await db.giftCard.findUnique({ where: { id: body.giftCardId } })
      if (giftCard) {
        if (giftCard.balance < body.amount) {
          // Zmanjšaj plačilo na razpoložljivo stanje
          await db.payment.update({
            where: { id: payment.id },
            data: { amount: giftCard.balance },
          })
          // Posodobi stanje na 0
          await db.giftCard.update({
            where: { id: body.giftCardId },
            data: { balance: 0, status: 'depleted' },
          })
          // Zabeleži transakcijo
          await db.giftCardTransaction.create({
            data: {
              giftCardId: body.giftCardId,
              type: 'redeem',
              amount: -giftCard.balance,
              balanceAfter: 0,
              orderId: payment.check?.orderId || null,
              checkId: body.checkId,
              note: `Plačilo - celotno stanje kartice`,
            },
          })
        } else {
          // Odštej znesek od stanja
          const newBalance = Math.round((giftCard.balance - body.amount) * 100) / 100
          await db.giftCard.update({
            where: { id: body.giftCardId },
            data: { balance: newBalance, status: newBalance <= 0 ? 'depleted' : 'active' },
          })
          await db.giftCardTransaction.create({
            data: {
              giftCardId: body.giftCardId,
              type: 'redeem',
              amount: -body.amount,
              balanceAfter: newBalance,
              orderId: payment.check?.orderId || null,
              checkId: body.checkId,
              note: `Plačilo naročila`,
            },
          })
        }
      }
    }

    // FIX H-05: Loyalty points deduction
    if (body.type === 'loyalty' && body.loyaltyAccountId && body.loyaltyPointsUsed > 0) {
      const loyaltyAccount = await db.loyaltyAccount.findUnique({ where: { id: body.loyaltyAccountId } })
      if (loyaltyAccount) {
        const newPointsBalance = Math.max(0, loyaltyAccount.pointsBalance - body.loyaltyPointsUsed)
        await db.loyaltyAccount.update({
          where: { id: body.loyaltyAccountId },
          data: { pointsBalance: newPointsBalance },
        })
        await db.loyaltyTransaction.create({
          data: {
            loyaltyAccountId: body.loyaltyAccountId,
            type: 'redeem',
            points: -body.loyaltyPointsUsed,
            reason: 'Unovčenje točk za plačilo',
            orderId: payment.check?.orderId || null,
            checkId: body.checkId,
            monetaryValue: body.amount,
          },
        })
      }
    }

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error('Failed to create payment:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju plačila' }, { status: 500 })
  }
}
