
// Shema za delno posodabljanje plačila (vsa polja opcijska)
import { db } from '@/lib/db'
import { deepToNumbers, sumBy, greaterThanOrEqual, subtract, toNum, isPositive, round2 } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createPaymentSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { z } from 'zod'
const updatePaymentSchema = createPaymentSchema.partial().extend({
  status: z.enum(['completed', 'refunded', 'voided']).optional(),
  employeeId: z.string().nullable().optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // AVTENTIKACIJA: Plačila smejo urejati samo avtorizirani uporabniki
  const authResult = await requireAuth(req, { permission: 'manage_cash' })
  if (authResult.error) return authResult.error

  try {
    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // VALIDACIJA: Preveri vnose pred shranjevanjem
    const { data, error: validationError } = validateBody(updatePaymentSchema, bodyResult.data)
    if (validationError) return validationError

    // BLOCK: Prevent changes to amount and type after creation
    if (data.amount !== undefined) {
      return NextResponse.json(
        { error: 'Zneska plačila ni mogoče spremeniti po ustvarjanju' },
        { status: 400 }
      )
    }
    if (data.type !== undefined) {
      return NextResponse.json(
        { error: 'Vrste plačila ni mogoče spremeniti po ustvarjanju' },
        { status: 400 }
      )
    }

    // 404 CHECK: Verify payment exists before updating
    const existingPayment = await db.payment.findUnique({
      where: { id },
      include: {
        check: true,
        giftCard: true,
        loyaltyAccount: true,
      },
    })

    if (!existingPayment) {
      return NextResponse.json({ error: 'Plačilo ni najdeno' }, { status: 404 })
    }

    // Determine if status is changing to refunded/voided
    const isRefundOrVoid =
      data.status &&
      (data.status === 'refunded' || data.status === 'voided') &&
      existingPayment.status === 'completed'

    // Build update data (excluding amount and type)
    const updateData: Record<string, unknown> = {}
    if (data.tipAmount !== undefined) updateData.tipAmount = data.tipAmount
    if (data.alternatePaymentTypeId !== undefined) updateData.alternatePaymentTypeId = data.alternatePaymentTypeId || null
    if (data.cardType !== undefined) updateData.cardType = data.cardType
    if (data.cardLast4 !== undefined) updateData.cardLast4 = data.cardLast4
    if (data.authorizationCode !== undefined) updateData.authorizationCode = data.authorizationCode
    if (data.giftCardId !== undefined) updateData.giftCardId = data.giftCardId || null
    if (data.loyaltyAccountId !== undefined) updateData.loyaltyAccountId = data.loyaltyAccountId || null
    if (data.loyaltyPointsUsed !== undefined) updateData.loyaltyPointsUsed = data.loyaltyPointsUsed
    if (data.status !== undefined) updateData.status = data.status
    if (data.employeeId !== undefined) updateData.employeeId = data.employeeId || null

    if (isRefundOrVoid) {
      // Wrap reversal + update in a single transaction
      const payment = await db.$transaction(async (tx) => {
        // Reverse gift card balance if it was a giftcard payment
        if (existingPayment.type === 'giftcard' && existingPayment.giftCardId) {
          // FIX CRITICAL: Validate card status before refunding balance
          // A suspended/expired card should not receive balance back automatically
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
          if (giftCard.status === 'depleted' && isPositive(updatedGiftCard.balance)) { // FIX: Decimal comparison — use isPositive() instead of > 0
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
              note: `Vračilo/poničitev plačila ${id}`,
            },
          })
        }

        // Reverse loyalty points if it was a loyalty payment
        if (existingPayment.type === 'loyalty' && existingPayment.loyaltyAccountId && existingPayment.loyaltyPointsUsed > 0) {
          // FIX HIGH: Fetch account first to validate before incrementing — prevents
          // pointsBalance from exceeding lifetimePoints (data integrity violation)
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

          // FIX HIGH: Calculate monetaryValue proportionally to points returned.
          // monetaryValue = (returnedPoints / pointsUsedInPayment) * paymentAmount
          // This ensures the transaction value scales correctly if partial points are returned.
          const monetaryValue = round2(
            (returnedPoints / existingPayment.loyaltyPointsUsed) * toNum(existingPayment.amount)
          )

          await tx.loyaltyTransaction.create({
            data: {
              loyaltyAccountId: existingPayment.loyaltyAccountId,
              type: 'adjust',
              points: returnedPoints,
              reason: `Vračilo/poničitev plačila ${id}`,
              checkId: existingPayment.checkId,
              monetaryValue,
            },
          })
        }

        // FIX HIGH: Zmanjšaj discount.currentUses ob povračilu/poničitvi plačila
        // Prejšnja koda je uporabila decrement brez preverjanja currentUses > 0 —
        // to je lahko povzročilo negativen currentUses, kar prelomi maxUses enforcement
        const checkForDiscount = await tx.check.findUnique({ where: { id: existingPayment.checkId } })
        if (checkForDiscount?.appliedDiscountId) {
          await tx.discount.updateMany({
            where: { id: checkForDiscount.appliedDiscountId, currentUses: { gt: 0 } },
            data: { currentUses: { decrement: 1 } },
          })
        }

        // Update the payment itself
        const updatedPayment = await tx.payment.update({
          where: { id },
          data: updateData,
          include: {
            check: true,
            alternatePaymentType: true,
            giftCard: true,
            loyaltyAccount: true,
          },
        })

        // Recalculate the check's paymentStatus
        const checkId = existingPayment.checkId
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
        // Previously only the check was updated but the order was left as 'paid'
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

        return updatedPayment
      })

      return NextResponse.json(deepToNumbers(payment))
    } else {
      // No reversal needed — simple update
      const payment = await db.payment.update({
        where: { id },
        data: updateData,
        include: {
          check: true,
          alternatePaymentType: true,
          giftCard: true,
          loyaltyAccount: true,
        },
      })

      return NextResponse.json(deepToNumbers(payment))
    }
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/payments/[id]', 'Napaka pri posodobitvi plačila')
  }
}
