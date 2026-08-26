// POST handler za receipts/[id] — ustvarjanje računa v bazo

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getNextReceiptNumber } from '@/lib/counters'
import { createReceiptSchema, receiptCreatedResponseSchema } from '@/lib/validations'
import { parseJsonBody, validateBody, validateApiResponse } from '@/lib/api-utils'
import { toNum, round2, deepToNumbers } from '@/lib/decimal'
import { generateZOIPlaceholder, MINIMAL_SETTINGS, calculateVatBreakdownForReceipt } from './index'

export async function handlePostReceipt(
  req: Request,
  id: string,
  _authResult: { session?: { employeeId?: string } | null },
) {
  const bodyResult = await parseJsonBody(req)
  if (bodyResult.error) return bodyResult.error

  // FIX H-01: Validiraj vnos z Zod
  const { data, error: validationError } = validateBody(createReceiptSchema, bodyResult.data)
  if (validationError) return validationError

  const order = await db.order.findUnique({
    where: { id },
    include: { orderItems: { include: { menuItem: true } } },
  })

  if (!order) {
    return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
  }

  // FIX: Preveri, da je naročilo plačano preden se ustvari račun
  if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'partial') {
    return NextResponse.json({ error: 'Naročilo mora biti plačano preden se ustvari račun' }, { status: 400 })
  }

  // Preveri če že obstaja
  const existing = await db.receipt.findFirst({ where: { orderId: id, isStorno: false } })
  if (existing) {
    return NextResponse.json(deepToNumbers(existing))
  }

  // Pridobi nastavitve
  const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
  const s2 = settings || MINIMAL_SETTINGS

  // Izračunaj DDV razdelitev (strežniško — edini vir resnice)
  const totalDiscount = toNum(order.discount)
  const vatBreakdownForReceipt = calculateVatBreakdownForReceipt(order.orderItems, totalDiscount)

  // FIX CRITICAL: Atomna sekvenčna številka + ustvarjanje računa v transakciji (FURS skladnost)
  const receipt = await db.$transaction(async (tx) => {
    const receiptNumber = await getNextReceiptNumber(tx)

    // ZOI placeholder
    const zoi = generateZOIPlaceholder(order.orderNumber, receiptNumber)

    const created = await tx.receipt.create({
      data: {
        receiptNumber,
        orderId: id,
        businessName: s2.name,
        businessAddress: `${s2.address}, ${s2.postCode} ${s2.city}`,
        businessId: s2.businessId,
        taxId: s2.taxId,
        registerId: s2.registerNumber,
        zoi,
        eor: '',
        fiscalVerified: false,
        subtotal: order.subtotal,
        vatBreakdown: JSON.stringify(vatBreakdownForReceipt),
        totalVat: order.tax,
        discount: order.discount,
        total: order.total,
        tip: toNum(order.tip),
        totalWithTip: round2(toNum(order.total) + toNum(order.tip)),
        paymentMethod: data.paymentMethod,
        isCopy: false,
        isStorno: data.isStorno,
        stornoOf: data.stornoOf,
      },
    })

    // FIX MEDIUM: Posodobi order paymentMethod če še ni nastavljen
    if (!order.paymentMethod && data.paymentMethod) {
      await tx.order.update({
        where: { id },
        data: { paymentMethod: data.paymentMethod },
      })
    }

    return created
  })

  return NextResponse.json(validateApiResponse(deepToNumbers(receipt), receiptCreatedResponseSchema, 'POST /api/receipts/[id]'), { status: 201 })
}
