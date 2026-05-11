import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const packagingConfig = await db.packagingConfig.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!packagingConfig) {
      return NextResponse.json(
        { error: 'Embalaža ni najdena' },
        { status: 404 }
      )
    }

    return NextResponse.json(packagingConfig)
  } catch (error) {
    console.error('Napaka pri pridobivanju embalaže:', error)
    return NextResponse.json(
      { error: 'Napaka pri pridobivanju embalaže' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.packagingConfig.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Embalaža ni najdena' },
        { status: 404 }
      )
    }

    // Prepare config-level update data
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    // Handle nested items update if provided
    if (body.items !== undefined) {
      // Delete existing items and recreate (cascade delete handled by schema)
      updateData.items = {
        deleteMany: {},
        create: (body.items as Array<{
          id?: string
          name: string
          price?: number
          isActive?: boolean
          sortOrder?: number
        }>).map((item) => ({
          name: item.name,
          price: item.price || 0,
          isActive: item.isActive !== undefined ? item.isActive : true,
          sortOrder: item.sortOrder || 0,
        })),
      }
    }

    const packagingConfig = await db.packagingConfig.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return NextResponse.json(packagingConfig)
  } catch (error) {
    console.error('Napaka pri posodabljanju embalaže:', error)
    return NextResponse.json(
      { error: 'Napaka pri posodabljanju embalaže' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.packagingConfig.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Embalaža ni najdena' },
        { status: 404 }
      )
    }

    await db.packagingConfig.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Napaka pri brisanju embalaže:', error)
    return NextResponse.json(
      { error: 'Napaka pri brisanju embalaže' },
      { status: 500 }
    )
  }
}
