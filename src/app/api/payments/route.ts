import { db, createAuditLog } from '@/lib/db'
import { deepToNumbers, toNum, greaterThan, greaterThanOrEqual, subtract, add, round2 } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth-middleware'
import { createPaymentSchema, paymentResponseSchema, paymentsListResponseSchema } from '@/lib/validations'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError, validateRequest, validateApiResponse } from '@/lib/api-utils'
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
    // Če klient pošlje idempotencyKey in že obstaja plačilo s tem ključem, vrni obstoječe
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
        // Vrni obstoječe plačilo — ni napaka, samo duplikat
        return NextResponse.json(deepToNumbers(existing), { status: 200 })
      }
    }
    // Preveri, da check obstaja
    // OPTIMIZACIJA: select namesto include — ne potrebujemo celotnega orderja ali plačil,
    // ker plačila pridobimo znova znotraj transakcije za latest state
    const check = await db.check.findUnique({
      where: { id: data.checkId },
      select: { id: true, total: true, orderId: true },
    })
    if (!check) {
      return NextResponse.json({ error: 'Ček ni najden' }, { status: 404 })
    }
    // FIX H-05: Vse operacije (plačilo + gift card/loyalty) v eni transakciji
    // FIX BUG-3 HIGH: Premakni over-payment check ZNOTRAJ transakcije — prepreči race condition
    // Dve sočasni plačili bi lahko obe prestali check PRED transakcijo in ustvarili over-payment
    const result = await db.$transaction(async (tx) => {
      // OPTIMIZACIJA: aggregate() namesto findMany + sumBy — poizvedba vrne samo vsoto,
      // ne nalaga vseh plačil v pomnilnik
      const paidSoFar = await tx.payment.aggregate({
        where: { checkId: data.checkId, status: 'completed' },
        _sum: { amount: true },
      })
      // FIX: Decimal aritmetika — prepreči string concatenation in float napake
      const totalPaidSoFar = paidSoFar._sum.amount ?? new Prisma.Decimal(0)
      const remainingAmount = subtract(check.total, totalPaidSoFar)
      if (greaterThan(data.amount, add(remainingAmount, 0.01))) { // Toleranca za zaokroževanje
        throw new Error(`OVERPAYMENT:${data.amount.toFixed(2)}:${toNum(remainingAmount).toFixed(2)}`)
      }
      // Ustvari plačilo
      const payment = await tx.payment.create({
        data: {
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
          status: 'completed', // FIX H-08: Server-side default — client cannot set status
          employeeId: data.employeeId || authResult.session?.employeeId || null,
          idempotencyKey: data.idempotencyKey || null, // FIX HIGH: Shrani idempotency key za deduplikacijo
        },
      })
      // Gift card balance deduction — ATOMNO znotraj transakcije (FIX C-03: atomic decrement)
      if (data.type === 'giftcard' && data.giftCardId) {
        const giftCard = await tx.giftCard.findUnique({ where: { id: data.giftCardId } })
        if (!giftCard) {
          throw new Error('Darilna kartica ni najdena')
        }
        if (giftCard.status !== 'active') {
          throw new Error('Darilna kartica ni aktivna')
        }
        // FIX HIGH: Preveri, da kartica ni potekla
        if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
          // Označi kot poteklo
          await tx.giftCard.update({
            where: { id: data.giftCardId },
            data: { status: 'expired' },
          })
          throw new Error('Darilna kartica je potekla')
        }
        if (toNum(giftCard.balance) < data.amount) { // FIX: Decimal primerjava
          // FIX CRITICAL: Kartica nima dovolj sredstev za celoten znesek plačila.
          // Zavrnemo plačilo — klient mora poslati pravilen znesek (<= balance).
          // Delno plačilo z darilno kartico zahteva ločen POST z zneskom <= balance.
          throw new Error(`Stanje darilne kartice (${toNum(giftCard.balance).toFixed(2)} EUR) ni zadostno za plačilo ${toNum(data.amount).toFixed(2)} EUR. Posljite plačilo z zneskom ${toNum(giftCard.balance).toFixed(2)} EUR ali manj.`) // FIX: .toFixed(2) on Decimal — use toNum().toFixed(2)
        } else {
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
          if (updatedCard && !greaterThan(updatedCard.balance, 0)) { // FIX: Decimal primerjava
            await tx.giftCard.update({ where: { id: data.giftCardId }, data: { status: 'depleted' } })
          }
          const newBalance = toNum(updatedCard?.balance) // FIX: Decimal→number
          await tx.giftCardTransaction.create({
            data: {
              giftCardId: data.giftCardId,
              type: 'redeem',
              amount: -data.amount,
              balanceAfter: newBalance,
              orderId: check.orderId || null,
              checkId: data.checkId,
              note: `Plačilo naročila`,
            },
          })
        }
      }
      // Loyalty points deduction — ATOMNO znotraj transakcije (FIX: atomic decrement)
      if (data.type === 'loyalty' && data.loyaltyAccountId && data.loyaltyPointsUsed > 0) {
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
        if (loyaltyAccount.pointsBalance < data.loyaltyPointsUsed) { // int comparison — OK
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
        // OPTIMIZACIJA: Odstranjen nepotreben _updatedAccount query — rezultat se ne uporabi
        await tx.loyaltyTransaction.create({
          data: {
            loyaltyAccountId: data.loyaltyAccountId,
            type: 'redeem',
            points: -data.loyaltyPointsUsed,
            reason: 'Unovčenje točk za plačilo',
            orderId: check.orderId || null,
            checkId: data.checkId,
            monetaryValue: data.amount,
          },
        })
      }
      // OPTIMIZACIJA: aggregate() namesto findMany + sumBy — potrebujemo samo vsoto plačil
      const totalPaidResult = await tx.payment.aggregate({
        where: { checkId: data.checkId, status: 'completed' },
        _sum: { amount: true },
      })
      // FIX: Decimal aritmetika za vsoto plačil
      const totalPaid = totalPaidResult._sum.amount ?? new Prisma.Decimal(0)
      if (greaterThanOrEqual(totalPaid, subtract(check.total, 0.01))) {
        await tx.check.update({
          where: { id: data.checkId },
          data: { paymentStatus: 'paid' },
        })
      } else if (greaterThan(totalPaid, 0)) {
        await tx.check.update({
          where: { id: data.checkId },
          data: { paymentStatus: 'partial' },
        })
      }
      // FIX BUG-1 CRITICAL: Popust je že bil validiran in currentUses povečan ob ustvarjanju čeka.
      // Ne povečuj currentUses še enkrat — to bi povzročilo dvojno štetje!
      // Če je bil popust deaktiviran med ustvarjanjem čeka in plačilom, to ni napaka plačila.
      // Popust je že apliciran na ček in se ne more umakniti retroaktivno.
      // (Prejšnja koda je imela double-increment bug — currentUses se je povečal tako v checks/route.ts kot tukaj)
      // FIX CRITICAL: Posodobi ORDER paymentStatus, paymentMethod, paidAt ko je check plačan
      // Brez tega ORDER ostane "unpaid" tudi ko so vsi čeki plačani!
      const updatedCheck = await tx.check.findUnique({ where: { id: data.checkId } })
      if (updatedCheck?.paymentStatus === 'paid') {
        // Pridobi vse čeke za ta naročilo
        const allChecks = await tx.check.findMany({ where: { orderId: check.orderId } })
        const allPaid = allChecks.every(c => c.paymentStatus === 'paid')
        const anyPartial = allChecks.some(c => c.paymentStatus === 'partial')
        const orderPaymentStatus = allPaid ? 'paid' : anyPartial ? 'partial' : 'unpaid'
        const orderUpdateData: Record<string, unknown> = { paymentStatus: orderPaymentStatus }
        if (allPaid) {
          orderUpdateData.paidAt = new Date()
          // Določi paymentMethod — če je samo en tip, uporabi njega; sicer "split"
          // Poizvedi plačila za vse čeke
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
          where: { id: check.orderId },
          data: orderUpdateData,
        })
      } else if (updatedCheck?.paymentStatus === 'partial') {
        // Partial plačilo — posodobi order status na partial če ni že
        const order = await tx.order.findUnique({ where: { id: check.orderId } })
        if (order?.paymentStatus === 'unpaid') {
          await tx.order.update({
            where: { id: check.orderId },
            data: { paymentStatus: 'partial' },
          })
        }
      }
      // FIX HIGH: Samodejno pridobi zvestobne točke ob plačilu — loyalty earn
      if (data.loyaltyAccountId && data.type !== 'loyalty') {
        const settings = await tx.restaurantSettings.findFirst({ where: { isActive: true } })
        if (settings?.loyaltyEnabled) {
          const pointsPerEuro = toNum(settings.loyaltyPointsPerEuro) || 1 // FIX: Decimal truthy — toNum() || fallback instead of Decimal || fallback
          // Točke se računajo po znesku plačila (brez napitnine)
          // FIX: Decimal aritmetika za izračun točk — prepreči float napake
          const earnBase = round2(subtract(data.amount, toNum(data.tipAmount))) // FIX: Decimal truthy — toNum() instead of || 0
          const pointsToEarn = Math.max(0, Math.floor(earnBase * pointsPerEuro))
          if (pointsToEarn > 0) {
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
                orderId: check.orderId || null,
                checkId: data.checkId,
                monetaryValue: earnBase,
              },
            })
          }
        }
      }
      return payment
    })
    // OPTIMIZACIJA: Promise.all za paralelno pridobivanje plačila z relacijami in orderja za webhook
    const [paymentWithRelations, updatedOrder] = await Promise.all([
      db.payment.findUnique({
        where: { id: result.id },
        include: {
          check: true,
          alternatePaymentType: true,
          giftCard: true,
          loyaltyAccount: true,
        },
      }),
      // OPTIMIZACIJA: select namesto include — potrebujemo samo status in podatke za webhook
      check.orderId
        ? db.order.findUnique({
            where: { id: check.orderId },
            select: { id: true, orderNumber: true, total: true, paymentStatus: true, paymentMethod: true, tip: true },
          })
        : Promise.resolve(null),
    ])
    // FIX: Audit log za plačilo
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'CREATE_PAYMENT',
      entityType: 'Payment',
      entityId: result.id,
      details: {
        checkId: data.checkId,
        amount: data.amount,
        type: data.type,
        tipAmount: data.tipAmount,
        giftCardUsed: !!data.giftCardId,
        loyaltyUsed: data.loyaltyPointsUsed > 0,
      },
    })
    // Webhook: payment.received
    emitEvent('payment.received', {
      paymentId: result.id,
      orderId: check.orderId || '',
      amount: data.amount,
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
