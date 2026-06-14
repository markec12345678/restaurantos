// Pomožne funkcije za Payments API
// Izvlečene iz route.ts za boljšo berljivost in vzdrževanje

import { db, createAuditLog } from '@/lib/db'
import { toNum, greaterThan, greaterThanOrEqual, subtract, round2 } from '@/lib/decimal'
import { Prisma } from '@prisma/client'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'

// ─── Tipi ───────────────────────────────────────────────────

export interface PaymentInput {
  checkId: string
  amount: number | Prisma.Decimal
  tipAmount: number | Prisma.Decimal
  type: string
  alternatePaymentTypeId: string | null
  cardType: string | null
  cardLast4: string | null
  authorizationCode: string | null
  giftCardId: string | null
  loyaltyAccountId: string | null
  loyaltyPointsUsed: number
  employeeId: string | null
  idempotencyKey: string | null
}

// ─── Darilna kartica — upravljaj znotraj transakcije ────────

export async function handleGiftCardDeduction(
  tx: Prisma.TransactionClient,
  data: PaymentInput,
  checkOrderId: string | null,
): Promise<void> {
  if (data.type !== 'giftcard' || !data.giftCardId) return

  const giftCard = await tx.giftCard.findUnique({ where: { id: data.giftCardId } })
  if (!giftCard) {
    throw new Error('Darilna kartica ni najdena')
  }
  if (giftCard.status !== 'active') {
    throw new Error('Darilna kartica ni aktivna')
  }
  // FIX HIGH: Preveri, da kartica ni potekla
  if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
    await tx.giftCard.update({
      where: { id: data.giftCardId },
      data: { status: 'expired' },
    })
    throw new Error('Darilna kartica je potekla')
  }
  if (toNum(giftCard.balance) < toNum(data.amount)) {
    // FIX CRITICAL: Kartica nima dovolj sredstev za celoten znesek plačila.
    // Zavrnemo plačilo — klient mora poslati pravilen znesek (<= balance).
    // Delno plačilo z darilno kartico zahteva ločen POST z zneskom <= balance.
    throw new Error(`Stanje darilne kartice (${toNum(giftCard.balance).toFixed(2)} EUR) ni zadostno za plačilo ${toNum(data.amount).toFixed(2)} EUR. Posljite plačilo z zneskom ${toNum(giftCard.balance).toFixed(2)} EUR ali manj.`)
  }

  // Atomic decrement with balance check to prevent race conditions
  const updateResult = await tx.giftCard.updateMany({
    where: { id: data.giftCardId, balance: { gte: data.amount } },
    data: { balance: { decrement: data.amount } },
  })
  if (updateResult.count === 0) {
    throw new Error('Stanje darilne kartice ni zadostno ali je bilo spremenjeno')
  }

  // Check if card is now depleted
  const updatedCard = await tx.giftCard.findUnique({ where: { id: data.giftCardId } })
  if (updatedCard && !greaterThan(updatedCard.balance, 0)) {
    await tx.giftCard.update({ where: { id: data.giftCardId }, data: { status: 'depleted' } })
  }

  const newBalance = toNum(updatedCard?.balance)
  await tx.giftCardTransaction.create({
    data: {
      giftCardId: data.giftCardId,
      type: 'redeem',
      amount: -data.amount,
      balanceAfter: newBalance,
      orderId: checkOrderId || null,
      checkId: data.checkId,
      note: `Plačilo naročila`,
    },
  })
}

// ─── Zvestobne točke — odbitje znotraj transakcije ──────────

export async function handleLoyaltyPointsDeduction(
  tx: Prisma.TransactionClient,
  data: PaymentInput,
  checkOrderId: string | null,
): Promise<void> {
  if (data.type !== 'loyalty' || !data.loyaltyAccountId || data.loyaltyPointsUsed <= 0) return

  // OPTIMIZACIJA: select namesto privzetega include — potrebujemo samo isActive in pointsBalance
  const loyaltyAccount = await tx.loyaltyAccount.findUnique({
    where: { id: data.loyaltyAccountId },
    select: { isActive: true, pointsBalance: true },
  })
  if (!loyaltyAccount) {
    throw new Error('Zvestobni račun ni najden')
  }
  // FIX HIGH: Preveri, da je račun aktiven
  if (!loyaltyAccount.isActive) {
    throw new Error('Zvestobni račun ni aktiven')
  }
  if (loyaltyAccount.pointsBalance < data.loyaltyPointsUsed) {
    throw new Error('Ni dovolj točk na zvestobnem računu')
  }

  // FIX: Uporabi atomic decrement namesto read-then-write — prepreči race condition
  const updateResult = await tx.loyaltyAccount.updateMany({
    where: { id: data.loyaltyAccountId, pointsBalance: { gte: data.loyaltyPointsUsed } },
    data: { pointsBalance: { decrement: data.loyaltyPointsUsed } },
  })
  if (updateResult.count === 0) {
    throw new Error('Ni dovolj točk na zvestobnem računu (concurrent modification)')
  }

  await tx.loyaltyTransaction.create({
    data: {
      loyaltyAccountId: data.loyaltyAccountId,
      type: 'redeem',
      points: -data.loyaltyPointsUsed,
      reason: 'Unovčenje točk za plačilo',
      orderId: checkOrderId || null,
      checkId: data.checkId,
      monetaryValue: data.amount,
    },
  })
}

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

// ─── Zvestobne točke — pridobitev ob plačilu ────────────────

export async function handleLoyaltyEarn(
  tx: Prisma.TransactionClient,
  data: PaymentInput,
  checkOrderId: string | null,
): Promise<void> {
  // FIX HIGH: Samodejno pridobi zvestobne točke ob plačilu — loyalty earn
  if (!data.loyaltyAccountId || data.type === 'loyalty') return

  const settings = await tx.restaurantSettings.findFirst({ where: { isActive: true } })
  if (!settings?.loyaltyEnabled) return

  const pointsPerEuro = toNum(settings.loyaltyPointsPerEuro) || 1
  // Točke se računajo po znesku plačila (brez napitnine)
  const earnBase = round2(subtract(toNum(data.amount), toNum(data.tipAmount)))
  const pointsToEarn = Math.max(0, Math.floor(earnBase * pointsPerEuro))

  if (pointsToEarn <= 0) return

  // Atomic increment — prepreči race condition
  await tx.loyaltyAccount.updateMany({
    where: { id: data.loyaltyAccountId, isActive: true },
    data: {
      pointsBalance: { increment: pointsToEarn },
      lifetimePoints: { increment: pointsToEarn },
    },
  })

  await tx.loyaltyTransaction.create({
    data: {
      loyaltyAccountId: data.loyaltyAccountId,
      type: 'earn',
      points: pointsToEarn,
      reason: `Točke za plačilo ${toNum(data.amount).toFixed(2)} EUR`,
      orderId: checkOrderId || null,
      checkId: data.checkId,
      monetaryValue: earnBase,
    },
  })
}

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
