import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createPaymentSchema } from '@/lib/validations'

export async function GET(req: Request) {
  try {
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

    return NextResponse.json({ payments, total, limit, offset })
  } catch (error) {
    console.error('Failed to fetch payments:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju plačil' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(createPaymentSchema, body)
    if (validationError) return validationError

    // Preveri, da check obstaja
    const check = await db.check.findUnique({
      where: { id: data.checkId },
      include: { order: true, payments: true },
    })

    if (!check) {
      return NextResponse.json({ error: 'Ček ni najden' }, { status: 404 })
    }

    // FIX H-04: Preveri, da skupni znesek plačil ne presega znesek čeka
    const totalPaidSoFar = check.payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0)
    const remainingAmount = check.total - totalPaidSoFar

    if (data.amount > remainingAmount + 0.01) { // Toleranca za zaokroževanje
      return NextResponse.json(
        { error: `Znesek plačila (${data.amount.toFixed(2)} EUR) presega preostali znesek čeka (${remainingAmount.toFixed(2)} EUR)` },
        { status: 400 }
      )
    }

    // FIX H-05: Vse operacije (plačilo + gift card/loyalty) v eni transakciji
    const result = await db.$transaction(async (tx) => {
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

        if (giftCard.balance < data.amount) {
          // FIX CRITICAL: Kartica nima dovolj sredstev za celoten znesek plačila.
          // Zavrnemo plačilo — klient mora poslati pravilen znesek (<= balance).
          // Delno plačilo z darilno kartico zahteva ločen POST z zneskom <= balance.
          throw new Error(`Stanje darilne kartice (${giftCard.balance.toFixed(2)} EUR) ni zadostno za plačilo ${data.amount.toFixed(2)} EUR. Posljite plačilo z zneskom ${giftCard.balance.toFixed(2)} EUR ali manj.`)
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
          if (updatedCard && updatedCard.balance <= 0) {
            await tx.giftCard.update({ where: { id: data.giftCardId }, data: { status: 'depleted' } })
          }
          const newBalance = updatedCard?.balance ?? 0
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
        const loyaltyAccount = await tx.loyaltyAccount.findUnique({ where: { id: data.loyaltyAccountId } })
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

        const updatedAccount = await tx.loyaltyAccount.findUnique({ where: { id: data.loyaltyAccountId } })
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

      // Posodobi status čeka glede na vsa plačila
      const allPayments = await tx.payment.findMany({
        where: { checkId: data.checkId, status: 'completed' },
      })
      const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0)

      if (totalPaid >= check.total - 0.01) {
        await tx.check.update({
          where: { id: data.checkId },
          data: { paymentStatus: 'paid' },
        })
      } else if (totalPaid > 0) {
        await tx.check.update({
          where: { id: data.checkId },
          data: { paymentStatus: 'partial' },
        })
      }

      // FIX MEDIUM: Povečaj currentUses counter za popust, če je uporabljen na čeku
      if (check.appliedDiscountId) {
        await tx.discount.update({
          where: { id: check.appliedDiscountId },
          data: { currentUses: { increment: 1 } },
        })
      }

      // FIX HIGH: Samodejno pridobi zvestobne točke ob plačilu — loyalty earn
      if (data.loyaltyAccountId && data.type !== 'loyalty') {
        const settings = await tx.restaurantSettings.findFirst({ where: { isActive: true } })
        if (settings?.loyaltyEnabled) {
          const pointsPerEuro = settings.loyaltyPointsPerEuro || 1
          // Točke se računajo po znesku plačila (brez napitnine)
          const earnBase = data.amount - (data.tipAmount || 0)
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
                reason: `Točke za plačilo ${data.amount.toFixed(2)} EUR`,
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

    // Pridobi plačilo z relacijami
    const paymentWithRelations = await db.payment.findUnique({
      where: { id: result.id },
      include: {
        check: true,
        alternatePaymentType: true,
        giftCard: true,
        loyaltyAccount: true,
      },
    })

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

    return NextResponse.json(paymentWithRelations, { status: 201 })
  } catch (error) {
    console.error('Failed to create payment:', error)
    const message = error instanceof Error ? error.message : 'Napaka pri ustvarjanju plačila'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
