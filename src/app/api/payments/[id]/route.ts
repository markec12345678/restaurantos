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

    // Uporabljamo validirane podatke iz Zod sheme
    const updateData: Record<string, unknown> = {}
    if (data.amount !== undefined) updateData.amount = data.amount
    if (data.tipAmount !== undefined) updateData.tipAmount = data.tipAmount
    if (data.type !== undefined) updateData.type = data.type
    if (data.alternatePaymentTypeId !== undefined) updateData.alternatePaymentTypeId = data.alternatePaymentTypeId || null
    if (data.cardType !== undefined) updateData.cardType = data.cardType
    if (data.cardLast4 !== undefined) updateData.cardLast4 = data.cardLast4
    if (data.authorizationCode !== undefined) updateData.authorizationCode = data.authorizationCode
    if (data.giftCardId !== undefined) updateData.giftCardId = data.giftCardId || null
    if (data.loyaltyAccountId !== undefined) updateData.loyaltyAccountId = data.loyaltyAccountId || null
    if (data.loyaltyPointsUsed !== undefined) updateData.loyaltyPointsUsed = data.loyaltyPointsUsed
    if (data.status !== undefined) updateData.status = data.status
    if (data.employeeId !== undefined) updateData.employeeId = data.employeeId || null

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
  } catch (error) {
    console.error('Failed to update payment:', error)
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
  }
}
