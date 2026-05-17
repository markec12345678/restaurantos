import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createGiftCardSchema } from '@/lib/validations'

export async function GET(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za darilne kartice
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const cardNumber = searchParams.get('cardNumber')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (cardNumber) where.cardNumber = cardNumber

    // FIX: Paginacija — prepreči nalaganje preveč zapisov
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    const offset = parseInt(searchParams.get('offset') || '0')

    const [giftCards, total] = await Promise.all([
      db.giftCard.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      }),
      db.giftCard.count({ where }),
    ])

    return NextResponse.json({ giftCards, total, limit, offset })
  } catch (error) {
    console.error('Failed to fetch gift cards:', error)
    return NextResponse.json({ error: 'Failed to fetch gift cards' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za ustvarjanje darilne kartice
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(createGiftCardSchema, body)
    if (validationError) return validationError

    // Atomna transakcija: ustvari kartico + začetno transakcijo
    const giftCard = await db.$transaction(async (tx) => {
      const card = await tx.giftCard.create({
        data: {
          cardNumber: data.cardNumber,
          balance: data.balance,
          initialBalance: data.initialBalance || data.balance,
          status: data.status,
          ownerName: data.ownerName,
          purchasedAt: new Date(),
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        },
      })

      // Ustvari začetno transakcijo nalaganja
      if (card.balance > 0) {
        await tx.giftCardTransaction.create({
          data: {
            giftCardId: card.id,
            type: 'load',
            amount: card.balance,
            balanceAfter: card.balance,
            note: 'Začetno nalaganje',
          },
        })
      }

      return card
    })

    // Re-fetch z transakcijami
    const result = await db.giftCard.findUnique({
      where: { id: giftCard.id },
      include: { transactions: true },
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: `Darilna kartica s to številko že obstaja` },
        { status: 409 }
      )
    }
    console.error('Failed to create gift card:', error)
    return NextResponse.json({ error: 'Failed to create gift card' }, { status: 500 })
  }
}
