// ============================================
// GOST CRM — Profesionalna implementacija
// Toast POS standard — Avtentikacija + Zod validacija
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createGuestSchema } from '@/lib/validations'
import { emitEvent } from '@/lib/event-emitter'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export async function GET(req: Request) {
  try {
    // FIX C-01: Zahtevaj avtentikacijo za dostop do gostov
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const vipOnly = searchParams.get('vip') === 'true'
    // FIX HIGH: Varno parsanje limit/offset z NaN zaščito
    const rawLimit = parseInt(searchParams.get('limit') || '50')
    const rawOffset = parseInt(searchParams.get('offset') || '0')

    // FIX C-02: Omeji limit za preprečevanje DoS + NaN varnost
    const safeLimit = Math.min(Math.max(Number.isNaN(rawLimit) ? 50 : rawLimit, 1), 200)
    const safeOffset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0)

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ]
    }

    if (vipOnly) {
      where.isVip = true
    }

    const [guests, total] = await Promise.all([
      db.guest.findMany({
        where,
        include: {
          loyaltyAccount: true,
          orders: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: { id: true, orderNumber: true, total: true, createdAt: true, status: true }
          },
        },
        orderBy: { lastVisitAt: 'desc' },
        take: safeLimit,
        skip: safeOffset,
      }),
      db.guest.count({ where }),
    ])

    return NextResponse.json({ guests, total, limit: safeLimit, offset: safeOffset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/guests', 'Napaka pri pridobivanju gostov')
  }
}

export async function POST(req: Request) {
  try {
    // FIX C-01: Zahtevaj avtentikacijo za ustvarjanje gosta
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createGuestSchema)
    if (validationError) return validationError

    const guest = await db.guest.create({
      data: {
        firstName: data.firstName || '',
        lastName: data.lastName,
        email: data.email || '',
        phone: data.phone || '',
        isVip: data.isVip || false,
        vipSince: data.isVip ? new Date() : null,
        allergens: JSON.stringify(data.allergens || []),
        dietaryPrefs: JSON.stringify(data.dietaryPrefs || []),
        dislikes: JSON.stringify(data.dislikes || []),
        favoriteItems: JSON.stringify(data.favoriteItems || []),
        birthday: data.birthday ? new Date(data.birthday) : null,
        anniversary: data.anniversary ? new Date(data.anniversary) : null,
        company: data.company || '',
        notes: data.notes || '',
      },
      include: { loyaltyAccount: true },
    })

    // Webhook: guest.created
    emitEvent('guest.created', {
      guestId: guest.id,
      name: `${guest.firstName} ${guest.lastName}`.trim(),
      email: guest.email,
    }).catch(err => logger.error('API', '[Webhook] guest.created napaka:', err))

    return NextResponse.json(guest, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/guests', 'Napaka pri ustvarjanju gosta')
  }
}
