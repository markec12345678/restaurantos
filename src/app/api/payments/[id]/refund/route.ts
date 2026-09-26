// POST /api/payments/[id]/refund — Delno ali popolno povračilo plačila
// FIX BUG-PAY-1: Prej je refund samo posodobil refundAmount, brez reversal side-effects.
// Sedaj reverzira: gift card, loyalty points, check/order status, discount counter.
import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { Prisma } from '@prisma/client'
import { structuredErrorResponse } from '@/lib/structured-error'
import { logger } from '@/lib/logger'
// FIX R112 (RL-2): rate-limit importi — helper po hišnem kanonu DIREKTNO iz
// rate-limit/response (NE prek barrela; barrel mockajo testi brez helperja).
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { generateJournalForRefund } from '@/lib/accounting/journal-generator'
import { paymentMutationLockKey, paymentCheckLockKey } from '../_helpers'
import { z } from 'zod'

import { formatEUR } from '@/lib/safe-format'
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

    // FIX R112 (RL-2): finančni zapis (povračilo) — AUTHENTICATED_LIMIT kvota
    // takoj za uspešno avtentikacijo, PRED body parse / DB zapisom.
    const rl = await checkRateLimitAsync('authenticated-write', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtev. Poskusite znova čez nekaj časa.')

    // FIX P0-C1 (IDOR): findUnique → findFirst z check.order.locationId scope (cross-tenant zaščita)
    // Payment nima lastnega locationId — scoping prek Check → Order relation
    // FIX R86-2a (M2 fail-open): centralni resolver namesto raw spread-a —
    // regularna NULL-location seja je prej lahko povrnila plačilo KATEREGA KOLI
    // tenanta (gift card/loyalty reverzi).
    // FIX R87-4 (higiena, R86-FINAL-AUDIT LOW #3): resolver PRED body parse.
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/payments/[id]/refund',
    })
    if ('error' in scope) return scope.error

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Manjkajoči podatki' }, { status: 400 })

    const { amount, reason, employeeId } = refundSchema.parse(body)

    const payment = await db.payment.findFirst({
      where: {
        id,
        ...(scope.locationId
          ? { check: { order: { locationId: scope.locationId } } }
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
      // R109 (PAY-1): unificiran per-payment ključ — prej hashtext(id), PUT
      // refund/void pa 'payment-void:'+id → različna ključa = cross-path
      // dvojno povračilo (oba reversal-a). Zdaj obe ruti na istem ključu.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${paymentMutationLockKey(id)}))`
      // R109: drugi (check-level) ključ — enak kot create-payment/qr-pay →
      // check.paymentStatus derivacija + totals mutacije istega čeka se
      // serializirajo čez vse pisalne tokove (lock graf: P → C, brez ciklov;
      // checkId na plačilu je imutabilen → ključ iz outer reada je varen).
      if (payment.checkId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${paymentCheckLockKey(payment.checkId)}))`
      }

      // PONOVN preberi refundAmount znotraj zaklenjene transakcije (avtoritativno)
      const lockedPayment = await tx.payment.findUnique({
        where: { id },
        select: { refundAmount: true, amount: true, status: true },
      })
      if (!lockedPayment) {
        // R109 (error kontrakt): strukturirani throw — prej string-matching
        // 'PAYMENT_NOT_FOUND' v catch bloku (R103 canonical pariteta).
        throw { error: 'Plačilo ni najdeno', status: 404 }
      }

      // BUG-HUNT FIX 2026-09-19 (CRITICAL, dvojno povračilo): status je bil
      // selektiran, a NIKOLI preverjen. Plačilo v stanju refunded/voided (prek
      // PUT /api/payments/[id]) ali pending/failed NI refundabilno — prej je
      // refund potekel znova → gift card/loyalty DVAJKRAT kreditirana.
      if (lockedPayment.status !== 'completed') {
        throw {
          error: `Plačilo v stanju '${lockedPayment.status}' ni povračljivo. Povračilo je dovoljeno samo za zaključena (completed) plačila.`,
          status: 409,
        }
      }

      const lockedRefunded = toNum(lockedPayment.refundAmount)
      const lockedMaxRefundable = toNum(lockedPayment.amount) - lockedRefunded
      if (amount > lockedMaxRefundable) {
        throw {
          error: `Znesek povračila (${formatEUR(amount.toFixed(2))}) presega max povračilo (${formatEUR(lockedMaxRefundable.toFixed(2))})`,
          status: 400,
        }
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
        logger.info('REFUND', `Gift card ${payment.giftCardId} rechargeana za ${formatEUR(refundToGiftCard)}`)
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
        // BUG-HUNT FIX 2026-09-19 (split-check): prej je order status bil deriviran
        // iz ENEGA čeka — refund enega čeka je flipnil celoten order na
        // 'partial'/'storno', čeprav so ostali čeki še vedno plačani (EOD/Z in
        // zaprtje izmene nato napačno filtrirajo). Agregiramo VSE čeke orderja.
        if (payment.check.orderId) {
          const allOrderChecks = await tx.check.findMany({
            where: { orderId: payment.check.orderId },
            select: { paymentStatus: true },
          })
          const allPaid = allOrderChecks.length > 0 && allOrderChecks.every(c => c.paymentStatus === 'paid')
          const allStorno = allOrderChecks.length > 0 && allOrderChecks.every(c => c.paymentStatus === 'storno')
          const anyPaidOrPartial = allOrderChecks.some(c => c.paymentStatus === 'paid' || c.paymentStatus === 'partial')
          const orderPaymentStatus = allPaid
            ? 'paid'
            : allStorno
              ? 'storno'
              : anyPaidOrPartial
                ? 'partial'
                : 'unpaid'
          await tx.order.update({
            where: { id: payment.check.orderId },
            data: { paymentStatus: orderPaymentStatus },
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
          // FIX R81 (tenant model): lokacija plačila prek check.order.locationId
          // (Payment nima lastnega locationId); fallback = seja.
          locationId: payment.check.order.locationId ?? authResult.session?.locationId ?? null,
          details: JSON.stringify({
            amount, reason, previousRefund: currentRefunded, newRefund: newRefundAmount,
            fullyRefunded: isFullyRefunded,
            giftCardReversed: !!payment.giftCardId,
            // R144-b: forenzika darilne kartice — samo ID (cardNumber je
            // spendable secret, NIKOLI v audit; last4 ni na voljo brez extra
            // reada — ID poveže vrstico z GiftCard ledger/audit sledjo).
            giftCardId: payment.giftCardId ?? null,
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
    // R109 (error kontrakt): P2002/P2034 race-pathi → 409 (nikoli 500);
    // strukturirani { error, status } throw-i iz tx teles → pravi statusi
    // (prej: string-matching REFUND_EXCEEDS/PAYMENT_NOT_FOUND/PAYMENT_NOT_REFUNDABLE
    // — R103 canonical pariteta, isti odgovori kot prej).
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return NextResponse.json(
        { error: 'Plačilo je v obdelavi (sočasen dostop) — osvežite in poskusite znova' },
        { status: 409 }
      )
    }
    return structuredErrorResponse(error, 'POST /api/payments/[id]/refund', 'Napaka pri povračilu plačila')
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
