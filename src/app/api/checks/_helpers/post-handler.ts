// POST handler logika za checks API — ustvarjanje čeka

import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { getNextCounter } from '@/lib/counters'
import { parseJsonBody, validateBody } from '@/lib/api-utils'
import { createCheckSchema } from '@/lib/validations'
import {
  calculateCheckAmounts,
  validateAndCalculateDiscount,
  recalculateTaxWithDiscount,
} from './calculate'
import {
  recalculateAffectedChecks,
  applyDiscountAtomic,
  linkOrderItemsToCheck,
} from './transaction'

export async function handlePostCheck(req: Request, _authResult: { session?: { employeeId?: string } | null }) {
  const bodyResult = await parseJsonBody(req)
  if (bodyResult.error) return bodyResult.error

  // FIX H-01: Validiraj vnos z Zod
  const { data, error: validationError } = validateBody(createCheckSchema, bodyResult.data)
  if (validationError) return validationError

  // Preveri, da order obstaja
  const order = await db.order.findUnique({
    where: { id: data.orderId },
    include: { orderItems: { include: { check: { select: { id: true, paymentStatus: true } } } } },
  })

  if (!order) {
    return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
  }

  // FIX HIGH: Prepreči dodelitev OrderItemov, ki so že na plačanem čeku
  if (data.orderItemIds && data.orderItemIds.length > 0) {
    const paidItems = order.orderItems.filter(oi =>
      data.orderItemIds!.includes(oi.id) && oi.checkId && oi.check?.paymentStatus === 'paid'
    )
    if (paidItems.length > 0) {
      return NextResponse.json(
        { error: `${paidItems.length} artikel(ov) so že na plačanem čeku in jih ni mogoče premakniti` },
        { status: 400 }
      )
    }
  }

  // FIX H-02: Poveži OrderItems s Check-om in izračunaj zneske strežniško
  const checkNumber = await getNextCounter('checkNumber')

  // Določi katere OrderItem-e vključimo v ta ček
  let checkOrderItems = order.orderItems
  if (data.orderItemIds && data.orderItemIds.length > 0) {
    checkOrderItems = order.orderItems.filter(oi => data.orderItemIds!.includes(oi.id))
  }

  // FIX MEDIUM: Izključi voidane artikle iz izračuna čeka
  checkOrderItems = checkOrderItems.filter(oi => !oi.voided)

  if (checkOrderItems.length === 0) {
    return NextResponse.json({ error: 'Ček mora vsebovati vsaj en artikel' }, { status: 400 })
  }

  // FIX H-08: Strežniški izračun zneskov iz dejanskih OrderItem-ov
  const { subtotal, tax } = calculateCheckAmounts(checkOrderItems)

  // FIX H-03: Popust ne more preseči vmesne vsote
  const { discount, discountId: discountIdForTx, error: discountError } = await validateAndCalculateDiscount(data.appliedDiscountId, subtotal)
  if (discountError) {
    return NextResponse.json({ error: discountError }, { status: 400 })
  }

  // FIX HIGH: Popust zmanjša davčno osnovo — DDV se mora preračunati
  const { recalculatedTax, total } = recalculateTaxWithDiscount(subtotal, tax, discount)

  // FIX: Ustvari ček IN poveži OrderItem-e v eni transakciji
  const check = await db.$transaction(async (tx) => {
    await applyDiscountAtomic(tx, discountIdForTx)

    const newCheck = await tx.check.create({
      data: {
        checkNumber,
        orderId: data.orderId,
        subtotal,
        tax: recalculatedTax,
        discount,
        serviceCharge: 0,
        total,
        tip: 0,
        totalWithTip: total,
        paymentStatus: 'unpaid',
        paymentMethod: '',
        appliedDiscountId: data.appliedDiscountId || null,
      },
    })

    // Poveži OrderItem-e s tem Check-om
    await linkOrderItemsToCheck(
      tx,
      newCheck.id,
      data.orderItemIds || [],
      order.orderItems.map(oi => ({ id: oi.id, checkId: oi.checkId }))
    )

    return newCheck
  })

  // FIX BUG-03: Preračunaj totale izvornih čekov, ki so izgubili artikle
  await recalculateAffectedChecks(data.orderId, check.id, data.orderItemIds || [])

  // Re-fetch z posodobljenimi relacijami
  const checkWithItems = await db.check.findUnique({
    where: { id: check.id },
    include: {
      order: true,
      orderItems: true,
      payments: true,
      appliedDiscount: true,
    },
  })

  return NextResponse.json(deepToNumbers(checkWithItems), { status: 201 })
}
