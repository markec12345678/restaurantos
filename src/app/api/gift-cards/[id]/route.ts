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
    if (body.balance !== undefined) updateData.balance = body.balance
    if (body.status !== undefined) updateData.status = body.status
    if (body.ownerName !== undefined) updateData.ownerName = body.ownerName
    if (body.expiresAt !== undefined) updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null

    // If a gift card transaction is included, create it
    if (body.transaction) {
      const tx = body.transaction
      await db.giftCardTransaction.create({
        data: {
          giftCardId: id,
          type: tx.type,
          amount: tx.amount,
          balanceAfter: tx.balanceAfter || body.balance || 0,
          orderId: tx.orderId || null,
          checkId: tx.checkId || null,
          note: tx.note || '',
        },
      })
    }

    const giftCard = await db.giftCard.update({
      where: { id },
      data: updateData,
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })

    return NextResponse.json(giftCard)
  } catch (error) {
    console.error('Failed to update gift card:', error)
    return NextResponse.json({ error: 'Failed to update gift card' }, { status: 500 })
  }
}
