
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationId } from '@/lib/auth-middleware/tenant-scope'
import { createDeliverySchema } from '@/lib/validations'
import { decimalsToNumbers } from '@/lib/decimal'
import { handleApiError, validateRequest } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

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
    // FIX DELIVERY-1 MEDIUM: Dodaj locationId filter — brez tega se prikažejo dostave iz VSEH lokacij
    const locationId = resolveTenantLocationId(authResult, searchParams)
    if (locationId) {
      where.order = { locationId }
    }

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

    return NextResponse.json({ deliveries: deliveries.map(d => decimalsToNumbers(d, ['deliveryFee', 'packagingFee'])), total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/delivery', 'Failed to fetch delivery info')
  }
}

export async function POST(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za ustvarjanje dostave
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createDeliverySchema)
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

    return NextResponse.json(decimalsToNumbers(delivery, ['deliveryFee', 'packagingFee']), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/delivery', 'Failed to create delivery info')
  }
}
