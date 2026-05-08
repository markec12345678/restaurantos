import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const updateData: Record<string, unknown> = {}
    if (body.address !== undefined) updateData.address = body.address
    if (body.city !== undefined) updateData.city = body.city
    if (body.postCode !== undefined) updateData.postCode = body.postCode
    if (body.recipientName !== undefined) updateData.recipientName = body.recipientName
    if (body.recipientPhone !== undefined) updateData.recipientPhone = body.recipientPhone
    if (body.deliveryInstructions !== undefined) updateData.deliveryInstructions = body.deliveryInstructions
    if (body.promisedTime !== undefined) updateData.promisedTime = body.promisedTime ? new Date(body.promisedTime) : null
    if (body.estimatedTime !== undefined) updateData.estimatedTime = body.estimatedTime ? new Date(body.estimatedTime) : null
    if (body.actualTime !== undefined) updateData.actualTime = body.actualTime ? new Date(body.actualTime) : null
    if (body.courierName !== undefined) updateData.courierName = body.courierName
    if (body.courierPhone !== undefined) updateData.courierPhone = body.courierPhone
    if (body.status !== undefined) updateData.status = body.status
    if (body.packagingFee !== undefined) updateData.packagingFee = body.packagingFee
    if (body.deliveryFee !== undefined) updateData.deliveryFee = body.deliveryFee
    if (body.latitude !== undefined) updateData.latitude = body.latitude
    if (body.longitude !== undefined) updateData.longitude = body.longitude

    const delivery = await db.deliveryInfo.update({
      where: { id },
      data: updateData,
      include: {
        order: true,
      },
    })

    return NextResponse.json(delivery)
  } catch (error) {
    console.error('Failed to update delivery info:', error)
    return NextResponse.json({ error: 'Failed to update delivery info' }, { status: 500 })
  }
}
