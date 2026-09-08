// Pomožne funkcije za GET /api/payments

import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { parsePaginationParams, validateApiResponse } from '@/lib/api-utils'
import { paymentsListResponseSchema } from '@/lib/validations'
import { NextResponse } from 'next/server'

export async function handleListPayments(req: Request, sessionLocationId?: string | null) {
  const { searchParams } = new URL(req.url)
  const checkId = searchParams.get('checkId')
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const where: Record<string, unknown> = {}
  if (type) where.type = type
  if (status) where.status = status

  // PAYMENT AUDIT 2026-09-09 (cross-tenant): plačila so vezana na lokacijo prek
  // Check → Order verige. Brez scope-a je zaposleni lokacije A videl finančne
  // podatke (plačila, kartice, darilne kartice) lokacije B. Super admin
  // (sessionLocationId=null) vidi vse.
  if (checkId || sessionLocationId) {
    where.check = {
      ...(checkId ? { id: checkId } : {}),
      ...(sessionLocationId ? { order: { locationId: sessionLocationId } } : {}),
    }
  }

  // Paginacija
    // P1-16: centralna pagination validacija (limit max, offset, search dolžina)
    const { limit, offset } = parsePaginationParams(searchParams)

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
}
