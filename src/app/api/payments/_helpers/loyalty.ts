// Pomožne funkcije za Payments API — Zvestobne točke

import { Prisma } from '@prisma/client'
import { toNum, round2, subtract } from '@/lib/decimal'
import type { PaymentInput } from './types'

// ─── Zvestobne točke — odbitje znotraj transakcije ──────────

export async function handleLoyaltyPointsDeduction(
  tx: Prisma.TransactionClient,
  data: PaymentInput,
  checkOrderId: string | null,
): Promise<void> {
  if (data.type !== 'loyalty' || !data.loyaltyAccountId || data.loyaltyPointsUsed <= 0) return

  // OPTIMIZACIJA: select namesto privzetega include — potrebujemo samo isActive in pointsBalance
  const loyaltyAccount = await tx.loyaltyAccount.findUnique({
    where: { id: data.loyaltyAccountId },
    select: { isActive: true, pointsBalance: true },
  })
  if (!loyaltyAccount) {
    throw new Error('Zvestobni račun ni najden')
  }
  // FIX HIGH: Preveri, da je račun aktiven
  if (!loyaltyAccount.isActive) {
    throw new Error('Zvestobni račun ni aktiven')
  }
  if (loyaltyAccount.pointsBalance < data.loyaltyPointsUsed) {
    throw new Error('Ni dovolj točk na zvestobnem računu')
  }

  // FIX: Uporabi atomic decrement namesto read-then-write — prepreči race condition
  const updateResult = await tx.loyaltyAccount.updateMany({
    where: { id: data.loyaltyAccountId, pointsBalance: { gte: data.loyaltyPointsUsed } },
    data: { pointsBalance: { decrement: data.loyaltyPointsUsed } },
  })
  if (updateResult.count === 0) {
    throw new Error('Ni dovolj točk na zvestobnem računu (concurrent modification)')
  }

  await tx.loyaltyTransaction.create({
    data: {
      loyaltyAccountId: data.loyaltyAccountId,
      type: 'redeem',
      points: -data.loyaltyPointsUsed,
      reason: 'Unovčenje točk za plačilo',
      orderId: checkOrderId || null,
      checkId: data.checkId,
      monetaryValue: data.amount,
    },
  })
}

// ─── Zvestobne točke — pridobitev ob plačilu ────────────────

export async function handleLoyaltyEarn(
  tx: Prisma.TransactionClient,
  data: PaymentInput,
  checkOrderId: string | null,
): Promise<void> {
  // FIX HIGH: Samodejno pridobi zvestobne točke ob plačilu — loyalty earn
  if (!data.loyaltyAccountId || data.type === 'loyalty') return

  const settings = await tx.restaurantSettings.findFirst({ where: { isActive: true } })
  if (!settings?.loyaltyEnabled) return

  const pointsPerEuro = toNum(settings.loyaltyPointsPerEuro) || 1
  // Točke se računajo po znesku plačila (brez napitnine)
  const earnBase = round2(subtract(toNum(data.amount), toNum(data.tipAmount)))
  const pointsToEarn = Math.max(0, Math.floor(earnBase * pointsPerEuro))

  if (pointsToEarn <= 0) return

  // Atomic increment — prepreči race condition
  await tx.loyaltyAccount.updateMany({
    where: { id: data.loyaltyAccountId, isActive: true },
    data: {
      pointsBalance: { increment: pointsToEarn },
      lifetimePoints: { increment: pointsToEarn },
    },
  })

  await tx.loyaltyTransaction.create({
    data: {
      loyaltyAccountId: data.loyaltyAccountId,
      type: 'earn',
      points: pointsToEarn,
      reason: `Točke za plačilo ${toNum(data.amount).toFixed(2)} EUR`,
      orderId: checkOrderId || null,
      checkId: data.checkId,
      monetaryValue: earnBase,
    },
  })
}
