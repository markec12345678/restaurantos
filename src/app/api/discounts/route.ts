import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const appliesTo = searchParams.get('appliesTo')
    const triggerType = searchParams.get('triggerType')
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (appliesTo) where.appliesTo = appliesTo
    if (triggerType) where.triggerType = triggerType
    if (isActive !== null) where.isActive = isActive === 'true'

    const discounts = await db.discount.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json(discounts)
  } catch (error) {
    console.error('Failed to fetch discounts:', error)
    return NextResponse.json({ error: 'Failed to fetch discounts' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const discount = await db.discount.create({
      data: {
        name: body.name,
        type: body.type,
        amount: body.amount,
        appliesTo: body.appliesTo || 'check',
        triggerType: body.triggerType || 'manual',
        promoCode: body.promoCode || '',
        maxUses: body.maxUses || null,
        currentUses: body.currentUses || 0,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validTo: body.validTo ? new Date(body.validTo) : null,
        isActive: body.isActive !== undefined ? body.isActive : true,
        sortOrder: body.sortOrder || 0,
      },
    })

    return NextResponse.json(discount, { status: 201 })
  } catch (error) {
    console.error('Failed to create discount:', error)
    return NextResponse.json({ error: 'Failed to create discount' }, { status: 500 })
  }
}
