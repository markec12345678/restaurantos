import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const deliveries = await db.deliveryInfo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { id: true, orderNumber: true, customerName: true } },
      },
    })

    return NextResponse.json(deliveries)
  } catch (error) {
    console.error('Failed to fetch delivery info:', error)
    return NextResponse.json({ error: 'Failed to fetch delivery info' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const delivery = await db.deliveryInfo.create({
      data: {
        address: body.address,
        city: body.city || '',
        postCode: body.postCode || '',
        recipientName: body.recipientName || '',
        recipientPhone: body.recipientPhone || '',
        deliveryInstructions: body.deliveryInstructions || '',
        promisedTime: body.promisedTime ? new Date(body.promisedTime) : null,
        estimatedTime: body.estimatedTime ? new Date(body.estimatedTime) : null,
        actualTime: body.actualTime ? new Date(body.actualTime) : null,
        courierName: body.courierName || '',
        courierPhone: body.courierPhone || '',
        status: body.status || 'pending',
        packagingFee: body.packagingFee || 0,
        deliveryFee: body.deliveryFee || 0,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
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
