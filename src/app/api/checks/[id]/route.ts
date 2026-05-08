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
    if (body.checkNumber !== undefined) updateData.checkNumber = body.checkNumber
    if (body.subtotal !== undefined) updateData.subtotal = body.subtotal
    if (body.tax !== undefined) updateData.tax = body.tax
    if (body.discount !== undefined) updateData.discount = body.discount
    if (body.serviceCharge !== undefined) updateData.serviceCharge = body.serviceCharge
    if (body.total !== undefined) updateData.total = body.total
    if (body.tip !== undefined) updateData.tip = body.tip
    if (body.totalWithTip !== undefined) updateData.totalWithTip = body.totalWithTip
    if (body.paymentStatus !== undefined) updateData.paymentStatus = body.paymentStatus
    if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod
    if (body.appliedDiscountId !== undefined) updateData.appliedDiscountId = body.appliedDiscountId || null

    const check = await db.check.update({
      where: { id },
      data: updateData,
      include: {
        order: true,
        orderItems: true,
        payments: true,
        appliedDiscount: true,
      },
    })

    return NextResponse.json(check)
  } catch (error) {
    console.error('Failed to update check:', error)
    return NextResponse.json({ error: 'Failed to update check' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Delete related payments first
    await db.payment.deleteMany({ where: { checkId: id } })

    await db.check.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete check:', error)
    return NextResponse.json({ error: 'Failed to delete check' }, { status: 500 })
  }
}
