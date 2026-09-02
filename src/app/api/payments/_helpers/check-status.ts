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
