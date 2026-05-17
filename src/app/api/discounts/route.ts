import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createDiscountSchema } from '@/lib/validations'

export async function GET(req: Request) {
  try {
    // FIX: Zahtevaj avtentikacijo za branje popustov — izpostavlja promoCode, maxUses, itd.
    const authResult = await requireAuth(req, { permission: 'apply_discounts' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const appliesTo = searchParams.get('appliesTo')
    const triggerType = searchParams.get('triggerType')
    // FIX BUG 16: Pravilna preverjava isActive parametra
    const isActiveParam = searchParams.get('isActive')
    // FIX HIGH: Iskanje po promoCode za validacijo
    const promoCode = searchParams.get('promoCode')

    const where: Record<string, unknown> = {}
    if (appliesTo) where.appliesTo = appliesTo
    if (triggerType) where.triggerType = triggerType
    if (isActiveParam !== null) where.isActive = isActiveParam === 'true'
    if (promoCode) where.promoCode = promoCode

    // FIX MEDIUM: Paginacija za popuste — prepreči nalaganje vseh zapisov
    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

    const [discounts, total] = await Promise.all([
      db.discount.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        take: limit,
        skip: offset,
      }),
      db.discount.count({ where }),
    ])

    return NextResponse.json({ discounts, total, limit, offset })
  } catch (error) {
    console.error('Failed to fetch discounts:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju popustov' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // FIX BUG 14: Zahtevaj avtentikacijo za ustvarjanje popustov
    const authResult = await requireAuth(req, { permission: 'apply_discounts' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX BUG 14: Zod validacija
    const { data, error: validationError } = validateBody(createDiscountSchema, body)
    if (validationError) return validationError

    // FIX HIGH: Odstotkovni popust ne more preseči 100%
    if (data.type === 'percentage' && data.amount > 100) {
      return NextResponse.json(
        { error: 'Odstotkovni popust ne more preseči 100%' },
        { status: 400 }
      )
    }

    // FIX HIGH: Fiksni popust mora biti smiseln
    if (data.type === 'fixed_amount' && data.amount <= 0) {
      return NextResponse.json(
        { error: 'Fiksni popust mora biti pozitiven' },
        { status: 400 }
      )
    }

    const discount = await db.discount.create({
      data: {
        name: data.name,
        type: data.type,
        amount: data.amount,
        appliesTo: data.appliesTo,
        triggerType: data.triggerType,
        promoCode: data.promoCode,
        maxUses: data.maxUses ?? null,
        currentUses: 0, // Vedno začni z 0
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validTo: data.validTo ? new Date(data.validTo) : null,
        isActive: data.isActive,
        sortOrder: 0,
      },
    })

    return NextResponse.json(discount, { status: 201 })
  } catch (error) {
    console.error('Failed to create discount:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju popusta' }, { status: 500 })
  }
}
