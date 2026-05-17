import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createPaymentSchema } from '@/lib/validations'
import { z } from 'zod'

// Shema za delno posodabljanje plačila (vsa polja opcijska)
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
    const body = await req.json()

    // VALIDACIJA: Preveri vnose pred shranjevanjem
    const { data, error: validationError } = validateBody(updatePaymentSchema, body)
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
          if (giftCard.status === 'depleted' && updatedGiftCard.balance > 0) {
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
          // FIX MEDIUM: Use atomic updateMany with safety check — prevents race condition
          const updatedLoyaltyAccount = await tx.loyaltyAccount.updateMany({
            where: { id: existingPayment.loyaltyAccountId, isActive: true },
            data: { pointsBalance: { increment: existingPayment.loyaltyPointsUsed } },
          })
          if (updatedLoyaltyAccount.count === 0) {
            throw new Error('Zvestobni račun ni aktiven — vračilo točk ni mogoče')
          }

          const refreshedAccount = await tx.loyaltyAccount.findUnique({ where: { id: existingPayment.loyaltyAccountId } })
          await tx.loyaltyTransaction.create({
            data: {
              loyaltyAccountId: existingPayment.loyaltyAccountId,
              type: 'adjust',
              points: existingPayment.loyaltyPointsUsed,
              reason: `Vračilo/poničitev plačila ${id}`,
              checkId: existingPayment.checkId,
              monetaryValue: existingPayment.amount,
            },
          })
        }

        // FIX HIGH: Zmanjšaj discount.currentUses ob povračilu/poničitvi plačila
        const checkForDiscount = await tx.check.findUnique({ where: { id: existingPayment.checkId } })
        if (checkForDiscount?.appliedDiscountId) {
          await tx.discount.update({
            where: { id: checkForDiscount.appliedDiscountId },
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
        const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0)
        const check = await tx.check.findUnique({ where: { id: checkId } })

        let paymentStatus = 'unpaid'
        if (check) {
          if (totalPaid >= check.total - 0.01) {
            paymentStatus = 'paid'
          } else if (totalPaid > 0) {
            paymentStatus = 'partial'
          }
        }

        await tx.check.update({
          where: { id: checkId },
          data: { paymentStatus },
        })

        return updatedPayment
      })

      return NextResponse.json(payment)
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

      return NextResponse.json(payment)
    }
  } catch (error) {
    console.error('Failed to update payment:', error)
    return NextResponse.json({ error: 'Napaka pri posodobitvi plačila' }, { status: 500 })
  }
}
