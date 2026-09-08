
// Shema za delno posodabljanje plačila (vsa polja opcijska)
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createPaymentSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { reverseGiftCard, reverseLoyaltyPoints, recalculatePaymentStatus, deepToNumbers } from './_helpers'


const updatePaymentSchema = createPaymentSchema.partial().extend({
  status: z.enum(['completed', 'refunded', 'voided']).optional(),
  employeeId: z.string().nullable().optional(),
})

export const dynamic = 'force-dynamic'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // AVTENTIKACIJA: Plačila smejo urejati samo avtorizirani uporabniki
  const authResult = await requireAuth(req, { permission: 'manage_cash' })
  if (authResult.error) return authResult.error

  try {
    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // VALIDACIJA: Preveri vnose pred shranjevanjem
    const { data, error: validationError } = validateBody(updatePaymentSchema, bodyResult.data)
    if (validationError) return validationError

    // BLOCK: Prevent changes to amount and type after creation
    if (data.amount !== undefined) {
      return NextResponse.json(
        { error: 'Zneska plačila ni mogoče spremeniti po ustvarjanju' },
        { status: 400 }
      )
    }
    if (data.type !== undefined) {
      return NextResponse.json(
        { error: 'Vrste plačila ni mogoče spremeniti po ustvarjanju' },
        { status: 400 }
      )
    }

    // PAYMENT AUDIT 2026-09-09: blokiraj mutacijo giftcard/loyalty polj po
    // ustvarjanju — ta polja poganjajo reversal logiko ob povračilu; če se
    // po ustvarjanju prestavijo na drugo kartico/račun, bi povračilo odobrilo
    // NAPAČNEMU uporabniku (denar na tujco darilno kartico).
    if (data.giftCardId !== undefined || data.loyaltyAccountId !== undefined || data.loyaltyPointsUsed !== undefined) {
      return NextResponse.json(
        { error: 'Darilne kartice in zvestobnih podatkov ni mogoče spremeniti po ustvarjanju plačila' },
        { status: 400 }
      )
    }

    // 404 CHECK: Verify payment exists before updating
    // FIX P0-C1 (IDOR): findUnique → findFirst z check.order.locationId scope (cross-tenant zaščita)
    // Payment nima lastnega locationId — scoping prek Check → Order relation
    const sessionLocationId = authResult.session?.locationId ?? undefined
    const existingPayment = await db.payment.findFirst({
      where: {
        id,
        ...(sessionLocationId
          ? { check: { order: { locationId: sessionLocationId } } }
          : {}),
      },
      include: {
        check: true,
        giftCard: true,
        loyaltyAccount: true,
      },
    })

    if (!existingPayment) {
      return NextResponse.json({ error: 'Plačilo ni najdeno' }, { status: 404 })
    }

    // Determine if status is changing to refunded/voided
    const isRefundOrVoid =
      data.status &&
      (data.status === 'refunded' || data.status === 'voided') &&
      existingPayment.status === 'completed'

    // PAYMENT AUDIT 2026-09-09 (statusni stroj): dovoljene SOLE completed →
    // refunded / completed → voided (z reversal side-effects prek spodnje
    // transakcije). Vse ostale spremembe statusa so zavrnjene:
    //   - refunded → completed: re-aktivacija že povrnjenega plačila brez
    //     reverza reversal-a bi pokvarila bilanco in omogočila dvojno trošenje
    //   - voided → completed: enako
    //   - refunded → voided in obratno: nonsensikalne transicije
    if (data.status !== undefined && !isRefundOrVoid) {
      return NextResponse.json(
        {
          error: `Sprememba statusa '${existingPayment.status}' → '${data.status}' ni dovoljena. Dovoljena transicija: completed → refunded/voided (prek /refund endpointa).`,
        },
        { status: 400 }
      )
    }

    // Build update data (excluding amount and type)
    const updateData: Record<string, unknown> = {}
    if (data.tipAmount !== undefined) updateData.tipAmount = data.tipAmount
    if (data.alternatePaymentTypeId !== undefined) updateData.alternatePaymentTypeId = data.alternatePaymentTypeId || null
    if (data.cardType !== undefined) updateData.cardType = data.cardType
    if (data.cardLast4 !== undefined) updateData.cardLast4 = data.cardLast4
    if (data.authorizationCode !== undefined) updateData.authorizationCode = data.authorizationCode
    if (data.status !== undefined) updateData.status = data.status
    if (data.employeeId !== undefined) updateData.employeeId = data.employeeId || null

    // PAYMENT AUDIT 2026-09-09 (audit sled): vsako posodobitev plačila zapiši v
    // AuditLog — prej je bilo mogoče spremeniti zaključeno plačilo (tip, kartica,
    // status) BREZ sledi. Diff pred/po zagotavlja revizijsko sled.
    const beforeSnapshot: Record<string, unknown> = {}
    for (const key of Object.keys(updateData)) {
      beforeSnapshot[key] = (existingPayment as Record<string, unknown>)[key] ?? null
    }
    const auditEmployeeId = data.employeeId || authResult.session?.employeeId || null

    // PAYMENT AUDIT: helper — zapiši audit log (best-effort, ne podre posodobitve)
    const writeAuditLog = async (after: Record<string, unknown>) => {
      try {
        await db.auditLog.create({
          data: {
            userId: auditEmployeeId,
            action: 'UPDATE_PAYMENT',
            entityType: 'Payment',
            entityId: id,
            details: JSON.stringify({
              changedFields: Object.keys(updateData),
              before: beforeSnapshot,
              after: Object.fromEntries(
                Object.keys(updateData).map(k => [k, (after as Record<string, unknown>)[k] ?? null])
              ),
              statusTransition: updateData.status
                ? `${existingPayment.status} → ${String(updateData.status)}`
                : null,
              reversalApplied: !!isRefundOrVoid,
            }),
            ipAddress: '',
          },
        })
      } catch (auditErr) {
        logger.error('PAYMENT', '[PUT] Napaka pri pisanju audit loga:', auditErr)
      }
    }

    if (isRefundOrVoid) {
      // Wrap reversal + update in a single transaction
      const payment = await db.$transaction(async (tx) => {
        // Reverse gift card balance if it was a giftcard payment
        await reverseGiftCard(tx, existingPayment, id)

        // Reverse loyalty points if it was a loyalty payment
        await reverseLoyaltyPoints(tx, existingPayment, id)

        // FIX HIGH: Zmanjšaj discount.currentUses ob povračilu/poničitvi plačila
        const checkForDiscount = await tx.check.findUnique({ where: { id: existingPayment.checkId } })
        if (checkForDiscount?.appliedDiscountId) {
          await tx.discount.updateMany({
            where: { id: checkForDiscount.appliedDiscountId, currentUses: { gt: 0 } },
            data: { currentUses: { decrement: 1 } },
          })
        }

        // Update the payment itself
        const updatedPayment = await tx.payment.update({
          where: { id },
          data: updateData,
          include: {
            check: true,
            alternatePaymentType: true,
            giftCard: true,
            loyaltyAccount: true,
          },
        })

        // Recalculate payment statuses
        await recalculatePaymentStatus(tx, existingPayment, checkForDiscount)

        return updatedPayment
      })

      await writeAuditLog(payment as unknown as Record<string, unknown>)

      return NextResponse.json(deepToNumbers(payment))
    } else {
      // No reversal needed — simple update
      const payment = await db.payment.update({
        where: { id },
        data: updateData,
        include: {
          check: true,
          alternatePaymentType: true,
          giftCard: true,
          loyaltyAccount: true,
        },
      })

      await writeAuditLog(payment as unknown as Record<string, unknown>)

      return NextResponse.json(deepToNumbers(payment))
    }
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/payments/[id]', 'Napaka pri posodobitvi plačila')
  }
}
