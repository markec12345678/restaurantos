// Pomožne funkcije za /api/checks/[id]

import { db } from '@/lib/db'
import { toNum, round2, multiply, divide, subtract, add, greaterThan } from '@/lib/decimal'
import { Prisma } from '@prisma/client'

export type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0]
type Decimal = Prisma.Decimal

interface ExistingCheck {
  id: string
  subtotal: Decimal | number
  tax: Decimal | number
  serviceCharge: Decimal | number
  tip: Decimal | number
  appliedDiscountId: string | null
}

// Validiraj popust — preveri isActive, veljavnost, maxUses
// FIX R85-FINAL (MEDIUM): checkLocationId — prej je bil findUnique GLOBALEN:
// lokacijski uporabnik je lahko apliciral TUJI popust na svoj ček in
// povečal Discount.currentUses tujega tenanta. Discount.locationId je NOT NULL
// (MODEL A) — neujemanje = isti odgovor kot neobstoječ popust (brez oracles).
export async function validateDiscount(
  tx: TransactionClient,
  discountId: string,
  checkLocationId?: string | null,
): Promise<{ valid: boolean; error?: string; discountObj?: Awaited<ReturnType<typeof tx.discount.findUnique>> }> {
  const discountObj = await tx.discount.findUnique({ where: { id: discountId } })
  if (!discountObj) return { valid: false, error: 'Popust ni najden' }
  if (checkLocationId && discountObj.locationId !== checkLocationId) {
    return { valid: false, error: 'Popust ni najden' }
  }

  if (!discountObj.isActive) return { valid: false, error: 'Popust ni aktiven' }

  const now = new Date()
  if (discountObj.validFrom && now < discountObj.validFrom) {
    return { valid: false, error: 'Popust še ni veljaven' }
  }
  if (discountObj.validTo && now > discountObj.validTo) {
    return { valid: false, error: 'Popust je potekel' }
  }
  if (discountObj.maxUses !== null && discountObj.currentUses >= discountObj.maxUses) {
    return { valid: false, error: 'Popust je že bil uporabljen največkrat' }
  }

  return { valid: true, discountObj }
}

// Izračunaj popust in posodobi davčne osnove
export function calculateDiscountUpdate(
  discountObj: NonNullable<Awaited<ReturnType<TransactionClient['discount']['findUnique']>>>,
  existingCheck: ExistingCheck,
): Record<string, unknown> {
  let discount = 0
  if (discountObj.type === 'percentage') {
    discount = round2(multiply(existingCheck.subtotal, divide(discountObj.amount, 100)))
  } else if (discountObj.type === 'fixed_amount') {
    discount = toNum(discountObj.amount)
  }
  discount = Math.min(discount, toNum(existingCheck.subtotal))

  // Popust zmanjša davčno osnovo — DDV se mora preračunati (EU/FURS zahteva)
  const taxableBase = subtract(existingCheck.subtotal, discount)
  const taxRatio = greaterThan(existingCheck.subtotal, 0) ? toNum(divide(existingCheck.tax, existingCheck.subtotal)) : 0
  const recalculatedTax = round2(multiply(taxableBase, taxRatio))
  const total = round2(add(add(taxableBase, recalculatedTax), existingCheck.serviceCharge))
  const totalWithTip = round2(add(add(add(taxableBase, recalculatedTax), existingCheck.serviceCharge), existingCheck.tip))

  return { discount, tax: recalculatedTax, total, totalWithTip }
}

// Izračunaj check total brez popusta
export function calculateNoDiscountTotals(existingCheck: ExistingCheck): Record<string, unknown> {
  const total = round2(add(add(existingCheck.subtotal, existingCheck.tax), existingCheck.serviceCharge))
  const totalWithTip = round2(add(add(add(existingCheck.subtotal, existingCheck.tax), existingCheck.serviceCharge), existingCheck.tip))
  return { discount: 0, total, totalWithTip }
}

// Atomarna posodobitev currentUses znotraj transakcije
export async function incrementDiscountUsage(
  tx: TransactionClient,
  discountId: string,
  maxUses: number | null,
): Promise<boolean> {
  if (maxUses !== null) {
    const updated = await tx.discount.updateMany({
      where: { id: discountId, currentUses: { lt: maxUses } },
      data: { currentUses: { increment: 1 } },
    })
    return updated.count > 0
  }
  await tx.discount.update({
    where: { id: discountId },
    data: { currentUses: { increment: 1 } },
  })
  return true
}

// Zmanjšaj currentUses za prejšnji popust
export async function decrementDiscountUsage(tx: TransactionClient, discountId: string): Promise<void> {
  await tx.discount.updateMany({
    where: { id: discountId, currentUses: { gt: 0 } },
    data: { currentUses: { decrement: 1 } },
  })
}

// ─── R109 (CK-1/CK-2): ČEKOVNI PISALNI KANON ───
//
// FORENZIKA (TOCTOU razred iz R100–R108):
//
//   CK-1 (HIGH, PUT /api/checks/[id]): `existingCheck` prebran IZVEN tx →
//     (a) totals (calculateDiscountUpdate/NoDiscount) iz STALE subtotal/tax —
//         sočasen void-artikla (recalculateCheckTotals) ali drug PUT = LOST
//         UPDATE na totals (napačen račun na čeku — DDV osnova FURS);
//     (b) stale `appliedDiscountId` primerjava → dva sočasna swap-a popusta
//         = dvojen decrement/en increment (Discount.currentUses DRIFT —
//         popust uporabljen po preteku maxUses);
//     (c) tx brez izolacije/ključavnice + NEPOGOJEN check.update.
//   CK-2 (HIGH, DELETE /api/checks/[id]): 4 NETRANSAKCIJSKE mutacije
//     (discount decrement, orderItem detach, payment deleteMany, check
//     delete) + check-then-act na plačilih izven tx → sočasno plačilo
//     (create-payment, lock raw checkId) zaključeno MED readom in delete →
//     P2003 (FK Restrict) → 500 PO delnih mutacijah (discount že odšteta,
//     artikli detatchani) — finančno stanje razbito.
//   CK-3 (MEDIUM, order-items void): recalculateCheckTotals = read-modify-write
//     na `db` klientu brez tx/locka → lost update na check totals (glej
//     recalculate-totals.ts R109 kanon).
//
// KANON (zrcali R106 stock-mutations / R107 points-mutations / R108
// order-mutations): $transaction(Serializable) + pg_advisory_xact_lock +
// tx-fresh scoped re-read + validacija SAMO proti svežim podatkom +
// strukturirani { error, status } throw-i + P2002/P2034 → 409 v ruti.
//
// LOCK KLJUČ: checkWriteLockKey() = RAW checkId — IDENTEN ključ kot
// create-payment/qr-pay (hashtext(checkId)) → VSI pisalni tokovi ISTEGA čeka
// (plačila, qr-pay, popusti, izbris, void recalc) se striktno SERIALIZIRAJO.

/** R109: check-level lock ključ = raw checkId (pariteta create-payment/qr-pay). */
export function checkWriteLockKey(checkId: string): string {
  return checkId
}

const CHECK_TX_OPTS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 10_000,
} as const

const CHECK_UPDATE_INCLUDE = {
  order: true,
  orderItems: true,
  payments: true,
  appliedDiscount: true,
} as const

/**
 * R109 CK-1: posodobitev čeka (popust/paymentMethod) pod ključavnico.
 * Totals izračunani IZ TX-FRESH čeka (prej stale) — lost update na totals,
 * discount usage drift in lažni prepleti audit vrstic so nemogoči.
 */
export async function updateCheckWithLock(opts: {
  checkId: string
  sessionLocationId: string | null
  appliedDiscountId?: string | null
  paymentMethod?: string
}): Promise<Record<string, unknown>> {
  const { checkId, sessionLocationId, appliedDiscountId, paymentMethod } = opts

  return await db.$transaction(async (tx) => {
    // Advisory lock per check — serializira vsako pisalno pot istega čeka
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${checkWriteLockKey(checkId)}))`

    // Tx-fresh scoped re-read (prej: stale read izven tx določal totals in
    // primerjavo appliedDiscountId)
    const existingCheck = await tx.check.findFirst({
      where: {
        id: checkId,
        ...(sessionLocationId ? { order: { locationId: sessionLocationId } } : {}),
      },
      include: { order: { select: { locationId: true } } },
    })
    if (!existingCheck) {
      throw { error: 'Ček ni najden', status: 404 }
    }

    const updateData: Record<string, unknown> = {}
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod

    if (appliedDiscountId !== undefined) {
      updateData.appliedDiscountId = appliedDiscountId || null

      if (appliedDiscountId) {
        const { valid, error, discountObj } = await validateDiscount(tx, appliedDiscountId, existingCheck.order?.locationId)
        if (!valid || !discountObj) throw { error: error || 'Neveljaven popust', status: 404 }

        // Totals iz TX-FRESH čeka (prej stale existingCheck — lost update)
        Object.assign(updateData, calculateDiscountUpdate(discountObj, existingCheck))

        const incremented = await incrementDiscountUsage(tx, discountObj.id, discountObj.maxUses)
        if (!incremented) throw { error: 'Popust je že bil uporabljen največkrat', status: 409 }

        // Primerjava proti SVEŽEMU stanju (prej stale → dvojen decrement pri
        // sočasnem swap-u dveh popustov)
        if (existingCheck.appliedDiscountId && existingCheck.appliedDiscountId !== appliedDiscountId) {
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
      where: { id: checkId },
      data: updateData,
      include: CHECK_UPDATE_INCLUDE,
    })
  }, CHECK_TX_OPTS)
}

/**
 * R109 CK-2: izbris čeka kot ATOMARNA enota. Prej: 4 netransakcijske mutacije
 * + check-then-act na plačilih izven tx → sočasno plačilo = P2003 (FK
 * Restrict) → 500 PO delnih mutacijah. Zdaj: vse pod ključavnico + tx-fresh
 * plačila → completed plačilo faila PREJ (400) brez stranskih učinkov.
 */
export async function deleteCheckWithLock(opts: {
  checkId: string
  sessionLocationId: string | null
}): Promise<{ success: true; message: string }> {
  const { checkId, sessionLocationId } = opts

  return await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${checkWriteLockKey(checkId)}))`

    // Tx-fresh scoped re-read + plačila (prej: stale check-then-act izven tx)
    const check = await tx.check.findFirst({
      where: {
        id: checkId,
        ...(sessionLocationId ? { order: { locationId: sessionLocationId } } : {}),
      },
      include: { payments: true },
    })
    if (!check) {
      throw { error: 'Ček ni najden', status: 404 }
    }

    const completedPayments = check.payments.filter(p => p.status === 'completed')
    if (completedPayments.length > 0) {
      throw {
        error: 'Ček ima plačila — ni ga mogoče izbrisati. Namesto tega uporabite storno.',
        status: 400,
      }
    }

    // Zmanjšaj discount.currentUses če ima ček apliciran popust (pogojno
    // updateMany gt 0 — brez try/catch, updateMany ne meče na count 0)
    if (check.appliedDiscountId) {
      await tx.discount.updateMany({
        where: { id: check.appliedDiscountId, currentUses: { gt: 0 } },
        data: { currentUses: { decrement: 1 } },
      })
    }

    await tx.orderItem.updateMany({
      where: { checkId },
      data: { checkId: null },
    })

    await tx.payment.deleteMany({
      where: { checkId, status: { not: 'completed' } },
    })

    // deleteMany + count (prej: check.delete → P2025/P2003 → 500)
    const deleted = await tx.check.deleteMany({ where: { id: checkId } })
    if (deleted.count === 0) {
      throw { error: 'Ček ni najden', status: 404 }
    }

    return { success: true, message: 'Ček izbrisan' }
  }, CHECK_TX_OPTS)
}
