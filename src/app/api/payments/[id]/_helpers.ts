// Pomožne funkcije za posodabljanje plačil
// PUT /api/payments/[id] — pomožni modul za reversal logiko in transakcije

import { db } from '@/lib/db'
import { deepToNumbers, sumBy, greaterThanOrEqual, subtract, toNum, isPositive, round2 } from '@/lib/decimal'

// ─── Obrni darilno kartico ob povračilu ───
export async function reverseGiftCard(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  existingPayment: {
    type: string
    giftCardId: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    amount: any
    checkId: string
  },
  paymentId: string,
): Promise<void> {
  if (existingPayment.type !== 'giftcard' || !existingPayment.giftCardId) return

  // FIX CRITICAL: Validate card status before refunding balance
  const giftCard = await tx.giftCard.findUnique({ where: { id: existingPayment.giftCardId } })
  if (!giftCard) {
    throw new Error('Darilna kartica ni najdena — vračilo ni mogoče')
  }

  // Allow refund to active cards; for suspended/expired, only allow if card was active at payment time
  if (giftCard.status === 'suspended') {
    throw new Error('Darilna kartica je suspendirana — obrnite se na upravitelja za vračilo')
  }

  const updatedGiftCard = await tx.giftCard.update({
    where: { id: existingPayment.giftCardId },
    data: { balance: { increment: existingPayment.amount } },
  })

  // If card was depleted and now has balance, reactivate it
  if (giftCard.status === 'depleted' && isPositive(updatedGiftCard.balance)) {
    await tx.giftCard.update({
      where: { id: existingPayment.giftCardId },
      data: { status: 'active' },
    })
  }
  await tx.giftCardTransaction.create({
    data: {
      giftCardId: existingPayment.giftCardId,
      type: 'adjust',
      amount: existingPayment.amount,
      balanceAfter: updatedGiftCard.balance,
      checkId: existingPayment.checkId,
      note: `Vračilo/poničitev plačila ${paymentId}`,
    },
  })
}

// ─── Obrni zvestobne točke ob povračilu ───
export async function reverseLoyaltyPoints(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  existingPayment: {
    type: string
    loyaltyAccountId: string | null
    loyaltyPointsUsed: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    amount: any
    checkId: string
  },
  paymentId: string,
): Promise<void> {
  if (existingPayment.type !== 'loyalty' || !existingPayment.loyaltyAccountId || existingPayment.loyaltyPointsUsed <= 0) return

  // FIX HIGH: Fetch account first to validate before incrementing
  const loyaltyAccount = await tx.loyaltyAccount.findUnique({
    where: { id: existingPayment.loyaltyAccountId },
  })
  if (!loyaltyAccount || !loyaltyAccount.isActive) {
    throw new Error('Zvestobni račun ni aktiven — vračilo točk ni mogoče')
  }

  const returnedPoints = existingPayment.loyaltyPointsUsed
  // FIX HIGH: Validate that returned points won't push pointsBalance above lifetimePoints
  if (loyaltyAccount.pointsBalance + returnedPoints > loyaltyAccount.lifetimePoints) {
    throw new Error('Vračilo točk presega lifetimePoints — vračilo ni mogoče')
  }

  await tx.loyaltyAccount.update({
    where: { id: existingPayment.loyaltyAccountId },
    data: { pointsBalance: { increment: returnedPoints } },
  })

  const monetaryValue = round2(
    (returnedPoints / existingPayment.loyaltyPointsUsed) * toNum(existingPayment.amount)
  )

  await tx.loyaltyTransaction.create({
    data: {
      loyaltyAccountId: existingPayment.loyaltyAccountId,
      type: 'adjust',
      points: returnedPoints,
      reason: `Vračilo/poničitev plačila ${paymentId}`,
      checkId: existingPayment.checkId,
      monetaryValue,
    },
  })
}

// ─── Preračunaj paymentStatus za check in order po povračilu ───
export async function recalculatePaymentStatus(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  existingPayment: {
    checkId: string
    check?: { orderId?: string }
  },
  checkForDiscount: { orderId?: string | null } | null,
): Promise<void> {
  const checkId = existingPayment.checkId

  // Recalculate check paymentStatus
  const allPayments = await tx.payment.findMany({
    where: { checkId, status: 'completed' },
  })
  const totalPaid = sumBy(allPayments, p => p.amount)
  const check = await tx.check.findUnique({ where: { id: checkId } })

  let paymentStatus = 'unpaid'
  if (check) {
    if (greaterThanOrEqual(totalPaid, subtract(check.total, 0.01))) {
      paymentStatus = 'paid'
    } else if (toNum(totalPaid) > 0) {
      paymentStatus = 'partial'
    }
  }

  await tx.check.update({
    where: { id: checkId },
    data: { paymentStatus },
  })

  // FIX CRITICAL: Recalculate ORDER paymentStatus after refund/void
  const orderId = checkForDiscount?.orderId || existingPayment.check?.orderId
  if (orderId) {
    const allOrderChecks = await tx.check.findMany({ where: { orderId } })
    const allPaid = allOrderChecks.every(c => c.paymentStatus === 'paid')
    const anyPartial = allOrderChecks.some(c => c.paymentStatus === 'partial')
    const orderPaymentStatus = allPaid ? 'paid' : anyPartial ? 'partial' : 'unpaid'
    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: orderPaymentStatus,
        ...(orderPaymentStatus === 'unpaid' ? { paidAt: null } : {}),
      },
    })
  }
}

// Re-export deepToNumbers for convenience
export { deepToNumbers }
