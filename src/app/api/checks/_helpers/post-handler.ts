// POST handler logika za checks API — ustvarjanje čeka

import { db } from '@/lib/db'
import { deepToNumbers, toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { getNextCounter } from '@/lib/counters'
import { parseJsonBody, validateBody } from '@/lib/api-utils'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
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

export async function handlePostCheck(req: Request, authResult: { session?: { employeeId?: string; locationId?: string | null } | null }) {
  const bodyResult = await parseJsonBody(req)
  if (bodyResult.error) return bodyResult.error

  // FIX H-01: Validiraj vnos z Zod
  const { data, error: validationError } = validateBody(createCheckSchema, bodyResult.data)
  if (validationError) return validationError

  // Preveri, da order obstaja
  // BUG-HUNT FIX 2026-09-19 (HIGH, cross-tenant): findUnique → findFirst z
  // locationId scope — prej je bilo mogoče ustvariti ček na tujem naročilu.
  // FIX R86-2a (M2 fail-open): raw spread `session?.locationId ?? undefined`
  // je regularno sejo z NULL lokacijo pustil do GLOBALNEGA order lookup-a
  // (ček na tujem naročilu). Centralni resolver: fail-closed 403 brez lokacije;
  // super-admin (brez lokacije) = globalni nadzor. Resolver teče TUKAJ (in ne
  // v route), ker je handlePostCheck edini lastnik authResult-a.
  const { searchParams } = new URL(req.url)
  const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
    endpoint: 'POST /api/checks',
  })
  if ('error' in scope) return scope.error
  const order = await db.order.findFirst({
    where: {
      id: data.orderId,
      ...(scope.locationId ? { locationId: scope.locationId } : {}),
    },
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
  // (runda 112: tax se računa NIZJE — glej UI-QA FIX za dvostni odštevek popusta)
  const { subtotal } = calculateCheckAmounts(checkOrderItems)

  // FIX H-03: Popust ne more preseči vmesne vsote
  // BUG-HUNT FIX 2026-09-19: popust se rešuje z locationId scope-om naročila
  // (prej je bil sprejemljiv popust KATERE KOLI lokacije)
  const { discount, discountId: discountIdForTx, error: discountError } = await validateAndCalculateDiscount(
    data.appliedDiscountId,
    subtotal,
    order.locationId ?? undefined,
  )
  if (discountError) {
    return NextResponse.json({ error: discountError }, { status: 400 })
  }

  // UI-QA FIX (runda 112, ref #111 — 11-korakni preverjanji, korak 8+10):
  // ROčNI popust na naročilu (natakar vpiše znesek v € — brez Discount zapisa,
  // order.appliedDiscountId = null) prej NIKOLI ni prišel na ček. Ček = polna
  // cena (npr. 16,95), plačilo pa pokrije znesek s popustom (15,95) → ček ostane
  // 'partial' → naročilo nikoli 'paid' → zaključni PUT /api/orders 409 (stale
  // expectedUpdatedAt, ker je payment POST že posodobil order row) → zavajajoči
  // toast "spremenjeno s strani drugega uporabnika", račun/FURS preskočena.
  // Varno: order.discount je že strežniško validiran ob ustvarjanju naročila
  // (capped na subtotal); tu še enkrat capped na subtotal TEGA čeka.
  let effectiveDiscount = discount
  if (!data.appliedDiscountId && discount === 0 && order.discount && Number(order.discount) > 0) {
    effectiveDiscount = Math.min(Number(order.discount), subtotal)
  }

  // UI-QA FIX (runda 112): DVOSTEN odštevek popusta na DDV.
  // OrderItem.vatAmount je snapshot ŽE poplačanega (post-order-discount) DDV
  // (npr. Cappuccino 2,00 @ 22 % s popustom 0,50 → vatAmount 0,33, NE 0,44).
  // calculateCheckAmounts raje uporabi vatAmount kot vatRate; recalculate-
  // TaxWithDiscount nato upošteva ŠE check-discount → taxRatio = 0,33/2,00 →
  // DDV 0,25 namesto 0,33 → ček 1,75 ≠ naročilo 1,83 → plačilo 400/overpay.
  // Fix: če bo ček IMEL popust, izračunaj predpopustni DDV iz avtoritativnega
  // vatRate (vatAmount samo kot fallback pri manjkajoči stopnji).
  let tax = calculateCheckAmounts(checkOrderItems).tax
  if (effectiveDiscount > 0) {
    tax = checkOrderItems.reduce((sum, oi) => {
      const rate = toNum(oi.vatRate)
      const base = toNum(oi.price) * oi.quantity
      return sum + (rate > 0 ? (base * rate) / 100 : toNum(oi.vatAmount))
    }, 0)
  }

  // FIX HIGH: Popust zmanjša davčno osnovo — DDV se mora preračunati
  const { recalculatedTax, total } = recalculateTaxWithDiscount(subtotal, tax, effectiveDiscount)

  // FIX: Ustvari ček IN poveži OrderItem-e v eni transakciji
  const check = await db.$transaction(async (tx) => {
    await applyDiscountAtomic(tx, discountIdForTx)

    const newCheck = await tx.check.create({
      data: {
        checkNumber,
        orderId: data.orderId,
        subtotal,
        tax: recalculatedTax,
        discount: effectiveDiscount,
        serviceCharge: 0,
        total,
        tip: 0,
        totalWithTip: total,
        paymentStatus: 'unpaid',
        paymentMethod: '',
        appliedDiscountId: discountIdForTx || null,
      },
    })

    // Poveži OrderItem-e s tem Check-om
    // BUG-HUNT FIX 2026-09-19 (HIGH): orderId filter — prej je updateMany premaknil
    // KATERE KOLI item-ID-je (tudi iz drugih naročil/lokacij ali plačanih čekov)
    await linkOrderItemsToCheck(
      tx,
      newCheck.id,
      data.orderItemIds || [],
      order.orderItems.map(oi => ({ id: oi.id, checkId: oi.checkId })),
      data.orderId,
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
