import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
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

    return NextResponse.json(packagingConfigs)
  } catch (error) {
    console.error('Napaka pri pridobivanju embalaže:', error)
    return NextResponse.json(
      { error: 'Napaka pri pridobivanju embalaže' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    if (!body.name) {
      return NextResponse.json(
        { error: 'Ime embalaže je obvezno' },
        { status: 400 }
      )
    }

    const packagingConfig = await db.packagingConfig.create({
      data: {
        name: body.name,
        isActive: body.isActive !== undefined ? body.isActive : true,
        items: {
          create: (body.items || []).map(
            (item: {
              name: string
              price?: number
              isActive?: boolean
              sortOrder?: number
            }) => ({
              name: item.name,
              price: item.price || 0,
              isActive: item.isActive !== undefined ? item.isActive : true,
              sortOrder: item.sortOrder || 0,
            })
          ),
        },
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return NextResponse.json(packagingConfig, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju embalaže:', error)
    return NextResponse.json(
      { error: 'Napaka pri ustvarjanju embalaže' },
      { status: 500 }
    )
  }
}
