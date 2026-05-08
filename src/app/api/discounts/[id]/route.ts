import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.type !== undefined) updateData.type = body.type
    if (body.amount !== undefined) updateData.amount = body.amount
    if (body.appliesTo !== undefined) updateData.appliesTo = body.appliesTo
    if (body.triggerType !== undefined) updateData.triggerType = body.triggerType
    if (body.promoCode !== undefined) updateData.promoCode = body.promoCode
    if (body.maxUses !== undefined) updateData.maxUses = body.maxUses
    if (body.currentUses !== undefined) updateData.currentUses = body.currentUses
    if (body.validFrom !== undefined) updateData.validFrom = body.validFrom ? new Date(body.validFrom) : null
    if (body.validTo !== undefined) updateData.validTo = body.validTo ? new Date(body.validTo) : null
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder

    const discount = await db.discount.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(discount)
  } catch (error) {
    console.error('Failed to update discount:', error)
    return NextResponse.json({ error: 'Failed to update discount' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await db.discount.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete discount:', error)
    return NextResponse.json({ error: 'Failed to delete discount' }, { status: 500 })
  }
}
