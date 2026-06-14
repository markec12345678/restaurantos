
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateDeliverySchema } from '@/lib/validations'
import { decimalsToNumbers } from '@/lib/decimal'
import { handleRouteError, parseJsonBody, validateBody } from '@/lib/api-utils'
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za posodobitev dostave
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX HIGH: Zod validacija namesto direktnega branja body-ja — prepreči injection
    const { data, error: validationError } = validateBody(updateDeliverySchema, bodyResult.data)
    if (validationError) return validationError

    // FIX D-03 HIGH: Uporabi transakcijo za preprečitev race condition na status prehodih
    const delivery = await db.$transaction(async (tx) => {
      const existing = await tx.deliveryInfo.findUnique({ where: { id } })
      if (!existing) {
        throw new Error('DELIVERY_NOT_FOUND')
      }

      // State machine za dostavne statuse
      const validTransitions: Record<string, string[]> = {
        pending: ['preparing', 'failed'],
        preparing: ['ready', 'failed'],
        ready: ['picked_up', 'failed'],
        picked_up: ['delivered', 'failed'],
        delivered: [],
        failed: [],
      }
      if (data.status !== undefined && existing.status !== data.status) {
        const allowed = validTransitions[existing.status] || []
        if (!allowed.includes(data.status)) {
          throw new Error(`INVALID_TRANSITION:${existing.status}:${data.status}`)
        }
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

      return tx.deliveryInfo.update({
        where: { id },
        data: updateData,
        include: { order: true },
      })
    })

    return NextResponse.json(decimalsToNumbers(delivery, ['deliveryFee', 'packagingFee']))
  } catch (error: unknown) {
    return handleRouteError(error, 'PUT /api/delivery/[id]', [
      { match: 'DELIVERY_NOT_FOUND', message: 'Dostava ni najdena', status: 404 },
      { match: 'INVALID_TRANSITION', message: 'Neveljaven prehod statusa', status: 400, extra: (parts) => ({ error: `Neveljaven prehod statusa: ${parts[1]} → ${parts[2]}`, currentStatus: parts[1], requestedStatus: parts[2] }) },
    ], 'Napaka pri posodobitvi dostave')
  }
}
