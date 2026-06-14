
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { updateModifierGroupSchema } from '@/lib/validations'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(request, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const bodyResult = await parseJsonBody(request)
    if (bodyResult.error) return bodyResult.error
    const body = bodyResult.data

    // FIX CRITICAL: Zod validacija — prepreči injection nepričakovanih polj
    const { data, error: validationError } = validateBody(updateModifierGroupSchema, body)
    if (validationError) return validationError

    // FIX BUG5: Wrap deleteMany + createMany in a transaction
    // Previously, if createMany failed after deleteMany, all modifiers were permanently deleted
    const modifierGroup = await db.$transaction(async (tx) => {
      if (data.modifiers) {
        // Delete existing modifiers and recreate — within transaction for atomicity
        await tx.modifier.deleteMany({ where: { modifierGroupId: id } })
      }

      // Build update data from validated fields only
      const updateData: Record<string, unknown> = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.required !== undefined) updateData.required = data.required
      if (data.minSelect !== undefined) updateData.minSelect = data.minSelect
      if (data.maxSelect !== undefined) updateData.maxSelect = data.maxSelect
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
      if (data.modifiers) {
        updateData.modifiers = {
          create: data.modifiers.map((m, i) => ({
            name: m.name,
            price: m.price,
            sortOrder: m.sortOrder ?? i,
          })),
        }
      }

      return tx.modifierGroup.update({
        where: { id },
        data: updateData,
        include: { modifiers: true },
      })
    })
    return NextResponse.json(modifierGroup)
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/modifier-groups/[id]', 'Napaka pri posodobitvi skupine modifikatorjev')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(request, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params

    // FIX: Preveri, da skupina obstaja pred brisanjem
    const existing = await db.modifierGroup.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Skupina modifikatorjev ni najdena' }, { status: 404 })
    }

    await db.modifierGroup.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/modifier-groups/[id]', 'Napaka pri brisanju skupine modifikatorjev')
  }
}
