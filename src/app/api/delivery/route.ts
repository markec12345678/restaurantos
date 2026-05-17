import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createDeliverySchema } from '@/lib/validations'

export async function GET(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za dostave
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    // FIX: Paginacija za dostave z NaN varnostjo
    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [deliveries, total] = await Promise.all([
      db.deliveryInfo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          order: { select: { id: true, orderNumber: true, customerName: true } },
        },
      }),
      db.deliveryInfo.count({ where }),
    ])

    return NextResponse.json({ deliveries, total, limit, offset })
  } catch (error) {
    console.error('Failed to fetch delivery info:', error)
    return NextResponse.json({ error: 'Failed to fetch delivery info' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za ustvarjanje dostave
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX: Zod validacija namesto ročnega branja body-ja
    const { data, error: validationError } = validateBody(createDeliverySchema, body)
    if (validationError) return validationError

    const delivery = await db.deliveryInfo.create({
      data: {
        address: data.address,
        city: data.city,
        postCode: data.postCode,
        recipientName: data.recipientName,
        recipientPhone: data.recipientPhone,
        deliveryInstructions: data.deliveryInstructions,
        promisedTime: data.promisedTime ? new Date(data.promisedTime) : null,
        estimatedTime: data.estimatedTime ? new Date(data.estimatedTime) : null,
        courierName: data.courierName,
        courierPhone: data.courierPhone,
        status: data.status,
        packagingFee: data.packagingFee,
        deliveryFee: data.deliveryFee,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      },
      include: {
        order: true,
      },
    })

    return NextResponse.json(delivery, { status: 201 })
  } catch (error) {
    console.error('Failed to create delivery info:', error)
    return NextResponse.json({ error: 'Failed to create delivery info' }, { status: 500 })
  }
}
