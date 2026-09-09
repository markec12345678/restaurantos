// POST /api/payments/[id]/refund — Delno ali popolno povračilo plačila
// FIX BUG-PAY-1: Prej je refund samo posodobil refundAmount, brez reversal side-effects.
// Sedaj reverzira: gift card, loyalty points, check/order status, discount counter.
import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { generateJournalForRefund } from '@/lib/accounting/journal-generator'
import { z } from 'zod'

const refundSchema = z.object({
  amount: z.number().positive('Znesek povračila mora biti pozitiven'),
  reason: z.string().max(500).default(''),
  employeeId: z.string().nullable().optional(),
})

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Manjkajoči podatki' }, { status: 400 })

    const { amount, reason, employeeId } = refundSchema.parse(body)

    // FIX P0-C1 (IDOR): findUnique → findFirst z check.order.locationId scope (cross-tenant zaščita)
    // Payment nima lastnega locationId — scoping prek Check → Order relation
    const sessionLocationId = authResult.session?.locationId ?? undefined
    const payment = await db.payment.findFirst({
      where: {
        id,
        ...(sessionLocationId
          ? { check: { order: { locationId: sessionLocationId } } }
          : {}),
      },
      include: {
        check: { include: { order: true } },
        giftCard: true,
        loyaltyAccount: true,
      },
    })
    if (!payment) return NextResponse.json({ error: 'Plačilo ni najdeno' }, { status: 404 })

    const currentRefunded = toNum(payment.refundAmount)

    // FIX BUG-PAY-1: Transakcija z vsemi reversal side-effects
    //
    // PAYMENT AUDIT 2026-09-09 (race condition): prej je bila validacija
    // `amount > maxRefundable` izvedena IZVEN transakcije na zastarelem
    // branju refundAmount. Dva vzporedna refunda istega plačila sta oba
    // prebrala refundAmount=0 → oba prestala validacijo → oba zapisala
    // newRefundAmount=amount (izgubljen update) → dvojno povračilo
    // (gift card dvakrat polnjena, točke dvakrat vrnjene).
    //
    // Fix: pg_advisory_xact_lock na paymentId (enak vzorec kot create-payment)
    // + PONOVN pre branje refundAmount in validacija ZNOTRAJ transakcije.
    //
    // FIX (timeout): refund transakcija je LAHKA za bazo, ampak TEŽKA za čas:
    //   advisory lock (vzporedni refundi ČAKAJO na zaklep) + gift card/loyalty
    //   reverza + posodobitve Check/Order + generateJournalForRefund (DDV split).
    //   Prisma privzeti interactive timeout 5s je pretesen — pod obremenitvijo
    //   (lock contention) transakcija preteče in vrne 500 "Transaction already
    //   closed" (zgodbilo se je tudi v E2E na počasnejši PGlite bazi).
    //   timeout 20s + maxWait 10s: refund je kritična poslovna operacija —
    //   raje počasi kot napačno.
    const updated = await db.$transaction(async (tx) => {
      // Zakleni vrstico plačila — vzporedni refundi čakajo, dokler ta ne konča
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`

      // PONOVN preberi refundAmount znotraj zaklenjene transakcije (avtoritativno)
      const lockedPayment = await tx.payment.findUnique({
        where: { id },
        select: { refundAmount: true, amount: true, status: true },
      })
      if (!lockedPayment) {
        throw new Error('PAYMENT_NOT_FOUND')
      }

      const lockedRefunded = toNum(lockedPayment.refundAmount)
      const lockedMaxRefundable = toNum(lockedPayment.amount) - lockedRefunded
      if (amount > lockedMaxRefundable) {
        throw new Error(`REFUND_EXCEEDS:${amount.toFixed(2)}:${lockedMaxRefundable.toFixed(2)}`)
      }

      const newRefundAmount = lockedRefunded + amount
      const isFullyRefunded = newRefundAmount >= toNum(payment.amount)
      const refundRatio = amount / toNum(payment.amount) // razmerje za delne reverze

      // 1. Posodobi Payment — increment (ne absolutni zapis!) za dodatno
      // varovalko pred izgubljenimi update-i
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          refundAmount: { increment: amount },
          ...(isFullyRefunded ? { status: 'refunded' } : {}),
        },
      })

      // 2. FIX: Reverziraj gift card (če je bilo plačilo z gift card)
      if (payment.giftCardId && payment.type === 'giftcard') {
        const refundToGiftCard = round2(amount)
        const currentBalance = await tx.giftCard.findUnique({
          where: { id: payment.giftCardId },
          select: { balance: true },
        })
        await tx.giftCard.update({
          where: { id: payment.giftCardId },
          data: { balance: { increment: refundToGiftCard } },
        })
        await tx.giftCardTransaction.create({
          data: {
            giftCardId: payment.giftCardId,
            type: 'load',
            amount: refundToGiftCard,
            balanceAfter: toNum(currentBalance?.balance) + refundToGiftCard,
            note: `REFUND: ${reason || 'Povračilo plačila'}`,
          },
        })
        logger.info('REFUND', `Gift card ${payment.giftCardId} rechargeana za €${refundToGiftCard}`)
      }

      // 3. FIX: Reverziraj loyalty točke (če je bilo plačilo z loyalty)
      if (payment.loyaltyAccountId && payment.type === 'loyalty' && payment.loyaltyPointsUsed > 0) {
        const pointsToRefund = Math.round(payment.loyaltyPointsUsed * refundRatio)
        await tx.loyaltyAccount.update({
          where: { id: payment.loyaltyAccountId },
          data: { pointsBalance: { increment: pointsToRefund } },
        })
        await tx.loyaltyTransaction.create({
          data: {
            loyaltyAccountId: payment.loyaltyAccountId,
            type: 'adjust',
            points: pointsToRefund,
            reason: `REFUND: Vračilo ${pointsToRefund} točk za povračilo plačila`,
          },
        })
        logger.info('REFUND', `Loyalty ${payment.loyaltyAccountId}: vrnjenih ${pointsToRefund} točk`)
      }

      // 4. FIX: Reverziraj earned loyalty točke (če je popoln refund)
      if (isFullyRefunded && payment.check?.order?.guestId) {
        const earnedPoints = Math.floor(toNum(payment.amount) * 0.01)
        if (earnedPoints > 0) {
          // FIX: guestId ne obstaja na LoyaltyAccount — uporabimo guest relacijo
          const loyaltyAccount = await tx.loyaltyAccount.findFirst({
            where: { guest: { id: payment.check.order.guestId } },
          })
          if (loyaltyAccount) {
            await tx.loyaltyAccount.update({
              where: { id: loyaltyAccount.id },
              data: {
                pointsBalance: { decrement: earnedPoints },
                lifetimePoints: { decrement: earnedPoints },
              },
            })
            await tx.loyaltyTransaction.create({
              data: {
                loyaltyAccountId: loyaltyAccount.id,
                type: 'adjust',
                points: -earnedPoints,
                reason: `REFUND: Odvzetje ${earnedPoints} earned točk ob povračilu`,
              },
            })
          }
        }
      }

      // 5. FIX: Posodobi Check paymentStatus
      if (payment.checkId) {
        const totalCheckPaid = await tx.payment.aggregate({
          where: { checkId: payment.checkId, status: 'completed' },
          _sum: { amount: true },
        })
        const totalRefunded = await tx.payment.aggregate({
          where: { checkId: payment.checkId },
          _sum: { refundAmount: true },
        })
        const netPaid = toNum(totalCheckPaid._sum.amount) - toNum(totalRefunded._sum.refundAmount)
        const checkTotal = toNum(payment.check.total)

        let checkStatus = 'paid'
        if (netPaid <= 0) checkStatus = 'storno' // FIX Test 4.2: fully refunded → storno (not unpaid)
        else if (netPaid < checkTotal) checkStatus = 'partial'

        await tx.check.update({
          where: { id: payment.checkId },
          data: { paymentStatus: checkStatus },
        })

        // 6. FIX: Posodobi Order paymentStatus
        if (payment.check.orderId) {
          await tx.order.update({
            where: { id: payment.check.orderId },
            data: { paymentStatus: checkStatus },
          })
        }
      }

      // 7. Audit log
      await tx.auditLog.create({
        data: {
          userId: employeeId || authResult.session?.employeeId || null,
          action: 'REFUND_PAYMENT',
          entityType: 'Payment',
          entityId: id,
          details: JSON.stringify({
            amount, reason, previousRefund: currentRefunded, newRefund: newRefundAmount,
            fullyRefunded: isFullyRefunded,
            giftCardReversed: !!payment.giftCardId,
            loyaltyReversed: !!payment.loyaltyAccountId,
            checkUpdated: !!payment.checkId,
          }),
          ipAddress: '',
        },
      })

      // 8. P1-18: knjigovodska reverza (accounting reversal) v ISTI transakciji
      // kot refund — specifikacija: "refund in accounting reversal" morata biti
      // atomarna. Prej je refund pustil plačilni JE netaknjen (knjigovodstvo je
      // kazalo prihodek, ki je bil dejansko vrnjen).
      // Idempotentna (reference = refund:paymentId:kumulativa) — duplikat
      // preskoči create. Napaka journal-a NE vrže refunda (vračilo denarja je
      // poslovno kritičnejše od knjigovodske vrstice; vrzel je vidna v log-u).
      const order = payment.check?.order
      // P1-accounting (DDV): delež DDV tega vračila — proporcionalno po
      // DDV deležu plačila na čeku (check.tax × payment/check.total) × razmerje vračila
      const checkTotal = toNum(payment.check?.total)
      const checkTax = toNum(payment.check?.tax)
      const paymentTax = checkTotal > 0 ? checkTax * (toNum(payment.amount) / checkTotal) : 0
      const vatPortion = round2(Math.max(0, paymentTax * refundRatio))
      let journalEntryId: string | null = null
      try {
        journalEntryId = await generateJournalForRefund(tx, {
          paymentId: id,
          refundAmount: amount,
          cumulativeRefundAmount: newRefundAmount,
          tipPortion: round2(toNum(payment.tipAmount) * refundRatio),
          vatPortion,
          orderType: order?.type ?? 'dine-in',
          orderNumber: order?.orderNumber ?? '',
          customerName: order?.customerName ?? '',
          paymentType: payment.type,
          locationId: order?.locationId ?? null,
          employeeId: employeeId || authResult.session?.employeeId || null,
          reason: reason || undefined,
        })
      } catch (journalErr) {
        // Ne prekini refunda — glej komentar v generateJournalForRefund
        logger.error('REFUND', 'Accounting reversal ni uspel (refund ostaja veljaven):', journalErr)
      }

      return { payment: updatedPayment, journalEntryId }
    }, {
      // FIX (timeout): glej komentar zgoraj — privzetih 5s ni dovolj za
      // lock-contended refund transakcijo (advisory lock + reversal + journal)
      timeout: 20_000,
      maxWait: 10_000,
    })

    return NextResponse.json({
      success: true,
      payment: { ...updated.payment, refundAmount: toNum(updated.payment.refundAmount) },
      refundAmount: amount,
      totalRefunded: currentRefunded + amount,
      fullyRefunded: toNum(updated.payment.refundAmount) >= toNum(payment.amount),
    })
  } catch (error: unknown) {
    // PAYMENT AUDIT: specifične napake iz zaklenjene transakcije → 4xx
    if (error instanceof Error) {
      if (error.message.includes('REFUND_EXCEEDS')) {
        const [, refundStr, maxStr] = error.message.split(':')
        return NextResponse.json(
          { error: `Znesek povračila (€${refundStr}) presega max povračilo (€${maxStr})` },
          { status: 400 }
        )
      }
      if (error.message.includes('PAYMENT_NOT_FOUND')) {
        return NextResponse.json({ error: 'Plačilo ni najdeno' }, { status: 404 })
      }
    }
    return handleApiError(error, 'POST /api/payments/[id]/refund', 'Napaka pri povračilu plačila')
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
