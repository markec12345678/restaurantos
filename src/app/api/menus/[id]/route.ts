
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { updateMenuSchema } from '@/lib/validations'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(request, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const bodyResult = await parseJsonBody(request)
    if (bodyResult.error) return bodyResult.error
    const body = bodyResult.data

    // FIX HIGH: Zod validacija za posodobitev menija
    const { data, error: validationError } = validateBody(updateMenuSchema, body)
    if (validationError) return validationError

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.icon !== undefined) updateData.icon = data.icon
    if (data.color !== undefined) updateData.color = data.color
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const menu = await db.menu.update({
      where: { id },
      data: updateData,
    })
    return NextResponse.json(menu)
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/menus/[id]', 'Napaka pri posodobitvi menija')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(request, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    await db.menu.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/menus/[id]', 'Napaka pri brisanju menija')
  }
}
