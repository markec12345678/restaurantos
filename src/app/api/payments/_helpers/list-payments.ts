// Pomožne funkcije za GET /api/payments

import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { validateApiResponse } from '@/lib/api-utils'
import { paymentsListResponseSchema } from '@/lib/validations'
import { NextResponse } from 'next/server'

export async function handleListPayments(req: Request) {
  const { searchParams } = new URL(req.url)
  const checkId = searchParams.get('checkId')
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const where: Record<string, unknown> = {}
  if (checkId) where.checkId = checkId
  if (type) where.type = type
  if (status) where.status = status

  // Paginacija
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
}
