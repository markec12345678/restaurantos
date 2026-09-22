// ============================================
// POST /api/qr-pay/confirm — Gost potrdi plačilo preko QR
//
// R104 (koncurenčna + denarna integriteta, TOCTOU razred iz R100/R102/R103):
//
//   FORENZIKA: celoten tok je bil read-then-act BREZ transakcije:
//     1. check.paymentStatus==='paid' pre-check (read)   ← stale pod konkurenco
//     2. idempotencyKey findFirst (read)                 ← stale pod konkurenco
//     3. payment.create → check.update → order.update    ← 3 ločene operacije
//
//   Dva sočasna confirma (dvojni tap / dva taba / refresh):
//     - ISTI token → oba prebereta unpaid → drugi create pade na @unique
//       (P2002) → 500, čeprav je plačilo uspelo (klient ne ve, retry z novim
//       initom → NOV token → glej naslednjo točko)
//     - RAZLIČNA tokena (re-init izda NOV token; stari ostane HMAC-veljaven do
//       TTL — R82-D stateless kompromis) → idempotencyKey je različen →
//       unique constraint NE ščiti → DVE plačili → gost plača DVAKRAT (HIGH,
//       javna denarna pot)
//
//   Poleg tega: amount = celoten check.total + tip ne glede na paidSoFar →
//   delno plačan ček (paymentStatus 'partial') je bil zaračunan ŠE ENKRAT v
//   celoti (over-collection), in napitnina je bila šteta dvakrat v Z-report /
//   cash-close agregatih (amount JE vključeval tip + tipAmount je bil posebej).
//
//   FIX (kanon: staff plačilna pot src/app/api/payments/_helpers/create-payment.ts):
//     - $transaction(Serializable) + pg_advisory_xact_lock(hashtext(checkId))
//       — serializira sočasne confirme ISTEGA čeka ne glede na token
//     - tx-fresh check re-read + paymentStatus guard znotraj transakcije
//     - paidSoFar aggregate → amount = PREOSTANEK (blagovni del); tip ločeno
//       (staff semantika: delno plačan ček doplača samo manjkajoči del,
//       napitnina se šteje točno enkrat v fiskalnih agregatih)
//     - idempotent replay (isti token) → 200 z obstoječim paymentId (SKB
//       idempotency pravilo, create-payment.ts P0 FIX)
//     - P2002 race-path → 200 z obstoječim plačilom (nikoli 500)
//     - P2034 serialization conflict → 409 retry
// ============================================

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { toNum, subtract, greaterThan, round2 } from '@/lib/decimal'
import { parseJsonBody } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { verifyQrPayToken } from '@/lib/qr-pay-token'
import { checkRateLimitAsync, getClientIp, QR_PAY_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { structuredErrorResponse } from '@/lib/structured-error'
import { updateCheckAndOrderStatus } from '@/app/api/payments/_helpers/check-status'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const confirmSchema = z.object({
  checkId: z.string().min(1),
  paymentMethod: z.enum(['cash', 'card', 'apple-pay', 'google-pay']),
  tipAmount: z.number().min(0).default(0),
  sessionToken: z.string().min(1),
})

interface QrConfirmTxResult {
  paymentId: string
  amount: number
  tipAmount: number
  orderLocationId: string | null
  replay: boolean
}

export async function POST(req: Request) {
  try {
    // FIX R81 (javna plačilna pot): rate limit 10/min
    const clientIp = getClientIp(req)
    const rateCheck = await checkRateLimitAsync('qr-pay-confirm', clientIp, QR_PAY_LIMIT)
    if (!rateCheck.allowed) {
      return rateLimitedResponse(rateCheck.retryAfterMs, 'Preveč zahtevkov. Poskusite znova čez minuto.')
    }

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error } = confirmSchema.safeParse(bodyResult.data)
    if (error) {
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    // FIX R81 (LEAK-HIGH): sessionToken MORA biti veljaven HMAC za podani
    // checkId. Poceni zavrnitev (403) PRED transakcijo/DB — R82-D TTL lifecycle
    // prav tako teče tu (expired token nikoli ne doseže baze).
    if (!verifyQrPayToken(data.sessionToken, data.checkId)) {
      return NextResponse.json({ error: 'Neveljaven QR pay session' }, { status: 403 })
    }

    const idempotencyKey = `qrpay-${data.sessionToken}-${data.checkId}`

    let result: QrConfirmTxResult
    try {
      result = await db.$transaction(async (tx) => {
        // R104: advisory lock per ček — serializira sočasne confirme ISTEGA
        // čeka (isti ALI različen token — ključ je checkId, ne token). Kanon:
        // staff plačilna pot (create-payment.ts, P0 FIX Bug #1).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.checkId}))`

        // Idempotent replay (isti token / retry po prekinitvi povezave): vrni
        // obstoječe plačilo (200) — NE novega create-a in NE napake.
        const existing = await tx.payment.findUnique({ where: { idempotencyKey } })
        if (existing) {
          return {
            paymentId: existing.id,
            amount: toNum(existing.amount),
            tipAmount: toNum(existing.tipAmount),
            orderLocationId: null,
            replay: true,
          }
        }

        // Tx-fresh branje čeka (prej stale read-then-act izven transakcije)
        const check = await tx.check.findUnique({
          where: { id: data.checkId },
          include: { order: true },
        })
        if (!check) {
          throw { error: 'Ček ni najden', status: 404 }
        }
        if (check.paymentStatus === 'paid') {
          throw { error: 'Ček je že plačan', status: 400 }
        }

        // R104: preostanek za plačilo iz paidSoFar — prej amount = celoten
        // total + tip, kar je delno plačan ček zaračunalo še enkrat v celoti.
        const paidSoFar = await tx.payment.aggregate({
          where: { checkId: check.id, status: 'completed' },
          _sum: { amount: true },
        })
        const totalPaidSoFar = paidSoFar._sum.amount ?? new Prisma.Decimal(0)
        const remainingAmount = subtract(check.total, totalPaidSoFar)
        if (!greaterThan(remainingAmount, 0)) {
          throw { error: 'Ček je že plačan', status: 400 }
        }

        // Staff semantika: amount = blagovni del (BREZ napitnine), tipAmount
        // ločeno — Z-report / cash-close agregati štejejo napitnino točno enkrat.
        const goodsAmount = round2(remainingAmount)

        const payment = await tx.payment.create({
          data: {
            checkId: check.id,
            amount: goodsAmount,
            tipAmount: data.tipAmount,
            type: data.paymentMethod === 'cash' ? 'cash' : 'card',
            cardType: data.paymentMethod === 'apple-pay'
              ? 'apple-pay'
              : data.paymentMethod === 'google-pay' ? 'google-pay' : '',
            status: 'completed',
            idempotencyKey,
            employeeId: null, // QR pay = samo-postreženo
          },
        })

        // Usklajen status prehod čeka + naročila (multi-check zaveden,
        // partial → paid, order → completed) — ISTI helper kot staff pot.
        await updateCheckAndOrderStatus(tx, check.id, check.total, check.orderId)

        return {
          paymentId: payment.id,
          amount: goodsAmount,
          tipAmount: data.tipAmount,
          orderLocationId: check.order?.locationId ?? null,
          replay: false,
        }
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 8000,
      })
    } catch (txError: unknown) {
      // Race-path P2002 (defense-in-depth — advisory lock ga že preprečuje):
      // vzporedni request z ISTIM ključem je ustvaril plačilo → vrni obstoječe
      // (200), NIKOLI 500 (prej: klient ni vedel, da je plačilo uspelo).
      if (txError instanceof Prisma.PrismaClientKnownRequestError && txError.code === 'P2002') {
        const existing = await db.payment.findUnique({ where: { idempotencyKey } })
        if (existing) {
          return NextResponse.json({
            success: true,
            message: 'Plačilo že obdelano',
            paymentId: existing.id,
            amount: toNum(existing.amount),
            tipAmount: toNum(existing.tipAmount),
          }, { status: 200 })
        }
      }
      // P2034 serialization conflict → 409 retry (nikoli 500)
      if (txError instanceof Prisma.PrismaClientKnownRequestError && txError.code === 'P2034') {
        return NextResponse.json(
          { error: 'Plačilo je v obdelavi — poskusite znova čez nekaj sekund' },
          { status: 409 }
        )
      }
      throw txError
    }

    // Audit log — SAMO za novo plačilo (replay ne proži duplicirane revizije)
    if (!result.replay) {
      await db.auditLog.create({
        data: {
          action: 'QR_PAY_PAYMENT',
          entityType: 'Payment',
          entityId: result.paymentId,
          // FIX R81 (tenant model): lokacija prek check.order.locationId
          locationId: result.orderLocationId ?? null,
          details: JSON.stringify({
            checkId: data.checkId,
            amount: result.amount,
            tipAmount: result.tipAmount,
            paymentMethod: data.paymentMethod,
            source: 'qr-pay',
          }),
        },
      }).catch(() => {})
    }

    logger.info('QR-PAY', `Plačilo ${result.amount}€ (+${result.tipAmount}€ tip) preko QR pay (check ${data.checkId}, ${data.paymentMethod})`)

    return NextResponse.json({
      success: true,
      paymentId: result.paymentId,
      amount: result.amount,
      tipAmount: result.tipAmount,
      message: result.replay ? 'Plačilo že obdelano' : 'Plačilo uspešno!',
    }, { status: result.replay ? 200 : 201 })
  } catch (error: unknown) {
    // R104: strukturirani throw-i iz tx telesa ({ error, status }) → pravilen
    // 400/404 (prej '[object Object]' → 500); Error/Prisma napake gredo naprej.
    return structuredErrorResponse(error, 'POST /api/qr-pay/confirm', 'Napaka pri QR pay potrditvi')
  }
}
