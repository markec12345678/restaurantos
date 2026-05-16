import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, updateMenuItemSchema } from '@/lib/validations'

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

    const body = await req.json()

    // Zod validation
    const { data, error: validationError } = validateBody(updateMenuItemSchema, body)
    if (validationError) return validationError

    // Update modifier group associations and menu item in a transaction
    const item = await db.$transaction(async (tx) => {
      // Update modifier group associations if provided
      if (body.modifierGroupIds !== undefined) {
        await tx.menuItemModifierGroup.deleteMany({ where: { menuItemId: id } })
        if (body.modifierGroupIds.length > 0) {
          await tx.menuItemModifierGroup.createMany({
            data: body.modifierGroupIds.map((groupId: string, i: number) => ({
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

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error updating menu item:', error)
    return NextResponse.json({ error: 'Failed to update menu item' }, { status: 500 })
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

    await db.menuItem.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting menu item:', error)
    return NextResponse.json({ error: 'Failed to delete menu item' }, { status: 500 })
  }
}
