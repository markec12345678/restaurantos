import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, updateDeliverySchema } from '@/lib/validations'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za posodobitev dostave
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const { id } = await params
    const body = await req.json()

    // FIX HIGH: Zod validacija namesto direktnega branja body-ja — prepreči injection
    const { data, error: validationError } = validateBody(updateDeliverySchema, body)
    if (validationError) return validationError

    // Preveri, da dostava obstaja
    const existing = await db.deliveryInfo.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Dostava ni najdena' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.address !== undefined) updateData.address = data.address
    if (data.city !== undefined) updateData.city = data.city
    if (data.postCode !== undefined) updateData.postCode = data.postCode
    if (data.recipientName !== undefined) updateData.recipientName = data.recipientName
    if (data.recipientPhone !== undefined) updateData.recipientPhone = data.recipientPhone
    if (data.deliveryInstructions !== undefined) updateData.deliveryInstructions = data.deliveryInstructions
    if (data.promisedTime !== undefined) updateData.promisedTime = data.promisedTime ? new Date(data.promisedTime) : null
    if (data.estimatedTime !== undefined) updateData.estimatedTime = data.estimatedTime ? new Date(data.estimatedTime) : null
    if (data.actualTime !== undefined) updateData.actualTime = data.actualTime ? new Date(data.actualTime) : null
    if (data.courierName !== undefined) updateData.courierName = data.courierName
    if (data.courierPhone !== undefined) updateData.courierPhone = data.courierPhone
    if (data.status !== undefined) updateData.status = data.status
    if (data.packagingFee !== undefined) updateData.packagingFee = data.packagingFee
    if (data.deliveryFee !== undefined) updateData.deliveryFee = data.deliveryFee
    if (data.latitude !== undefined) updateData.latitude = data.latitude
    if (data.longitude !== undefined) updateData.longitude = data.longitude

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
    return NextResponse.json({ error: 'Napaka pri posodobitvi dostave' }, { status: 500 })
  }
}
