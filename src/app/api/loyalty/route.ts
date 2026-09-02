
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { createLoyaltySchema } from '@/lib/validations'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('loyalty', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX C-07: Zahtevaj avtentikacijo za zvestobne račune
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const { searchParams } = new URL(req.url)
    const tier = searchParams.get('tier')
    const isActive = searchParams.get('isActive')
    const customerPhone = searchParams.get('customerPhone')

    const where: Record<string, unknown> = {}
    // FIX Test 7.2: Multi-tenant isolation — filtriraj po session.locationId
    if (authResult.session?.locationId) {
      where.locationId = authResult.session.locationId
    }
    if (tier) where.tier = tier
    if (isActive !== null) where.isActive = isActive === 'true'
    if (customerPhone) where.customerPhone = customerPhone

    // FIX HIGH: Paginacija z NaN varnostjo — prepreči nalaganje preveč zapisov
    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

    const [accounts, total] = await Promise.all([
      db.loyaltyAccount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      }),
      db.loyaltyAccount.count({ where }),
    ])

    return NextResponse.json({ accounts, total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/loyalty', 'Napaka pri pridobivanju zvestobnih računov')
  }
}

export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('loyalty', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX C-07: Zahtevaj avtentikacijo za ustvarjanje zvestobnega računa
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createLoyaltySchema)
    if (validationError) return validationError

    // FIX HIGH: Server nadzoruje začetne točke — klient NE more nastaviti pointsBalance/lifetimePoints
    const account = await db.loyaltyAccount.create({
      data: {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || '',
        pointsBalance: 0, // FIX: Vedno začni z 0 — pridobivanje točk gre skozi loyalty earn API
        lifetimePoints: 0, // FIX: Vedno začni z 0
        tier: 'bronze', // FIX: Nov račun vedno začne kot bronze
        isActive: data.isActive,
      },
      include: {
        transactions: true,
      },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/loyalty', 'Napaka pri ustvarjanju zvestobnega računa')
  }
}
