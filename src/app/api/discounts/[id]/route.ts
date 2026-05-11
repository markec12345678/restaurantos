import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo za posodobitev popusta
    const authResult = await requireAuth(req, { permission: 'apply_discounts' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const body = await req.json()

    // FIX C-06: currentUses ni mogoče nastaviti neposredno
    if (body.currentUses !== undefined) {
      return NextResponse.json({ error: 'currentUses ni mogoče nastaviti neposredno' }, { status: 400 })
    }

    // FIX C-06: currentUses removed from client-settable fields
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.type !== undefined) updateData.type = body.type
    if (body.amount !== undefined) updateData.amount = body.amount
    if (body.appliesTo !== undefined) updateData.appliesTo = body.appliesTo
    if (body.triggerType !== undefined) updateData.triggerType = body.triggerType
    if (body.promoCode !== undefined) updateData.promoCode = body.promoCode
    if (body.maxUses !== undefined) updateData.maxUses = body.maxUses
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
    // FIX C-05: Zahtevaj admin avtentikacijo za brisanje popusta
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params

    // FIX C-06: Soft delete namesto hard delete
    await db.discount.update({ where: { id }, data: { isActive: false } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete discount:', error)
    return NextResponse.json({ error: 'Failed to delete discount' }, { status: 500 })
  }
}
