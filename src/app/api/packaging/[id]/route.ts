
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { updatePackagingSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { NextResponse } from 'next/server'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

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
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/packaging/[id]', 'Napaka pri pridobivanju embalaže')
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX HIGH: Zod validacija za posodobitev pakiranja
    const { data, error: validationError } = validateBody(updatePackagingSchema, bodyResult.data)
    if (validationError) return validationError

    const existing = await db.packagingConfig.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Embalaža ni najdena' },
        { status: 404 }
      )
    }

    // Prepare config-level update data
    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    // Handle nested items update if provided
    if (data.items !== undefined) {
      // Delete existing items and recreate (cascade delete handled by schema)
      updateData.items = {
        deleteMany: {},
        create: data.items.map((item) => ({
          name: item.name,
          price: item.price,
          sortOrder: item.sortOrder,
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
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/packaging/[id]', 'Napaka pri posodabljanju embalaže')
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

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
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/packaging/[id]', 'Napaka pri brisanju embalaže')
  }
}
