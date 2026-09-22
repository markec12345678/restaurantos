// Recalculation helpers for order/check totals
//
// ─── R109 (CK-3): VOID RECALC KANON ───
//
// FORENZIKA: prej sta recalculateOrderTotals() + recalculateCheckTotals()
// delali read-modify-write na `db` klientu BREZ transakcije in BREZ
// ključavnice:
//   - sočasen void artikla ∥ PUT /api/checks/[id] (popust) = LOST UPDATE na
//     check totals (popust izračunan iz stale subtotal, void recalc pa
//     prepisal total iz stale discount — napačen račun/DDV osnova);
//   - sočasen void ∥ add-items (R108 kanon zaklene 'order-write:'+orderId,
//     void recalc pa NI) = lost update na order totals;
//   - guard `paymentStatus !== 'unpaid'` je bil stale read izven tx →
//     plačilo zaključeno med preverbo in recalc = void na plačanem čeku.
//
// KANON (zrcali R106/R107/R108): $transaction(Serializable) + advisory
// locks v FIKSNI vrstni red ('order-write:'+orderId → raw checkId) — enaka
// ključa kot add-items (order-write) in create-payment/qr-pay/checks-kanon
// (raw checkId) → lock graf O → C, enosmeren, brez ciklov. Totals iz
// TX-FRESH seznamov artiklov + paymentStatus guard proti svežemu čeku.

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import { Prisma } from '@prisma/client'

const VOID_RECALC_TX_OPTS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 10_000,
} as const

/**
 * R109 CK-3: preračunaj order + check totals po voidu artikla pod ključavnico.
 * Totals izračunani iz TX-FRESH seznamov (prej stale db-client reads).
 * Guard: ček v statusu ≠ 'unpaid' → strukturirana 409 (plačano/delno
 * plačano → storno/povračilo, ne void).
 */
export async function recalculateOrderAndCheckAfterVoid(opts: {
  orderId: string
  checkId: string | null
}): Promise<void> {
  const { orderId, checkId } = opts

  await db.$transaction(async (tx) => {
    // Fiksni lock vrstni red: order-write → check (enosmeren graf, brez
    // ciklov; nobena druga pot ne jemlje check → order-write)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'order-write:' + orderId}))`
    if (checkId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${checkId}))`
    }

    // ── ORDER totals iz TX-FRESH seznam ──
    const allItems = await tx.orderItem.findMany({
      where: { orderId },
    })

    let newSubtotal = 0
    let newTax = 0
    for (const item of allItems) {
      if (!item.voided) {
        const itemBase = toNum(item.price) * item.quantity
        const itemVat = toNum(item.vatAmount) > 0 ? toNum(item.vatAmount) : (itemBase * toNum(item.vatRate) / 100)
        newSubtotal += itemBase
        newTax += itemVat
      }
    }

    const order = await tx.order.findUnique({ where: { id: orderId } })
    const discount = toNum(order?.discount)
    const cappedDiscount = Math.min(discount, newSubtotal)
    const newTotal = newSubtotal + newTax - cappedDiscount

    await tx.order.update({
      where: { id: orderId },
      data: {
        subtotal: round2(newSubtotal),
        tax: round2(newTax),
        discount: cappedDiscount,
        total: Math.max(0, round2(newTotal)),
        totalWithTip: Math.max(0, round2(newTotal)) + toNum(order?.tip),
      },
    })

    // ── CHECK totals iz TX-FRESH podatkov ──
    if (!checkId) return

    const linkedCheck = await tx.check.findUnique({
      where: { id: checkId },
      include: { orderItems: true },
    })
    if (!linkedCheck) return // ček medtem izbrisan (pod istim lockom) — nič za računati

    // Guard proti svežemu čeku (prej stale read izven tx): void na
    // plačanem/delno plačanem čeku bi znižal total POD obstoječa plačila
    if (linkedCheck.paymentStatus !== 'unpaid') {
      throw {
        error: 'Artikla na plačanem ali delno plačanem čeku ni mogoče voidati — uporabi storno/povračilo.',
        status: 409,
      }
    }

    let checkSubtotal = 0
    let checkTax = 0
    for (const oi of linkedCheck.orderItems) {
      if (oi.voided) continue
      const itemBase = toNum(oi.price) * oi.quantity
      const itemVat = toNum(oi.vatAmount) > 0 ? toNum(oi.vatAmount) : (itemBase * (toNum(oi.vatRate) / 100))
      checkSubtotal += itemBase
      checkTax += itemVat
    }
    const checkDiscount = toNum(linkedCheck.discount)
    const checkTotal = round2(checkSubtotal + checkTax + toNum(linkedCheck.serviceCharge) - checkDiscount)
    const checkTotalWithTip = round2(checkTotal + toNum(linkedCheck.tip))

    await tx.check.update({
      where: { id: linkedCheck.id },
      data: {
        subtotal: round2(checkSubtotal),
        tax: round2(checkTax),
        total: checkTotal,
        totalWithTip: checkTotalWithTip,
      },
    })
  }, VOID_RECALC_TX_OPTS)
}
