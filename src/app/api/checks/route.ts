import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { handlePostCheck } from './_helpers/post-handler'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX: Zahtevaj avtentikacijo za branje čekov
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const paymentStatus = searchParams.get('paymentStatus')

    const where: Record<string, unknown> = {}
    if (orderId) where.orderId = orderId
    if (paymentStatus) where.paymentStatus = paymentStatus

    // FIX HIGH: Paginacija za čeke — prepreči nalaganje tisočih zapisov
    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

    const [checks, total] = await Promise.all([
      db.check.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          order: { select: { id: true, orderNumber: true, customerName: true } },
          orderItems: { include: { menuItem: { select: { id: true, name: true } } } },
          payments: true,
          appliedDiscount: true,
        },
      }),
      db.check.count({ where }),
    ])

    return NextResponse.json({ checks: deepToNumbers(checks), total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/checks', 'Napaka pri pridobivanju čekov')
  }
}

export async function POST(req: Request) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    return await handlePostCheck(req, authResult as { session?: { employeeId?: string } | null })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/checks', 'Napaka pri ustvarjanju čeka')
  }
}
