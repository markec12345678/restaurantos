// POST handler logika za checks API — ustvarjanje čeka
//
// ─── R181 (CK-5 / A3): PISALNI KANON POST /api/checks ───
// Zrcali R109 (CK-1/2/3) + R106/R107/R108: create + link + RECALC IZVORNIH
// ČEKOV zdaj v ENEM $transaction(Serializable) pod advisory locks
// ('order-write:'+orderId → sorted raw checkId; enaka ključa kot
// add-items/void in create-payment/qr-pay/checks-PUT/DELETE) + TX-FRESH
// re-read naročila/artiklov + tx-fresh guard proti plačanim čekom + totals
// iz SVEŽIH podatkov. Prej: create v tx (privzeta izolacija), recalc pa
// IZVEN tx na golem klientu (A3 — read-modify-write brez zaščite, isti
// vzorec, ki ga je R109 popravil na void poti).
// Error kontrakt: strukturirani { error, status } throw-i iz tx telesa +
// P2002/P2034 → 409 v ruti (pariteta PUT/DELETE /api/checks/[id]).

import { db } from '@/lib/db'
import { deepToNumbers, toNum } from '@/lib/decimal'
import { Prisma } from '@prisma/client'
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
  orderWriteLock,
  acquireCheckIdLocks,
  recalculateAffectedChecksInTx,
  applyDiscountAtomic,
  linkOrderItemsToCheck,
} from './transaction'

const CHECK_POST_TX_OPTS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 10_000,
} as const

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
  //
  // R181 CK-5: ta (stale) branje je zdaj SAMO UX pre-flight (hitri 404/400
  // brez tx) — avtoritativna validacija je TX-FRESH znotraj kanona.
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
  // (UX pre-flight — avtoritativni guard je TX-FRESH v kanonu)
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

  // FIX H-03: Popust ne more preseči vmesne vsote (UX pre-flight)
  // BUG-HUNT FIX 2026-09-19: popust se rešuje z locationId scope-om naročila
  // (prej je bil sprejemljiv popust KATERE KOLI lokacije)
  const preflightSubtotal = calculateCheckAmounts(
    order.orderItems.filter(oi => !oi.voided && (!data.orderItemIds || data.orderItemIds.length === 0 || data.orderItemIds.includes(oi.id)))
  ).subtotal
  const { error: discountError } = await validateAndCalculateDiscount(
    data.appliedDiscountId,
    preflightSubtotal,
    order.locationId ?? undefined,
  )
  if (discountError) {
    return NextResponse.json({ error: discountError }, { status: 400 })
  }

  // ── R181 CK-5: KANON — vse ali nič pod ključavnicami ──
  const check = await db.$transaction(async (tx) => {
    // 1) order-write ključavnica PRVA (enosmerni lock graf O → C; pariteta
    //    add-items/void) — pred TX-FRESH branjem
    await orderWriteLock(tx, data.orderId)

    // 2) TX-FRESH scoped re-read naročila + artiklov (prej stale outer read
    //    določal totals in guard — sočasen add-items/void/transfer = stale
    //    subtotal/tax na NOvem čeku)
    const freshOrder = await tx.order.findFirst({
      where: {
        id: data.orderId,
        ...(scope.locationId ? { locationId: scope.locationId } : {}),
      },
      include: { orderItems: { include: { check: { select: { id: true, paymentStatus: true } } } } },
    })
    if (!freshOrder) {
      throw { error: 'Naročilo ni najdeno', status: 404 }
    }

    // 3) TX-FRESH izbor artiklov (pariteta pre-flight logike)
    let freshItems = freshOrder.orderItems
    if (data.orderItemIds && data.orderItemIds.length > 0) {
      freshItems = freshItems.filter(oi => data.orderItemIds!.includes(oi.id))
    }
    freshItems = freshItems.filter(oi => !oi.voided)
    if (freshItems.length === 0) {
      throw { error: 'Ček mora vsebovati vsaj en artikel', status: 400 }
    }

    // 4) TX-FRESH guard proti plačanim čekom (prej stale read izven tx →
    //    artikel premaknjen s PLAČANEGA čeka med pre-flightom in tx)
    const freshPaid = freshItems.filter(oi => oi.checkId && oi.check?.paymentStatus === 'paid')
    if (freshPaid.length > 0) {
      throw {
        error: `${freshPaid.length} artikel(ov) so že na plačanem čeku in jih ni mogoče premakniti`,
        status: 400,
      }
    }

    // 5) checkId ključavnice za izvorne čeke, ki IZGUBJAJO artikle (sorted →
    //    determinističen vrstni red, deadlock nemogoč; raw checkId = pariteta
    //    create-payment/qr-pay/checks-PUT/DELETE)
    await acquireCheckIdLocks(tx, freshItems.map(oi => oi.checkId))

    // 6) Totals iz TX-FRESH artiklov (avtoritativno — pre-flight številke so
    //    bile stale). FIX H-08 + UI-QA FIX (runda 112) logika ohranjena:
    //    vatAmount je POST-order-discount snapshot → če ček BO imel popust,
    //    DDV iz avtoritativnega vatRate.
    const { subtotal: freshSubtotal, tax: freshPreTax } = calculateCheckAmounts(freshItems)

    const { discount, discountId: discountIdForTx, error: freshDiscountError } =
      await validateAndCalculateDiscount(
        data.appliedDiscountId,
        freshSubtotal,
        freshOrder.locationId ?? undefined,
        tx,
      )
    if (freshDiscountError) {
      throw { error: freshDiscountError, status: 400 }
    }

    // UI-QA FIX (runda 112, ref #111): ročni popust na naročilu pride na ček
    // (capped na fresh subtotal TEGA čeka)
    let effectiveDiscount = discount
    if (!data.appliedDiscountId && discount === 0 && freshOrder.discount && Number(freshOrder.discount) > 0) {
      effectiveDiscount = Math.min(Number(freshOrder.discount), freshSubtotal)
    }

    let tax = freshPreTax
    if (effectiveDiscount > 0) {
      tax = freshItems.reduce((sum, oi) => {
        const rate = toNum(oi.vatRate)
        const base = toNum(oi.price) * oi.quantity
        return sum + (rate > 0 ? (base * rate) / 100 : toNum(oi.vatAmount))
      }, 0)
    }

    // FIX HIGH: Popust zmanjša davčno osnovo — DDV se mora preračunati
    const { recalculatedTax, total } = recalculateTaxWithDiscount(freshSubtotal, tax, effectiveDiscount)

    // 7) Atomarna poraba popusta (pogojen increment — maxUses fail-closed)
    await applyDiscountAtomic(tx, discountIdForTx)

    // 8) Ustvari ček (totals iz TX-FRESH podatkov)
    const newCheck = await tx.check.create({
      data: {
        checkNumber,
        orderId: data.orderId,
        subtotal: freshSubtotal,
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

    // 9) Poveži OrderItem-e s tem Check-om
    // BUG-HUNT FIX 2026-09-19 (HIGH): orderId filter
    await linkOrderItemsToCheck(
      tx,
      newCheck.id,
      data.orderItemIds || [],
      freshOrder.orderItems.map(oi => ({ id: oi.id, checkId: oi.checkId })),
      data.orderId,
    )

    // 10) FIX BUG-03 (A3/CK-5): preračunaj totale izvornih čekov, ki so
    //     izgubili artikle — ZDAJ TX-FRESH pod istimi ključavnicami (prej:
    //     stale read-modify-write IZVEN tx → lost update na totals)
    await recalculateAffectedChecksInTx(tx, data.orderId, newCheck.id, data.orderItemIds || [])

    return newCheck
  }, CHECK_POST_TX_OPTS)

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
