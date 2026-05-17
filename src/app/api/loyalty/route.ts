import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createLoyaltySchema } from '@/lib/validations'

export async function GET(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za zvestobne račune
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const { searchParams } = new URL(req.url)
    const tier = searchParams.get('tier')
    const isActive = searchParams.get('isActive')
    const customerPhone = searchParams.get('customerPhone')

    const where: Record<string, unknown> = {}
    if (tier) where.tier = tier
    if (isActive !== null) where.isActive = isActive === 'true'
    if (customerPhone) where.customerPhone = customerPhone

    // FIX: Paginacija — prepreči nalaganje preveč zapisov
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    const offset = parseInt(searchParams.get('offset') || '0')

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
  } catch (error) {
    console.error('Failed to fetch loyalty accounts:', error)
    return NextResponse.json({ error: 'Failed to fetch loyalty accounts' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za ustvarjanje zvestobnega računa
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(createLoyaltySchema, body)
    if (validationError) return validationError

    const account = await db.loyaltyAccount.create({
      data: {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || '',
        pointsBalance: data.pointsBalance,
        lifetimePoints: data.lifetimePoints,
        tier: data.tier,
        isActive: data.isActive,
      },
      include: {
        transactions: true,
      },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    console.error('Failed to create loyalty account:', error)
    return NextResponse.json({ error: 'Failed to create loyalty account' }, { status: 500 })
  }
}
