import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    // Update modifier group associations if provided
    if (body.modifierGroupIds !== undefined) {
      await db.menuItemModifierGroup.deleteMany({ where: { menuItemId: id } })
      if (body.modifierGroupIds.length > 0) {
        await db.menuItemModifierGroup.createMany({
          data: body.modifierGroupIds.map((groupId: string, i: number) => ({
            menuItemId: id,
            modifierGroupId: groupId,
            sortOrder: i,
          })),
        })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.price !== undefined) updateData.price = body.price
    if (body.image !== undefined) updateData.image = body.image
    if (body.isAvailable !== undefined) updateData.isAvailable = body.isAvailable
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId

    const item = await db.menuItem.update({
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
    return NextResponse.json(item)
  } catch (error) {
    console.error('Error updating menu item:', error)
    return NextResponse.json({ error: 'Failed to update menu item' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.menuItem.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting menu item:', error)
    return NextResponse.json({ error: 'Failed to delete menu item' }, { status: 500 })
  }
}
