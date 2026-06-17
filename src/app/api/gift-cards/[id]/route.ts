import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateGiftCardSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { toNum, greaterThan, deepToNumbers } from '@/lib/decimal'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    // FIX C-05: Zahtevaj avtentikacijo za spreminjanje kartice
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateGiftCardSchema, bodyResult.data)
    if (validationError) return validationError
    const existing = await db.giftCard.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Darilna kartica ni najdena' }, { status: 404 })
    }
    // FIX MEDIUM: Preveri, da kartica ni potekla ali suspendirana — ne dovoli sprememb
    if (existing.status === 'suspended') {
      return NextResponse.json({ error: 'Suspendirane kartice ni mogoče spreminjati' }, { status: 400 })
    }
    if (existing.expiresAt && existing.expiresAt < new Date() && existing.status !== 'expired') {
      // Avtomatsko označi kot poteklo
      await db.giftCard.update({ where: { id }, data: { status: 'expired' } })
      return NextResponse.json({ error: 'Darilna kartica je potekla' }, { status: 400 })
    }
    // FIX H-05: Atomna transakcija za posodobitev stanja + transakcijski zapis
    const _result = await db.$transaction(async (tx) => {
      // FIX H-01: Ponovno preberi kartico ZNOTRAJ transakcije — prepreči TOCTOU
      const existing = await tx.giftCard.findUnique({ where: { id } })
      if (!existing) {
        throw new Error('Darilna kartica ni najdena')
      }
      const updateData: Record<string, unknown> = {}
      if (data.status !== undefined) updateData.status = data.status
      if (data.ownerName !== undefined) updateData.ownerName = data.ownerName
      if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null
      // FIX CRITICAL: Atomna sprememba stanja — prepreči race condition
      if (data.balance !== undefined) {
        const diff = data.balance - toNum(existing.balance) // FIX: Decimal→number pretvorba
        if (diff > 0) {
          // Nalaganje — atomno povečaj
          updateData.balance = { increment: diff }
        } else if (diff < 0) {
          // Poraba/unovčitev — preveri, da stanje ne pade pod 0
          const absDiff = Math.abs(diff)
          const result = await tx.giftCard.updateMany({
            where: { id, balance: { gte: absDiff } },
            data: { balance: { decrement: absDiff } },
          })
          if (result.count === 0) {
            throw new Error('Insufficient gift card balance')
          }
          // Preveri novo stanje za status
          const updated = await tx.giftCard.findUnique({ where: { id } })
          if (updated && !greaterThan(updated.balance, 0)) { // FIX: Decimal primerjava
            updateData.status = 'depleted'
          }
          // Skip the normal balance update below since we already did it atomically
          delete updateData.balance
        }
        // diff === 0: no balance change needed
        if (diff > 0 && existing.status === 'depleted') {
          // Če se kartica ponovno naloži, spremeni status nazaj na active
          updateData.status = 'active'
        }
        // FIX: Stanje ne sme preseči začetne vrednosti kartice (za load)
        if (diff > 0) {
          const maxBalance = toNum(existing.initialBalance) > 0 ? existing.initialBalance : existing.balance // FIX: Decimal(0) je truthy!
          // Če bi preseglo max, omeji increment
          if (toNum(existing.balance) + diff > toNum(maxBalance)) {
            throw new Error('Balance would exceed initial card value')
          }
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
            balanceAfter: txData.balanceAfter ?? toNum(giftCard.balance),
            orderId: txData.orderId || null,
            checkId: txData.checkId || null,
            note: txData.note || '',
          },
        })
      } else if (data.balance !== undefined && data.balance !== toNum(existing.balance)) { // FIX: Decimal primerjava
        // Avtomatsko ustvari transakcijski zapis za spremembo stanja
        const diff = data.balance - toNum(existing.balance) // FIX: Decimal→number
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
    return NextResponse.json(deepToNumbers(giftCard))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/gift-cards/[id]', 'Napaka pri posodobitvi darilne kartice')
  }
}
