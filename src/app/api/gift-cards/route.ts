
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createGiftCardSchema } from '@/lib/validations'
import { isPositive, deepToNumbers } from '@/lib/decimal'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError, validateRequest } from '@/lib/api-utils'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('gift-cards', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX C-07: Zahtevaj avtentikacijo za darilne kartice
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const cardNumber = searchParams.get('cardNumber')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (cardNumber) where.cardNumber = cardNumber

    // FIX HIGH: Paginacija z NaN varnostjo — prepreči nalaganje preveč zapisov
    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

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

    return NextResponse.json({ giftCards: deepToNumbers(giftCards), total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/gift-cards', 'Failed to fetch gift cards')
  }
}

export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('gift-cards', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX C-07: Zahtevaj avtentikacijo za ustvarjanje darilne kartice
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createGiftCardSchema)
    if (validationError) return validationError

    // Atomna transakcija: ustvari kartico + začetno transakcijo
    const giftCard = await db.$transaction(async (tx) => {
      const card = await tx.giftCard.create({
        data: {
          cardNumber: data.cardNumber,
          balance: data.balance,
          initialBalance: data.initialBalance ?? data.balance,
          status: data.status,
          ownerName: data.ownerName,
          purchasedAt: new Date(),
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        },
      })

      // Ustvari začetno transakcijo nalaganja
      if (isPositive(card.balance)) {
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

    return NextResponse.json(deepToNumbers(result), { status: 201 })
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        { error: `Darilna kartica s to številko že obstaja` },
        { status: 409 }
      )
    }
    // FIX CRITICAL: Ne izpostavljaj error.message — interno stanje (Prisma, DB) ne sme biti vidno klientu
    logger.error('API', 'Failed to create gift card:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju darilne kartice' }, { status: 500 })
  }
}
