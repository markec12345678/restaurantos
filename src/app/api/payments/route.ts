import { db } from '@/lib/db'
import { deepToNumbers, toNum, greaterThan, subtract, add } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth-middleware'
import { createPaymentSchema, paymentResponseSchema, paymentsListResponseSchema } from '@/lib/validations'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError, validateRequest, validateApiResponse } from '@/lib/api-utils'
import {
  handleGiftCardDeduction,
  handleLoyaltyPointsDeduction,
  updateCheckAndOrderStatus,
  handleLoyaltyEarn,
  postPaymentProcessing,
  type PaymentInput,
} from './_helpers'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja za plačila
    const rl = checkRateLimit('payments', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })
    // Auth check — requires manage_cash permission
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error
    const { searchParams } = new URL(req.url)
    const checkId = searchParams.get('checkId')
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const where: Record<string, unknown> = {}
    if (checkId) where.checkId = checkId
    if (type) where.type = type
    if (status) where.status = status
    // FIX HIGH: Paginacija — prepreči nalaganje vseh plačil
    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset
    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          check: { select: { id: true, checkNumber: true, orderId: true } },
          alternatePaymentType: true,
          giftCard: true,
          loyaltyAccount: true,
        },
      }),
      db.payment.count({ where }),
    ])
    return NextResponse.json(validateApiResponse({ payments: deepToNumbers(payments), total, limit, offset }, paymentsListResponseSchema, 'GET /api/payments'))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/payments', 'Napaka pri pridobivanju plačil')
  }
}

export async function POST(req: Request) {
  try {
    // Rate limiting — FINANCIAL ENDPOINT: striktna omejitev
    const rl = checkRateLimit('payments-post', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })
    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    // FIX H-01: Validiraj vnos z Zod + omejitev velikosti + sanatizacija
    const { data, error: validationError } = await validateRequest(req, createPaymentSchema, { maxBodySize: 512 * 1024 })
    if (validationError) return validationError
    // FIX HIGH: Idempotency — prepreči duplikatna plačila ob double-click
    if (data.idempotencyKey) {
      const existing = await db.payment.findFirst({
        where: { idempotencyKey: data.idempotencyKey },
        include: {
          check: true,
          alternatePaymentType: true,
          giftCard: true,
          loyaltyAccount: true,
        },
      })
      if (existing) {
        return NextResponse.json(deepToNumbers(existing), { status: 200 })
      }
    }
    // Preveri, da check obstaja
    const check = await db.check.findUnique({
      where: { id: data.checkId },
      select: { id: true, total: true, orderId: true },
    })
    if (!check) {
      return NextResponse.json({ error: 'Ček ni najden' }, { status: 404 })
    }

    const paymentInput: PaymentInput = {
      checkId: data.checkId,
      amount: data.amount,
      tipAmount: data.tipAmount,
      type: data.type,
      alternatePaymentTypeId: data.alternatePaymentTypeId || null,
      cardType: data.cardType,
      cardLast4: data.cardLast4,
      authorizationCode: data.authorizationCode,
      giftCardId: data.giftCardId || null,
      loyaltyAccountId: data.loyaltyAccountId || null,
      loyaltyPointsUsed: data.loyaltyPointsUsed,
      employeeId: data.employeeId || authResult.session?.employeeId || null,
      idempotencyKey: data.idempotencyKey || null,
    }

    // FIX H-05: Vse operacije (plačilo + gift card/loyalty) v eni transakciji
    const result = await db.$transaction(async (tx) => {
      // OPTIMIZACIJA: aggregate() namesto findMany + sumBy
      const paidSoFar = await tx.payment.aggregate({
        where: { checkId: data.checkId, status: 'completed' },
        _sum: { amount: true },
      })
      const totalPaidSoFar = paidSoFar._sum.amount ?? new Prisma.Decimal(0)
      const remainingAmount = subtract(check.total, totalPaidSoFar)
      if (greaterThan(data.amount, add(remainingAmount, 0.01))) {
        throw new Error(`OVERPAYMENT:${data.amount.toFixed(2)}:${toNum(remainingAmount).toFixed(2)}`)
      }

      // Ustvari plačilo
      const payment = await tx.payment.create({
        data: {
          checkId: data.checkId,
          amount: data.amount,
          tipAmount: data.tipAmount,
          type: data.type,
          alternatePaymentTypeId: paymentInput.alternatePaymentTypeId,
          cardType: data.cardType,
          cardLast4: data.cardLast4,
          authorizationCode: data.authorizationCode,
          giftCardId: paymentInput.giftCardId,
          loyaltyAccountId: paymentInput.loyaltyAccountId,
          loyaltyPointsUsed: data.loyaltyPointsUsed,
          status: 'completed', // FIX H-08: Server-side default — client cannot set status
          employeeId: paymentInput.employeeId,
          idempotencyKey: paymentInput.idempotencyKey,
        },
      })

      // Gift card balance deduction — ATOMNO znotraj transakcije (FIX C-03: atomic decrement)
      await handleGiftCardDeduction(tx, paymentInput, check.orderId)

      // Loyalty points deduction — ATOMNO znotraj transakcije
      await handleLoyaltyPointsDeduction(tx, paymentInput, check.orderId)

      // Posodobi plačilni status čeka in naročila
      await updateCheckAndOrderStatus(tx, data.checkId, check.total, check.orderId)

      // FIX BUG-1 CRITICAL: Popust je že bil validiran in currentUses povečan ob ustvarjanju čeka.
      // Ne povečuj currentUses še enkrat — to bi povzročilo dvojno štetje!

      // Loyalty earn — pridobi točke ob plačilu
      await handleLoyaltyEarn(tx, paymentInput, check.orderId)

      return payment
    })

    // Post-plačilna obdelava: audit log, webhooki, pridobi relacije za odziv
    await postPaymentProcessing(result.id, paymentInput, check.orderId, authResult.session?.employeeId)

    // Pridobi plačilo z relacijami za odziv
    const paymentWithRelations = await db.payment.findUnique({
      where: { id: result.id },
      include: {
        check: true,
        alternatePaymentType: true,
        giftCard: true,
        loyaltyAccount: true,
      },
    })

    return NextResponse.json(validateApiResponse(deepToNumbers(paymentWithRelations), paymentResponseSchema, 'POST /api/payments'), { status: 201 })
  } catch (error: unknown) {
    // Poslovne napake s podniz ujemanjem
    if (error instanceof Error) {
      const clientErrorPatterns = ['ni aktiven', 'ni najden', 'ni zadostno', 'potekel', 'še ni veljaven', 'največkrat', 'ni na voljo', 'suspendirana']
      if (clientErrorPatterns.some(p => error.message.includes(p))) {
        return handleApiError(error, 'POST /api/payments', error.message, 400)
      }
      // FIX BUG-3 HIGH: Over-payment iz transakcije — vrni pravo sporočilo
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
