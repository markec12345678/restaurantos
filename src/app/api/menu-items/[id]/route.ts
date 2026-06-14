
import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateMenuItemSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // 404 check before update
    const existing = await db.menuItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // Zod validation
    const { data, error: validationError } = validateBody(updateMenuItemSchema, bodyResult.data)
    if (validationError) return validationError

    // Update modifier group associations and menu item in a transaction
    const item = await db.$transaction(async (tx) => {
      // Update modifier group associations if provided
      if (data.modifierGroupIds !== undefined) {
        await tx.menuItemModifierGroup.deleteMany({ where: { menuItemId: id } })
        if (data.modifierGroupIds.length > 0) {
          await tx.menuItemModifierGroup.createMany({
            data: data.modifierGroupIds.map((groupId: string, i: number) => ({
              menuItemId: id,
              modifierGroupId: groupId,
              sortOrder: i,
            })),
          })
        }
      }

      const updateData: Record<string, unknown> = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.description !== undefined) updateData.description = data.description
      if (data.price !== undefined) updateData.price = data.price
      if (data.image !== undefined) updateData.image = data.image
      if (data.isAvailable !== undefined) updateData.isAvailable = data.isAvailable
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
      if (data.categoryId !== undefined) updateData.categoryId = data.categoryId
      // FIX MEDIUM: Dodana manjkajoča polja allergens in vatRate v update
      if (data.allergens !== undefined) updateData.allergens = data.allergens
      if (data.vatRate !== undefined) updateData.vatRate = data.vatRate

      return tx.menuItem.update({
        where: { id },
        data: updateData,
        include: {
          category: { include: { menu: { select: { id: true, name: true } } } },
          modifierGroups: {
            orderBy: { sortOrder: 'asc' },
            include: {
              modifierGroup: { include: { modifiers: { orderBy: { sortOrder: 'asc' } } } },
            },
          },
        },
      })
    })

    return NextResponse.json(deepToNumbers(item))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/menu-items/[id]', 'Napaka pri posodobitvi artikla')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // 404 check before delete
    const existing = await db.menuItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    // FIX MEDIUM: Soft-delete namesto hard-delete — prepreči crash če artikel ima OrderItems
    // Prisma ima onDelete: Restrict na OrderItem.menuItem, zato hard-delete crashne
    await db.menuItem.update({
      where: { id },
      data: { isAvailable: false },
    })
    return NextResponse.json({ success: true, message: 'Artikel onemogočen (soft-delete)' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/menu-items/[id]', 'Napaka pri brisanju artikla')
  }
}
