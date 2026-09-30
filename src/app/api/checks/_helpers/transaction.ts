// Transakcijske pomožne funkcije za Checks API
//
// ─── R181 (CK-5 / A3): POST /api/checks — IZVORNI ČEKI RECALC KANON ───
//
// FORENZIKA (A3 iz docs/BUSINESS-CHAIN.md registra tveganj):
// `recalculateAffectedChecks` je deloval read-modify-write na golem `db`
// klientu BREZ transakcije in BREZ ključavnice — ISTI vzorec, ki ga je
// R109 (CK-3) popravil na void poti:
//   - POST /api/checks ∥ POST /api/checks (razdelitev istega naročila):
//     oba recalc-a prebereta STALE OrderItems → lost update na totals
//     izvornih čekov (podračunavanje/odračunavanje — R106 INV-2 dvojček);
//   - POST /api/checks ∥ void (R109 kanon zaklene 'order-write:'+orderId,
//     recalc pa NI) → stale prepis svežih void recalc totals;
//   - POST /api/checks ∥ plačilo/PUT/DELETE čeka (kanoni zaklenejo raw
//     checkId, recalc pa NI) → stale totals čez sočasno spremembo čeka.
//
// KANON (zrcali R106/R107/R108/R109): celoten POST pisalni tok (create +
// link + recalc) v ENEM $transaction(Serializable) + advisory locks v
// FIKSNI vrstni red ('order-write:'+orderId → sorted raw checkId; enaka
// ključa kot add-items/void (order-write) in create-payment/qr-pay/
// checks-PUT-DELETE (raw checkId)) → lock graf O → C, enosmeren, brez
// ciklov. Totals iz TX-FRESH seznamov artiklov; tx-fresh guard proti
// plačanim čekom (prej stale read izven tx).

import { Prisma } from '@prisma/client'
import { toNum, round2 } from '@/lib/decimal'
import { calculateCheckAmounts } from './calculate'

// ─── Tipi za transakcijo ─────────────────────────────────────

export interface OrderItemBrief {
  id: string
  checkId: string | null
}

type Tx = Prisma.TransactionClient

/** R181 CK-5: ključ za order-write ključavnico (pariteta R108/R109 literal). */
export function orderWriteLockKey(orderId: string): string {
  return 'order-write:' + orderId
}

/**
 * R181 CK-5: order-write ključavnica (pariteta add-items/void literal) —
 * PRVA v lock vrstnem redu, PRED tx-fresh branjem.
 */
export async function orderWriteLock(tx: Tx, orderId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orderWriteLockKey(orderId)}))`
}

/**
 * R181 CK-5: checkId ključavnice (sorted unikatni raw checkId — pariteta
 * checkWriteLockKey = create-payment/qr-pay) → determinističen vrstni red,
 * deadlock nemogoč. Skupaj z orderWriteLock: enosmeren lock graf O → C
 * (nobena druga pot ne jemlje check → order-write).
 */
export async function acquireCheckIdLocks(
  tx: Tx,
  checkIds: (string | null | undefined)[]
): Promise<void> {
  const ids = [
    ...new Set(
      checkIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ].sort()
  for (const id of ids) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`
  }
}

// ─── Preračun izvornih čekov po prenosa artiklov (CK-5 kanon) ─

export async function recalculateAffectedChecksInTx(
  tx: Tx,
  orderId: string,
  newCheckId: string,
  reassignedItemIds: string[]
): Promise<void> {
  if (reassignedItemIds.length === 0) return

  // TX-FRESH branje (prej stale db-client read) — pod ključavnicami
  // (order-write + checkId) iz klicnega kanona.
  const affectedChecks = await tx.check.findMany({
    where: {
      orderId,
      id: { not: newCheckId },
    },
    include: { orderItems: true },
  })

  for (const affectedCheck of affectedChecks) {
    if (affectedCheck.orderItems.length === 0) continue
    const { subtotal: newSubtotal, tax: newTax } = calculateCheckAmounts(
      affectedCheck.orderItems.filter(oi => !oi.voided).map(oi => ({
        id: oi.id,
        checkId: oi.checkId,
        check: null,
        voided: oi.voided,
        price: oi.price,
        quantity: oi.quantity,
        vatAmount: oi.vatAmount,
        vatRate: oi.vatRate,
      }))
    )
    const newDiscount = toNum(affectedCheck.discount)
    const newTotal = round2(newSubtotal + newTax + toNum(affectedCheck.serviceCharge) - newDiscount)
    const newTotalWithTip = round2(newTotal + toNum(affectedCheck.tip))

    // Pogojen update (paymentStatus v where): ček je v medtem prešel v
    // 'paid' (storno/plačilo pod raw checkId ključavnico med našimi
    // ključavnicami ni možen, CAS pa je obrambna globina proti driftu) —
    // count 0 = preskoči (totals plačanega čeka se ne spreminjajo).
    await tx.check.updateMany({
      where: { id: affectedCheck.id, paymentStatus: { not: 'paid' } },
      data: {
        subtotal: round2(newSubtotal),
        tax: round2(newTax),
        total: newTotal,
        totalWithTip: newTotalWithTip,
      },
    })
  }
}

// ─── Transakcijske pomožne funkcije ──────────────────────────

export async function applyDiscountAtomic(
  tx: Tx,
  discountId: string | null
): Promise<void> {
  if (!discountId) return
  const discountObj = await tx.discount.findUnique({ where: { id: discountId } })
  if (!discountObj) return

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
}

export async function linkOrderItemsToCheck(
  tx: Tx,
  checkId: string,
  orderItemIds: string[],
  allOrderItems: OrderItemBrief[],
  orderId?: string,
): Promise<void> {
  if (orderItemIds.length > 0) {
    // BUG-HUNT FIX 2026-09-19 (HIGH): orderId filter — brez njega je updateMany
    // premaknil KATERE KOLI item-ID-je (tudi iz drugih naročil/lokacij ali
    // plačanih čekov) na ta ček → napačni totali pod obstoječimi plačili.
    await tx.orderItem.updateMany({
      where: { id: { in: orderItemIds }, ...(orderId ? { orderId } : {}) },
      data: { checkId },
    })
  } else {
    // Poveži vse nepovezane OrderItem-e tega naročila
    const unassignedItems = allOrderItems.filter(oi => !oi.checkId)
    if (unassignedItems.length > 0) {
      await tx.orderItem.updateMany({
        where: { id: { in: unassignedItems.map(oi => oi.id) }, ...(orderId ? { orderId } : {}) },
        data: { checkId },
      })
    }
  }
}
