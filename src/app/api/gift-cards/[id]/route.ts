import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, updateGiftCardSchema } from '@/lib/validations'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    // FIX C-05: Zahtevaj avtentikacijo za spreminjanje kartice
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateGiftCardSchema, body)
    if (validationError) return validationError

    const existing = await db.giftCard.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Darilna kartica ni najdena' }, { status: 404 })
    }

    // FIX H-05: Atomna transakcija za posodobitev stanja + transakcijski zapis
    const result = await db.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {}
      if (data.status !== undefined) updateData.status = data.status
      if (data.ownerName !== undefined) updateData.ownerName = data.ownerName
      if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null

      // Če se stanje spreminja, uporabi varno posodobitev
      if (data.balance !== undefined) {
        const newBalance = Math.max(0, data.balance)
        // FIX MEDIUM: Stanje ne sme preseči začetne vrednosti kartice
        const maxBalance = existing.initialBalance || existing.balance
        const safeBalance = Math.min(newBalance, maxBalance)
        updateData.balance = safeBalance
        if (safeBalance <= 0) {
          updateData.status = 'depleted'
        } else if (existing.status === 'depleted' && safeBalance > 0) {
          // Če se kartica ponovno naloži, spremeni status nazaj na active
          updateData.status = 'active'
        }
      }

      const giftCard = await tx.giftCard.update({
        where: { id },
        data: updateData,
      })

      // Ustvari transakcijski zapis, če je podan
      if (data.transaction) {
        const txData = data.transaction
        await tx.giftCardTransaction.create({
          data: {
            giftCardId: id,
            type: txData.type,
            amount: txData.amount,
            balanceAfter: txData.balanceAfter || giftCard.balance,
            orderId: txData.orderId || null,
            checkId: txData.checkId || null,
            note: txData.note || '',
          },
        })
      } else if (data.balance !== undefined && data.balance !== existing.balance) {
        // Avtomatsko ustvari transakcijski zapis za spremembo stanja
        const diff = data.balance - existing.balance
        await tx.giftCardTransaction.create({
          data: {
            giftCardId: id,
            type: diff > 0 ? 'load' : 'redeem',
            amount: diff,
            balanceAfter: giftCard.balance,
            note: diff > 0 ? 'Nalaganje sredstev' : 'Razveljavitev',
          },
        })
      }

      return giftCard
    })

    // Re-fetch z transakcijami
    const giftCard = await db.giftCard.findUnique({
      where: { id },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } },
    })

    return NextResponse.json(giftCard)
  } catch (error) {
    console.error('Failed to update gift card:', error)
    return NextResponse.json({ error: 'Failed to update gift card' }, { status: 500 })
  }
}
