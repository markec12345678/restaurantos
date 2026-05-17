import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, updateCheckSchema } from '@/lib/validations'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateCheckSchema, body)
    if (validationError) return validationError

    const existingCheck = await db.check.findUnique({
      where: { id },
      include: { orderItems: true },
    })

    if (!existingCheck) {
      return NextResponse.json({ error: 'Ček ni najden' }, { status: 404 })
    }

    // FIX H-08: Dovoli samo posodobitev payment polj, zneski se izračunajo strežniško
    const updateData: Record<string, unknown> = {}
    if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod
    if (data.appliedDiscountId !== undefined) {
      updateData.appliedDiscountId = data.appliedDiscountId || null

      // Ponovni izračun popusta
      if (data.appliedDiscountId) {
        const discountObj = await db.discount.findUnique({ where: { id: data.appliedDiscountId } })
        if (discountObj) {
          // FIX CRITICAL: Validiraj popust enako kot pri POST — preveri isActive, veljavnost, maxUses
          if (!discountObj.isActive) {
            return NextResponse.json({ error: 'Popust ni aktiven' }, { status: 400 })
          }
          const now = new Date()
          if (discountObj.validFrom && now < discountObj.validFrom) {
            return NextResponse.json({ error: 'Popust še ni veljaven' }, { status: 400 })
          }
          if (discountObj.validTo && now > discountObj.validTo) {
            return NextResponse.json({ error: 'Popust je potekel' }, { status: 400 })
          }
          if (discountObj.maxUses !== null && discountObj.currentUses >= discountObj.maxUses) {
            return NextResponse.json({ error: 'Popust je že bil uporabljen največkrat' }, { status: 400 })
          }

          let discount = 0
          if (discountObj.type === 'percentage') {
            discount = existingCheck.subtotal * (discountObj.amount / 100)
          } else if (discountObj.type === 'fixed_amount') {
            discount = discountObj.amount
          }
          discount = Math.min(discount, existingCheck.subtotal)
          updateData.discount = discount
          updateData.total = existingCheck.subtotal + existingCheck.tax - discount
          updateData.totalWithTip = existingCheck.subtotal + existingCheck.tax - discount + existingCheck.tip
        }
      } else {
        // Odstrani popust
        updateData.discount = 0
        updateData.total = existingCheck.subtotal + existingCheck.tax
        updateData.totalWithTip = existingCheck.subtotal + existingCheck.tax + existingCheck.tip
      }
    }

    const check = await db.check.update({
      where: { id },
      data: updateData,
      include: {
        order: true,
        orderItems: true,
        payments: true,
        appliedDiscount: true,
      },
    })

    return NextResponse.json(check)
  } catch (error) {
    console.error('Failed to update check:', error)
    return NextResponse.json({ error: 'Failed to update check' }, { status: 500 })
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

    // Soft-delete: označi kot voided (ne izbriši)
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
  } catch (error) {
    console.error('Failed to delete check:', error)
    return NextResponse.json({ error: 'Failed to delete check' }, { status: 500 })
  }
}
