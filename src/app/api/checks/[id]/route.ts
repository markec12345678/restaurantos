
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateCheckSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { deepToNumbers } from '@/lib/decimal'
import {

  validateDiscount,
  calculateDiscountUpdate,
  calculateNoDiscountTotals,
  incrementDiscountUsage,
  decrementDiscountUsage,
} from './_helpers'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(updateCheckSchema, bodyResult.data)
    if (validationError) return validationError

    const existingCheck = await db.check.findUnique({
      where: { id },
      include: { orderItems: true },
    })

    if (!existingCheck) {
      return NextResponse.json({ error: 'Ček ni najden' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod

    const check = await db.$transaction(async (tx) => {
      if (data.appliedDiscountId !== undefined) {
        updateData.appliedDiscountId = data.appliedDiscountId || null

        if (data.appliedDiscountId) {
          const { valid, error, discountObj } = await validateDiscount(tx, data.appliedDiscountId)
          if (!valid || !discountObj) throw new Error(error || 'Neveljaven popust')

          Object.assign(updateData, calculateDiscountUpdate(discountObj, existingCheck))

          const incremented = await incrementDiscountUsage(tx, discountObj.id, discountObj.maxUses)
          if (!incremented) throw new Error('Popust je že bil uporabljen največkrat')

          if (existingCheck.appliedDiscountId && existingCheck.appliedDiscountId !== data.appliedDiscountId) {
            await decrementDiscountUsage(tx, existingCheck.appliedDiscountId)
          }
        } else {
          // Odstrani popust
          if (existingCheck.appliedDiscountId) {
            await decrementDiscountUsage(tx, existingCheck.appliedDiscountId)
          }
          Object.assign(updateData, calculateNoDiscountTotals(existingCheck))
        }
      }

      return await tx.check.update({
        where: { id },
        data: updateData,
        include: {
          order: true,
          orderItems: true,
          payments: true,
          appliedDiscount: true,
        },
      })
    })

    return NextResponse.json(deepToNumbers(check))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/checks/[id]', 'Napaka pri posodobitvi čeka')
  }
}

// FIX H-06: Soft-delete namesto hard-delete (ohrani audit sled)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const check = await db.check.findUnique({
      where: { id },
      include: { payments: true },
    })

    if (!check) {
      return NextResponse.json({ error: 'Ček ni najden' }, { status: 404 })
    }

    const completedPayments = check.payments.filter(p => p.status === 'completed')
    if (completedPayments.length > 0) {
      return NextResponse.json(
        { error: 'Ček ima plačila — ni ga mogoče izbrisati. Namesto tega uporabite storno.' },
        { status: 400 }
      )
    }

    // Zmanjšaj discount.currentUses če je imel ček apliciran popust
    if (check.appliedDiscountId) {
      try {
        await db.discount.updateMany({
          where: { id: check.appliedDiscountId, currentUses: { gt: 0 } },
          data: { currentUses: { decrement: 1 } },
        })
      } catch {
        // Discount morda že izbrisan — tiho prezri
      }
    }

    await db.orderItem.updateMany({
      where: { checkId: id },
      data: { checkId: null },
    })

    await db.payment.deleteMany({
      where: { checkId: id, status: { not: 'completed' } },
    })

    await db.check.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Ček izbrisan' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/checks/[id]', 'Napaka pri brisanju čeka')
  }
}
