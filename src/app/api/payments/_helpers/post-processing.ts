// Pomožne funkcije za Payments API — Post-plačilna obdelava: audit, webhooki

import { db, createAuditLog } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import type { PaymentInput } from './types'

// ─── Post-plačilna obdelava: audit, webhooki ────────────────

export async function postPaymentProcessing(
  paymentId: string,
  data: PaymentInput,
  checkOrderId: string | null,
  employeeId: string | undefined,
): Promise<void> {
  // OPTIMIZACIJA: Promise.all za paralelno pridobivanje orderja za webhook
  // (paymentWithRelations se pridobi v route.ts za odziv)
  const [_paymentWithRelations, updatedOrder] = await Promise.all([
    db.payment.findUnique({
      where: { id: paymentId },
      include: {
        check: true,
        alternatePaymentType: true,
        giftCard: true,
        loyaltyAccount: true,
      },
    }),
    // OPTIMIZACIJA: select namesto include — potrebujemo samo status in podatke za webhook
    checkOrderId
      ? db.order.findUnique({
          where: { id: checkOrderId },
          select: { id: true, orderNumber: true, total: true, paymentStatus: true, paymentMethod: true, tip: true },
        })
      : Promise.resolve(null),
  ])

  // FIX: Audit log za plačilo
  await createAuditLog({
    userId: employeeId,
    action: 'CREATE_PAYMENT',
    entityType: 'Payment',
    entityId: paymentId,
    details: {
      checkId: data.checkId,
      amount: toNum(data.amount),
      type: data.type,
      tipAmount: toNum(data.tipAmount),
      giftCardUsed: !!data.giftCardId,
      loyaltyUsed: data.loyaltyPointsUsed > 0,
    },
  })

  // Webhook: payment.received
  emitEvent('payment.received', {
    paymentId,
    orderId: checkOrderId || '',
    amount: toNum(data.amount),
    type: data.type,
  }).catch(err => logger.error('API', '[Webhook] payment.received napaka:', err))

  // Webhook: order.paid — če je celoten order zdaj plačan
  if (updatedOrder?.paymentStatus === 'paid') {
    emitEvent('order.paid', {
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      total: toNum(updatedOrder.total), // FIX: Decimal→number za JSON
      paymentMethod: updatedOrder.paymentMethod,
      tip: toNum(updatedOrder.tip), // FIX: Decimal→number za JSON
    }).catch(err => logger.error('API', '[Webhook] order.paid napaka:', err))
  }
}
