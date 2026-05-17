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

    const where: Record<string, unknown> = {}
    if (appliesTo) where.appliesTo = appliesTo
    if (triggerType) where.triggerType = triggerType
    if (isActiveParam !== null) where.isActive = isActiveParam === 'true'

    const discounts = await db.discount.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json(discounts)
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
