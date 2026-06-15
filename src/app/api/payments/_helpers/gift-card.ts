// Pomožne funkcije za Payments API — Darilna kartica

import { Prisma } from '@prisma/client'
import { toNum, greaterThan } from '@/lib/decimal'
import type { PaymentInput } from './types'

// ─── Darilna kartica — upravljaj znotraj transakcije ────────

export async function handleGiftCardDeduction(
  tx: Prisma.TransactionClient,
  data: PaymentInput,
  checkOrderId: string | null,
): Promise<void> {
  if (data.type !== 'giftcard' || !data.giftCardId) return

  const giftCard = await tx.giftCard.findUnique({ where: { id: data.giftCardId } })
  if (!giftCard) {
    throw new Error('Darilna kartica ni najdena')
  }
  if (giftCard.status !== 'active') {
    throw new Error('Darilna kartica ni aktivna')
  }
  // FIX HIGH: Preveri, da kartica ni potekla
  if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
    await tx.giftCard.update({
      where: { id: data.giftCardId },
      data: { status: 'expired' },
    })
    throw new Error('Darilna kartica je potekla')
  }
  if (toNum(giftCard.balance) < toNum(data.amount)) {
    // FIX CRITICAL: Kartica nima dovolj sredstev za celoten znesek plačila.
    // Zavrnemo plačilo — klient mora poslati pravilen znesek (<= balance).
    // Delno plačilo z darilno kartico zahteva ločen POST z zneskom <= balance.
    throw new Error(`Stanje darilne kartice (${toNum(giftCard.balance).toFixed(2)} EUR) ni zadostno za plačilo ${toNum(data.amount).toFixed(2)} EUR. Posljite plačilo z zneskom ${toNum(giftCard.balance).toFixed(2)} EUR ali manj.`)
  }

  // Atomic decrement with balance check to prevent race conditions
  const updateResult = await tx.giftCard.updateMany({
    where: { id: data.giftCardId, balance: { gte: data.amount } },
    data: { balance: { decrement: data.amount } },
  })
  if (updateResult.count === 0) {
    throw new Error('Stanje darilne kartice ni zadostno ali je bilo spremenjeno')
  }

  // Check if card is now depleted
  const updatedCard = await tx.giftCard.findUnique({ where: { id: data.giftCardId } })
  if (updatedCard && !greaterThan(updatedCard.balance, 0)) {
    await tx.giftCard.update({ where: { id: data.giftCardId }, data: { status: 'depleted' } })
  }

  const newBalance = toNum(updatedCard?.balance)
  await tx.giftCardTransaction.create({
    data: {
      giftCardId: data.giftCardId,
      type: 'redeem',
      amount: -data.amount,
      balanceAfter: newBalance,
      orderId: checkOrderId || null,
      checkId: data.checkId,
      note: `Plačilo naročila`,
    },
  })
}
