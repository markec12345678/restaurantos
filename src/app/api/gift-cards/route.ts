import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const cardNumber = searchParams.get('cardNumber')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (cardNumber) where.cardNumber = cardNumber

    const giftCards = await db.giftCard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })

    return NextResponse.json(giftCards)
  } catch (error) {
    console.error('Failed to fetch gift cards:', error)
    return NextResponse.json({ error: 'Failed to fetch gift cards' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const giftCard = await db.giftCard.create({
      data: {
        cardNumber: body.cardNumber,
        balance: body.balance || 0,
        initialBalance: body.initialBalance || body.balance || 0,
        status: body.status || 'active',
        ownerName: body.ownerName || '',
        purchasedAt: body.purchasedAt ? new Date(body.purchasedAt) : new Date(),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
      include: {
        transactions: true,
      },
    })

    // Create initial load transaction if balance > 0
    if (giftCard.balance > 0) {
      await db.giftCardTransaction.create({
        data: {
          giftCardId: giftCard.id,
          type: 'load',
          amount: giftCard.balance,
          balanceAfter: giftCard.balance,
          note: 'Initial load',
        },
      })
    }

    return NextResponse.json(giftCard, { status: 201 })
  } catch (error) {
    console.error('Failed to create gift card:', error)
    return NextResponse.json({ error: 'Failed to create gift card' }, { status: 500 })
  }
}
