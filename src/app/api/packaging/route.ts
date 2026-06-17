
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { createPackagingSchema } from '@/lib/validations'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (isActive !== null) where.isActive = isActive === 'true'

    const packagingConfigs = await db.packagingConfig.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return NextResponse.json(deepToNumbers(packagingConfigs))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/packaging', 'Napaka pri pridobivanju embalaže')
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX HIGH: Zod validacija za kreiranje pakiranja
    const { data, error: validationError } = validateBody(createPackagingSchema, bodyResult.data)
    if (validationError) return validationError

    const packagingConfig = await db.packagingConfig.create({
      data: {
        name: data.name,
        isActive: data.isActive,
        items: {
          create: (data.items || []).map((item) => ({
            name: item.name,
            price: item.price,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return NextResponse.json(packagingConfig, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/packaging', 'Napaka pri ustvarjanju embalaže')
  }
}
