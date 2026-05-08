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
    if (body.customerName !== undefined) updateData.customerName = body.customerName
    if (body.customerPhone !== undefined) updateData.customerPhone = body.customerPhone
    if (body.customerEmail !== undefined) updateData.customerEmail = body.customerEmail
    if (body.pointsBalance !== undefined) updateData.pointsBalance = body.pointsBalance
    if (body.lifetimePoints !== undefined) updateData.lifetimePoints = body.lifetimePoints
    if (body.tier !== undefined) updateData.tier = body.tier
    if (body.isActive !== undefined) updateData.isActive = body.isActive

    // If a loyalty transaction is included, create it
    if (body.transaction) {
      const tx = body.transaction
      await db.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: id,
          type: tx.type,
          points: tx.points,
          reason: tx.reason || '',
          orderId: tx.orderId || null,
          checkId: tx.checkId || null,
          monetaryValue: tx.monetaryValue || 0,
        },
      })
    }

    const account = await db.loyaltyAccount.update({
      where: { id },
      data: updateData,
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })

    return NextResponse.json(account)
  } catch (error) {
    console.error('Failed to update loyalty account:', error)
    return NextResponse.json({ error: 'Failed to update loyalty account' }, { status: 500 })
  }
}
