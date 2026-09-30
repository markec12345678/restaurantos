// Pomožne funkcije za Payments API — Posodobi status čeka in naročila

import { Prisma } from '@prisma/client'
import { greaterThanOrEqual, greaterThan, subtract } from '@/lib/decimal'

// ─── Posodobi plačilni status čeka in naročila ──────────────

export async function updateCheckAndOrderStatus(
  tx: Prisma.TransactionClient,
  checkId: string,
  checkTotal: Prisma.Decimal,
  orderId: string,
): Promise<void> {
  // OPTIMIZACIJA: aggregate() namesto findMany + sumBy
  const totalPaidResult = await tx.payment.aggregate({
    where: { checkId, status: 'completed' },
    _sum: { amount: true },
  })

  const totalPaid = totalPaidResult._sum.amount ?? new Prisma.Decimal(0)
  if (greaterThanOrEqual(totalPaid, subtract(checkTotal, 0.01))) {
    await tx.check.update({
      where: { id: checkId },
      data: { paymentStatus: 'paid' },
    })
  } else if (greaterThan(totalPaid, 0)) {
    await tx.check.update({
      where: { id: checkId },
      data: { paymentStatus: 'partial' },
    })
  }

  // FIX CRITICAL: Posodobi ORDER paymentStatus, paymentMethod, paidAt ko je check plačan
  const updatedCheck = await tx.check.findUnique({ where: { id: checkId } })
  if (updatedCheck?.paymentStatus === 'paid') {
    // Pridobi vse čeke za ta naročilo
    const allChecks = await tx.check.findMany({ where: { orderId } })
    const allPaid = allChecks.every(c => c.paymentStatus === 'paid')
    const anyPartial = allChecks.some(c => c.paymentStatus === 'partial')
    const orderPaymentStatus = allPaid ? 'paid' : anyPartial ? 'partial' : 'unpaid'
    const orderUpdateData: Record<string, unknown> = { paymentStatus: orderPaymentStatus }

    if (allPaid) {
      orderUpdateData.paidAt = new Date()
      // Določi paymentMethod — če je samo en tip, uporabi njega; sicer "split"
      const allPayments = await tx.payment.findMany({
        where: { checkId: { in: allChecks.map(c => c.id) }, status: 'completed' },
        select: { type: true },
      })
      const allPaymentTypes = new Set(allPayments.map(p => p.type))
      if (allPaymentTypes.size === 1) {
        orderUpdateData.paymentMethod = [...allPaymentTypes][0]
      } else if (allPaymentTypes.size > 1) {
        orderUpdateData.paymentMethod = 'split'
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: orderUpdateData,
    })

    // FIX BUG (chaos test): 12 paid orderjev ni bilo v statusu 'completed'.
    // Prejšnja koda je preverjala samo `ready` ali `in-progress`, ampak
    // orderji so lahko tudi v `pending` (takeaway plačilo pred fired) ali
    // drugih statusih. Blacklist pristop je bolj robusten: vsak order ki
    // NI `completed` in NI `cancelled` mora preiti v `completed` ko je plačan.
    //
    // Predhodna logika: if (order.status === 'ready' || order.status === 'in-progress')
    // Nova logika: if (order.status !== 'completed' && order.status !== 'cancelled')
    if (allPaid) {
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } })
      if (order && order.status !== 'completed' && order.status !== 'cancelled') {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'completed' },
        })
      }
    }
  } else if (updatedCheck?.paymentStatus === 'partial') {
    // Partial plačilo — posodobi order status na partial če ni že
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (order?.paymentStatus === 'unpaid') {
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'partial' },
      })
    }
  }
}

// ─── R183 (A7): ENOTEN reversal-direction kanon ─────────────
//
// FORENZIKA: po povračilu/poničitvi sobile trije DIVERGENTNI izvodi derivacije
// check/order paymentStatus:
//   1. POST /api/payments/[id]/refund — inline (step 5–6): netPaid =
//      Σ(completed) − Σ(refundAmount) → 'storno' | 'partial' | 'paid';
//      order agregacija prek VSEH čekov z 'storno' vejico; paidAt NI resetiran.
//   2. PUT /api/payments/[id] (recalculatePaymentStatus): Σ(completed) BREZ
//      refundAmount → 'unpaid' (NE 'storno'!) | 'partial' | 'paid'; paidAt
//      reset SAMO pri 'unpaid'. → isti poslovni dogodek (polna reverza) je
//      glede na pot končal v 'storno' ALI 'unpaid'; delno povrnjeno plačilo
//      (status completed, refundAmount > 0) je utemeljilo 'paid' kljub nižjemu
//      neto znesku (drift A7, FURS storno knjigovodstvo je videlo drugačen
//      status od EOD/Z filtriranja).
//   3. plačilna smer (updateCheckAndOrderStatus zgoraj) — kanon, ni duplication.
//
// KANON (R183): ENA funkcija za reversal smer, refundAmount-zavedna:
//   netPaid = Σ(completed amount) − Σ(refundAmount po VSEH plačilih čeka)
//   netPaid ≤ 0            → 'storno'   (FIX Test 4.2 semantika, refund pot)
//   netPaid < total − 0.01 → 'partial'  (isti ε prag kot plačilna smer)
//   sicer                  → 'paid'
// Order: agregacija čez VSE čeke naročila — allStorno → 'storno', allPaid →
//   'paid', anyPaidOrPartial → 'partial', sicer 'unpaid'. paidAt = null vsakič,
//   ko derived status ≠ 'paid' (faktična semantika: paidAt obstaja ⟺ order je
//   trenutno v celoti plačan; prej inkonzistentno — refund pot sploh ni
//   resetirala, PUT samo pri 'unpaid').
// Order.status ('completed') se NE prevrača — to je fulfillment stanje, ne
//   plačilno (kuhinja je delo opravila).
// Kliče se POD paymentCheckLockKey(checkId) ključavnico (R109 lock graf P → C).
export async function recalcCheckAndOrderStatusAfterReversal(
  tx: Prisma.TransactionClient,
  checkId: string,
): Promise<void> {
  const check = await tx.check.findUnique({
    where: { id: checkId },
    select: { id: true, total: true, orderId: true },
  })
  if (!check) return

  // Neto plačilo: completed zneski MINUS refundAmount po VSEH plačilih čeka
  // (refundAmount knjigovodstvo obstaja na completed (delni refund) IN
  // refunded/voided (PUT claim zapiše refundAmount: paidAmount) vrsticah).
  const paidAgg = await tx.payment.aggregate({
    where: { checkId, status: 'completed' },
    _sum: { amount: true },
  })
  const refundedAgg = await tx.payment.aggregate({
    where: { checkId },
    _sum: { refundAmount: true },
  })
  const totalPaid = paidAgg._sum.amount ?? new Prisma.Decimal(0)
  const totalRefunded = refundedAgg._sum.refundAmount ?? new Prisma.Decimal(0)
  const netPaid = subtract(totalPaid, totalRefunded)

  // Storno ⟺ neto ≤ 0; partial ⟺ neto < total − 0.01 (isti ε prag kot
  // plačilna smer zgoraj); sicer paid. Decimal-varna primerjava (A7: prej
  // je refund pot računala neto v JS float, PUT pa sploh brez refundAmount).
  let checkStatus: import('@prisma/client').PaymentStatus = 'paid'
  if (!greaterThan(netPaid, 0)) {
    checkStatus = 'storno'
  } else if (!greaterThanOrEqual(netPaid, subtract(check.total, 0.01))) {
    checkStatus = 'partial'
  }

  await tx.check.update({
    where: { id: checkId },
    data: { paymentStatus: checkStatus },
  })

  // Order paymentStatus — agregacija čez VSE čeke naročila (split-check
  // varnost, BUG-HUNT FIX 2026-09-19 semantika ohranjena v kanonu).
  const orderId = check.orderId
  if (orderId) {
    const allOrderChecks = await tx.check.findMany({
      where: { orderId },
      select: { paymentStatus: true },
    })
    const allPaid = allOrderChecks.length > 0 && allOrderChecks.every(c => c.paymentStatus === 'paid')
    const allStorno = allOrderChecks.length > 0 && allOrderChecks.every(c => c.paymentStatus === 'storno')
    const anyPaidOrPartial = allOrderChecks.some(c => c.paymentStatus === 'paid' || c.paymentStatus === 'partial')
    const orderPaymentStatus: import('@prisma/client').PaymentStatus = allPaid
      ? 'paid'
      : allStorno
        ? 'storno'
        : anyPaidOrPartial
          ? 'partial'
          : 'unpaid'

    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: orderPaymentStatus,
        // paidAt obstaja ⟺ order trenutno v celoti plačan (R183 unifikacija)
        ...(orderPaymentStatus !== 'paid' ? { paidAt: null } : {}),
      },
    })
  }
}
