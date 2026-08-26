// POST /api/payments/[id]/refund — Delno ali popolno povračilo plačila
// FIX BUG-PAY-1: Prej je refund samo posodobil refundAmount, brez reversal side-effects.
// Sedaj reverzira: gift card, loyalty points, check/order status, discount counter.
import { db, createAuditLog } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const refundSchema = z.object({
  amount: z.number().positive('Znesek povračila mora biti pozitiven'),
  reason: z.string().max(500).default(''),
  employeeId: z.string().nullable().optional(),
})

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Manjkajoči podatki' }, { status: 400 })

    const { amount, reason, employeeId } = refundSchema.parse(body)

    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        check: { include: { order: true } },
        giftCard: true,
        loyaltyAccount: true,
      },
    })
    if (!payment) return NextResponse.json({ error: 'Plačilo ni najdeno' }, { status: 404 })

    const currentRefunded = toNum(payment.refundAmount)
    const maxRefundable = toNum(payment.amount) - currentRefunded
    if (amount > maxRefundable) {
      return NextResponse.json(
        { error: `Znesek povračila (€${amount.toFixed(2)}) presega max povračilo (€${maxRefundable.toFixed(2)})` },
        { status: 400 }
      )
    }

    // FIX BUG-PAY-1: Transakcija z vsemi reversal side-effects
    const updated = await db.$transaction(async (tx) => {
      const newRefundAmount = currentRefunded + amount
      const isFullyRefunded = newRefundAmount >= toNum(payment.amount)
      const refundRatio = amount / toNum(payment.amount) // razmerje za delne reverze

      // 1. Posodobi Payment
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          refundAmount: newRefundAmount,
          ...(isFullyRefunded ? { status: 'refunded' } : {}),
        },
      })

      // 2. FIX: Reverziraj gift card (če je bilo plačilo z gift card)
      if (payment.giftCardId && payment.type === 'giftcard') {
        const refundToGiftCard = round2(amount)
        const currentBalance = await tx.giftCard.findUnique({
          where: { id: payment.giftCardId },
          select: { balance: true },
        })
        await tx.giftCard.update({
          where: { id: payment.giftCardId },
          data: { balance: { increment: refundToGiftCard } },
        })
        await tx.giftCardTransaction.create({
          data: {
            giftCardId: payment.giftCardId,
            type: 'load',
            amount: refundToGiftCard,
            balanceAfter: toNum(currentBalance?.balance) + refundToGiftCard,
            note: `REFUND: ${reason || 'Povračilo plačila'}`,
          },
        })
        logger.info('REFUND', `Gift card ${payment.giftCardId} rechargeana za €${refundToGiftCard}`)
      }

      // 3. FIX: Reverziraj loyalty točke (če je bilo plačilo z loyalty)
      if (payment.loyaltyAccountId && payment.type === 'loyalty' && payment.loyaltyPointsUsed > 0) {
        const pointsToRefund = Math.round(payment.loyaltyPointsUsed * refundRatio)
        await tx.loyaltyAccount.update({
          where: { id: payment.loyaltyAccountId },
          data: { pointsBalance: { increment: pointsToRefund } },
        })
        await tx.loyaltyTransaction.create({
          data: {
            loyaltyAccountId: payment.loyaltyAccountId,
            type: 'adjust',
            points: pointsToRefund,
            reason: `REFUND: Vračilo ${pointsToRefund} točk za povračilo plačila`,
          },
        })
        logger.info('REFUND', `Loyalty ${payment.loyaltyAccountId}: vrnjenih ${pointsToRefund} točk`)
      }

      // 4. FIX: Reverziraj earned loyalty točke (če je popoln refund)
      if (isFullyRefunded && payment.check?.order?.guestId) {
        const earnedPoints = Math.floor(toNum(payment.amount) * 0.01)
        if (earnedPoints > 0) {
          // FIX: guestId ne obstaja na LoyaltyAccount — uporabimo guest relacijo
          const loyaltyAccount = await tx.loyaltyAccount.findFirst({
            where: { guest: { id: payment.check.order.guestId } },
          })
          if (loyaltyAccount) {
            await tx.loyaltyAccount.update({
              where: { id: loyaltyAccount.id },
              data: {
                pointsBalance: { decrement: earnedPoints },
                lifetimePoints: { decrement: earnedPoints },
              },
            })
            await tx.loyaltyTransaction.create({
              data: {
                loyaltyAccountId: loyaltyAccount.id,
                type: 'adjust',
                points: -earnedPoints,
                reason: `REFUND: Odvzetje ${earnedPoints} earned točk ob povračilu`,
              },
            })
          }
        }
      }

      // 5. FIX: Posodobi Check paymentStatus
      if (payment.checkId) {
        const totalCheckPaid = await tx.payment.aggregate({
          where: { checkId: payment.checkId, status: 'completed' },
          _sum: { amount: true },
        })
        const totalRefunded = await tx.payment.aggregate({
          where: { checkId: payment.checkId },
          _sum: { refundAmount: true },
        })
        const netPaid = toNum(totalCheckPaid._sum.amount) - toNum(totalRefunded._sum.refundAmount)
        const checkTotal = toNum(payment.check.total)

        let checkStatus = 'paid'
        if (netPaid <= 0) checkStatus = 'unpaid'
        else if (netPaid < checkTotal) checkStatus = 'partial'

        await tx.check.update({
          where: { id: payment.checkId },
          data: { paymentStatus: checkStatus },
        })

        // 6. FIX: Posodobi Order paymentStatus
        if (payment.check.orderId) {
          await tx.order.update({
            where: { id: payment.check.orderId },
            data: { paymentStatus: checkStatus },
          })
        }
      }

      // 7. Audit log
      await tx.auditLog.create({
        data: {
          userId: employeeId || authResult.session?.employeeId || null,
          action: 'REFUND_PAYMENT',
          entityType: 'Payment',
          entityId: id,
          details: JSON.stringify({
            amount, reason, previousRefund: currentRefunded, newRefund: newRefundAmount,
            fullyRefunded: isFullyRefunded,
            giftCardReversed: !!payment.giftCardId,
            loyaltyReversed: !!payment.loyaltyAccountId,
            checkUpdated: !!payment.checkId,
          }),
          ipAddress: '',
        },
      })

      return updatedPayment
    })

    return NextResponse.json({
      success: true,
      payment: { ...updated, refundAmount: toNum(updated.refundAmount) },
      refundAmount: amount,
      totalRefunded: currentRefunded + amount,
      fullyRefunded: toNum(updated.refundAmount) >= toNum(payment.amount),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/payments/[id]/refund', 'Napaka pri povračilu plačila')
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
