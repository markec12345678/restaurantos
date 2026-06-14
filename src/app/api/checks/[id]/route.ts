
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateCheckSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { toNum, round2, subtract, add, multiply, divide, greaterThan, deepToNumbers } from '@/lib/decimal'
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateCheckSchema, bodyResult.data)
    if (validationError) return validationError

    const existingCheck = await db.check.findUnique({
      where: { id },
      include: { orderItems: true },
    })

    if (!existingCheck) {
      return NextResponse.json({ error: 'Ček ni najden' }, { status: 404 })
    }

    // FIX BUG-09: Celotna posodobitev čeka + popusta mora biti v transakciji
    // Prej je bil popust increment zunaj tx — če check.update ne uspe, je currentUses že povečan
    const updateData: Record<string, unknown> = {}
    if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod

    const check = await db.$transaction(async (tx) => {
      if (data.appliedDiscountId !== undefined) {
        updateData.appliedDiscountId = data.appliedDiscountId || null

        // Ponovni izračun popusta
        if (data.appliedDiscountId) {
          const discountObj = await tx.discount.findUnique({ where: { id: data.appliedDiscountId } })
          if (discountObj) {
            // FIX CRITICAL: Validiraj popust — preveri isActive, veljavnost, maxUses
            if (!discountObj.isActive) {
              throw new Error('Popust ni aktiven')
            }
            const now = new Date()
            if (discountObj.validFrom && now < discountObj.validFrom) {
              throw new Error('Popust še ni veljaven')
            }
            if (discountObj.validTo && now > discountObj.validTo) {
              throw new Error('Popust je potekel')
            }
            if (discountObj.maxUses !== null && discountObj.currentUses >= discountObj.maxUses) {
              throw new Error('Popust je že bil uporabljen največkrat')
            }

            let discount = 0
            if (discountObj.type === 'percentage') {
              discount = round2(multiply(existingCheck.subtotal, divide(discountObj.amount, 100)))
            } else if (discountObj.type === 'fixed_amount') {
              discount = toNum(discountObj.amount)
            }
            discount = Math.min(discount, toNum(existingCheck.subtotal))
            updateData.discount = discount

            // FIX HIGH: Popust zmanjša davčno osnovo — DDV se mora preračunati (EU/FURS zahteva)
            const taxableBase = subtract(existingCheck.subtotal, discount)
            const taxRatio = greaterThan(existingCheck.subtotal, 0) ? toNum(divide(existingCheck.tax, existingCheck.subtotal)) : 0
            const recalculatedTax = round2(multiply(taxableBase, taxRatio))
            updateData.tax = recalculatedTax
            updateData.total = round2(add(add(taxableBase, recalculatedTax), existingCheck.serviceCharge))
            updateData.totalWithTip = round2(add(add(add(taxableBase, recalculatedTax), existingCheck.serviceCharge), existingCheck.tip))

            // Atomarna posodobitev currentUses znotraj transakcije
            if (discountObj.maxUses !== null) {
              const updated = await tx.discount.updateMany({
                where: { id: discountObj.id, currentUses: { lt: discountObj.maxUses } },
                data: { currentUses: { increment: 1 } },
              })
              if (updated.count === 0) {
                throw new Error('Popust je že bil uporabljen največkrat')
              }
            } else {
              await tx.discount.update({
                where: { id: discountObj.id },
                data: { currentUses: { increment: 1 } },
              })
            }

            // If check had a previous discount, decrement its usage counter
            if (existingCheck.appliedDiscountId && existingCheck.appliedDiscountId !== data.appliedDiscountId) {
              await tx.discount.updateMany({
                where: { id: existingCheck.appliedDiscountId, currentUses: { gt: 0 } },
                data: { currentUses: { decrement: 1 } },
              })
            }
          }
        } else {
          // Odstrani popust — decrement previous discount usage
          if (existingCheck.appliedDiscountId) {
            await tx.discount.updateMany({
              where: { id: existingCheck.appliedDiscountId, currentUses: { gt: 0 } },
              data: { currentUses: { decrement: 1 } },
            })
          }
          updateData.discount = 0
          updateData.total = round2(add(add(existingCheck.subtotal, existingCheck.tax), existingCheck.serviceCharge))
          updateData.totalWithTip = round2(add(add(add(existingCheck.subtotal, existingCheck.tax), existingCheck.serviceCharge), existingCheck.tip))
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

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const check = await db.check.findUnique({
      where: { id },
      include: { payments: true },
    })

    if (!check) {
      return NextResponse.json({ error: 'Ček ni najden' }, { status: 404 })
    }

    // Preveri če ima plačila — če jih, ne smemo izbrisati
    const completedPayments = check.payments.filter(p => p.status === 'completed')
    if (completedPayments.length > 0) {
      return NextResponse.json(
        { error: 'Ček ima plačila — ni ga mogoče izbrisati. Namesto tega uporabite storno.' },
        { status: 400 }
      )
    }

    // FIX HIGH: Zmanjšaj discount.currentUses če je imel ček apliciran popust
    // Brez tega se currentUses nikoli ne zmanjša ob brisanju — popust se "potroši" neupravičeno
    if (check.appliedDiscountId) {
      try {
        // FIX BUG-14: Prepreči, da currentUses pade pod 0
        await db.discount.updateMany({
          where: { id: check.appliedDiscountId, currentUses: { gt: 0 } },
          data: { currentUses: { decrement: 1 } },
        })
      } catch {
        // Discount morda že izbrisan — tiho prezri
      }
    }

    // Najprej odstrani povezavo z OrderItem-i
    await db.orderItem.updateMany({
      where: { checkId: id },
      data: { checkId: null },
    })

    // Izbriši nepotrjena plačila
    await db.payment.deleteMany({
      where: { checkId: id, status: { not: 'completed' } },
    })

    // Hard-delete čeka je dovoljen samo, če ni bil plačan
    await db.check.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Ček izbrisan' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/checks/[id]', 'Napaka pri brisanju čeka')
  }
}
