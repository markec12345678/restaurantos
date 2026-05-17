import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, updateLoyaltySchema } from '@/lib/validations'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateLoyaltySchema, body)
    if (validationError) return validationError

    const existing = await db.loyaltyAccount.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Zvestobni račun ni najden' }, { status: 404 })
    }

    // FIX H-05: Atomna transakcija za posodobitev točk + transakcijski zapis
    const result = await db.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {}
      if (data.customerName !== undefined) updateData.customerName = data.customerName
      if (data.customerPhone !== undefined) updateData.customerPhone = data.customerPhone
      if (data.customerEmail !== undefined) updateData.customerEmail = data.customerEmail
      if (data.tier !== undefined) updateData.tier = data.tier
      if (data.isActive !== undefined) updateData.isActive = data.isActive

      if (data.pointsBalance !== undefined) {
        const newPoints = Math.max(0, data.pointsBalance)
        updateData.pointsBalance = newPoints
        // FIX MEDIUM: Ko se točke povečajo, posodobi tudi lifetimePoints
        if (newPoints > existing.pointsBalance) {
          const earnedPoints = newPoints - existing.pointsBalance
          updateData.lifetimePoints = (data.lifetimePoints !== undefined 
            ? Math.max(0, data.lifetimePoints) 
            : existing.lifetimePoints) + earnedPoints
        }
      }

      if (data.lifetimePoints !== undefined) {
        updateData.lifetimePoints = Math.max(0, data.lifetimePoints)
      }

      const account = await tx.loyaltyAccount.update({
        where: { id },
        data: updateData,
      })

      // Ustvari transakcijski zapis, če je podan
      if (data.transaction) {
        const txData = data.transaction
        await tx.loyaltyTransaction.create({
          data: {
            loyaltyAccountId: id,
            type: txData.type,
            points: txData.points,
            reason: txData.reason || '',
            orderId: txData.orderId || null,
            checkId: txData.checkId || null,
            monetaryValue: txData.monetaryValue || 0,
          },
        })
      } else if (data.pointsBalance !== undefined && data.pointsBalance !== existing.pointsBalance) {
        // Avtomatsko ustvari transakcijski zapis za spremembo točk
        const diff = data.pointsBalance - existing.pointsBalance
        await tx.loyaltyTransaction.create({
          data: {
            loyaltyAccountId: id,
            type: diff > 0 ? 'earn' : 'redeem',
            points: diff,
            reason: diff > 0 ? 'Prislužene točke' : 'Unovčenje točk',
          },
        })
      }

      return account
    })

    // Re-fetch z transakcijami
    const account = await db.loyaltyAccount.findUnique({
      where: { id },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } },
    })

    return NextResponse.json(account)
  } catch (error) {
    console.error('Failed to update loyalty account:', error)
    return NextResponse.json({ error: 'Failed to update loyalty account' }, { status: 500 })
  }
}
