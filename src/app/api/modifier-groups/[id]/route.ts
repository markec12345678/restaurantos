import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    if (body.modifiers) {
      // Delete existing modifiers and recreate
      await db.modifier.deleteMany({ where: { modifierGroupId: id } })
    }

    const modifierGroup = await db.modifierGroup.update({
      where: { id },
      data: {
        name: body.name,
        required: body.required,
        minSelect: body.minSelect,
        maxSelect: body.maxSelect,
        sortOrder: body.sortOrder,
        ...(body.modifiers ? {
          modifiers: {
            create: body.modifiers.map((m: { name: string; price: number; sortOrder: number }, i: number) => ({
              name: m.name,
              price: m.price || 0,
              sortOrder: m.sortOrder ?? i,
            })),
          },
        } : {}),
      },
      include: { modifiers: true },
    })
    return NextResponse.json(modifierGroup)
  } catch (error) {
    console.error('Error updating modifier group:', error)
    return NextResponse.json({ error: 'Failed to update modifier group' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.modifierGroup.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting modifier group:', error)
    return NextResponse.json({ error: 'Failed to delete modifier group' }, { status: 500 })
  }
}
