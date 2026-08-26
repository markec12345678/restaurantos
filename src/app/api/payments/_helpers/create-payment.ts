import { logger } from "@/lib/logger"
import { generateJournalForPayment } from '@/lib/accounting/journal-generator'
// Pomožne funkcije za POST /api/payments — plačilna transakcija

import { db } from '@/lib/db'
import { toNum, deepToNumbers, greaterThan, subtract, add } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { validateApiResponse, handleApiError } from '@/lib/api-utils'
import { paymentResponseSchema, createPaymentSchema } from '@/lib/validations'
import { handleGiftCardDeduction } from './gift-card'
import { handleLoyaltyPointsDeduction, handleLoyaltyEarn } from './loyalty'
import { updateCheckAndOrderStatus } from './check-status'
import { postPaymentProcessing } from './post-processing'
import { type PaymentInput } from './types'

type CreatePaymentInput = z.infer<typeof createPaymentSchema>

import { z } from 'zod'

// ─── Idempotency pomožne funkcije ────────────────────────────────────────────
// P0 FIX: Idempotency plačil — prepreči dvojno zaračunavanje.
//
// Scenariji, ki jih pokrijemo:
//   1. Natakar dvakrat klikne "Plačaj" (double-click)
//   2. Browser/React-Query retry-a request
//   3. Mobilna povezava za trenutek prekine → klient ne ve ali je plačilo uspelo → retry
//   4. Dve vzporedni generirani plačili z istim ključem (race condition)
//
// Pravilo (SKB idempotency):
//   Če idempotencyKey že obstaja → vrni obstoječi rezultat (200), NE ustvari novega plačila,
//   NE vrni napake. Klient vidi isto transakcijo (isti paymentId) ne glede na število poskusov.
//
// Implementacija:
//   - Fast path: findFirst pred transakcijo → če obstaja, vrni takoj.
//   - Race path: če vzporedni request zmaga pri create (unique constraint P2002),
//     ponovno poišči obstoječi rezultat in vrni njega (NE 500 napake).
//   - DB zaščita: @unique na idempotencyKey v Prisma shemi je končna varovalka.

/**
 * Poišče obstoječe plačilo po idempotencyKey z vsemi relacijami.
 * Uporablja se v fast-path in race-path (po P2002).
 */
async function findExistingPaymentByIdempotencyKey(idempotencyKey: string) {
  return db.payment.findFirst({
    where: { idempotencyKey },
    include: {
      check: true,
      alternatePaymentType: true,
      giftCard: true,
      loyaltyAccount: true,
    },
  })
}

/**
 * Prepozna Prisma unique constraint violation (P2002).
 * To se zgodi, ko dva vzporedna requesta poskusiata ustvariti plačilo z istim idempotencyKey.
 * Uporablja Prisma lastno razred napak (PrismaClientKnownRequestError) za kanonsko detekcijo.
 */
function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export async function handleCreatePayment(
  data: CreatePaymentInput,
  employeeId: string | null | undefined,
) {
  // ─── IDEMPOTENCY: Fast path ───────────────────────────────────────────────
  // Če idempotencyKey že obstaja v bazi, vrni obstoječi rezultat takoj.
  // Ne ustvarjaj novega plačila, ne vrni napake — klient vidi isto transakcijo.
  if (data.idempotencyKey) {
    const existing = await findExistingPaymentByIdempotencyKey(data.idempotencyKey)
    if (existing) {
      return NextResponse.json(deepToNumbers(existing), { status: 200 })
    }
  }

  // Preveri check
  const check = await db.check.findUnique({
    where: { id: data.checkId },
    select: { id: true, total: true, orderId: true },
  })
  if (!check) return NextResponse.json({ error: 'Ček ni najden' }, { status: 404 })

  const paymentInput: PaymentInput = {
    checkId: data.checkId,
    amount: data.amount,
    tipAmount: data.tipAmount,
    type: data.type,
    alternatePaymentTypeId: data.alternatePaymentTypeId ?? null,
    cardType: data.cardType ?? null,
    cardLast4: data.cardLast4 ?? null,
    authorizationCode: data.authorizationCode ?? null,
    giftCardId: data.giftCardId ?? null,
    loyaltyAccountId: data.loyaltyAccountId ?? null,
    loyaltyPointsUsed: data.loyaltyPointsUsed ?? 0,
    employeeId: data.employeeId ?? employeeId ?? null,
    idempotencyKey: data.idempotencyKey ?? null,
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const paidSoFar = await tx.payment.aggregate({
        where: { checkId: data.checkId, status: 'completed' },
        _sum: { amount: true },
      })
      const totalPaidSoFar = paidSoFar._sum.amount ?? new Prisma.Decimal(0)
      const remainingAmount = subtract(check.total, totalPaidSoFar)
      if (greaterThan(data.amount, add(remainingAmount, 0.01))) {
        throw new Error(`OVERPAYMENT:${data.amount.toFixed(2)}:${toNum(remainingAmount).toFixed(2)}`)
      }

      const payment = await tx.payment.create({
        data: {
          checkId: data.checkId,
          amount: data.amount,
          tipAmount: data.tipAmount,
          type: data.type,
          alternatePaymentTypeId: paymentInput.alternatePaymentTypeId ?? undefined,
          cardType: paymentInput.cardType ?? undefined,
          cardLast4: paymentInput.cardLast4 ?? undefined,
          authorizationCode: paymentInput.authorizationCode ?? undefined,
          giftCardId: paymentInput.giftCardId ?? undefined,
          loyaltyAccountId: paymentInput.loyaltyAccountId ?? undefined,
          loyaltyPointsUsed: paymentInput.loyaltyPointsUsed,
          status: 'completed',
          employeeId: paymentInput.employeeId ?? undefined,
          idempotencyKey: paymentInput.idempotencyKey ?? undefined,
        },
      })

      await handleGiftCardDeduction(tx, paymentInput, check.orderId)
      await handleLoyaltyPointsDeduction(tx, paymentInput, check.orderId)
      await updateCheckAndOrderStatus(tx, data.checkId, check.total, check.orderId)
      await handleLoyaltyEarn(tx, paymentInput, check.orderId)

      return payment
    })

    await postPaymentProcessing(result.id, paymentInput, check.orderId, employeeId ?? undefined)

    // FIX FASE 1: Avtomatsko generiraj knjigovodski vnos (double-entry)
    // Non-blocking — če spodleti, ne prekini plačila (samo zabeleži napako)
    generateJournalForPayment(check.orderId, result.id, employeeId ?? undefined).catch((err) => {
      logger.error("CONSOLE", '[Journal] Avtomatsko knjiženje spodletelo:', err)
    })

    const paymentWithRelations = await db.payment.findUnique({
      where: { id: result.id },
      include: { check: true, alternatePaymentType: true, giftCard: true, loyaltyAccount: true },
    })

    return NextResponse.json(validateApiResponse(deepToNumbers(paymentWithRelations), paymentResponseSchema, 'POST /api/payments'), { status: 201 })
  } catch (error: unknown) {
    // ─── IDEMPOTENCY: Race path ─────────────────────────────────────────────
    // P0 FIX: Če je prišlo do unique constraint violation (P2002) na idempotencyKey,
    // pomeni da je vzporedni request (double-click / retry / reconnect) ŽE ustvaril
    // plačilo z istim ključem. Vrni obstoječi rezultat (200) — NE napake (500).
    //
    // Brez te veje bi klient videl "Napaka pri ustvarjanju plačila" (500), čeprav je
    // plačilo dejansko uspelo. Natakar bi lahko mislil, da plačilo ni uspelo, in
    // poskusil znova z novim ključem → pravo dvojno plačilo.
    if (data.idempotencyKey && isUniqueConstraintViolation(error)) {
      const existing = await findExistingPaymentByIdempotencyKey(data.idempotencyKey)
      if (existing) {
        return NextResponse.json(deepToNumbers(existing), { status: 200 })
      }
      // Fallback: P2002 je bil na drugem stolpcu (teoretično nemogoče za idempotencyKey,
      // a varnostno preverimo) — vrni splošno napako.
    }

    if (error instanceof Error) {
      const clientErrorPatterns = ['ni aktiven', 'ni najden', 'ni zadostno', 'potekel', 'še ni veljaven', 'največkrat', 'ni na voljo', 'suspendirana']
      if (clientErrorPatterns.some(p => error.message.includes(p))) {
        return handleApiError(error, 'POST /api/payments', error.message, 400)
      }
      if (error.message.includes('OVERPAYMENT')) {
        const parts = error.message.split(':')
        return NextResponse.json(
          { error: `Znesek plačila (${parts[1] || '0.00'} EUR) presega preostali znesek čeka (${parts[2] || '0.00'} EUR)` },
          { status: 400 }
        )
      }
    }
    return handleApiError(error, 'POST /api/payments', 'Napaka pri ustvarjanju plačila')
  }
}
