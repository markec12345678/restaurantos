import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { processRetryQueue } from '@/lib/webhook-engine'

import { handleApiError } from '@/lib/api-utils'

// ============================================
// GET /api/webhooks/deliveries — Seznam dostav webhookov
// ============================================

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { searchParams } = new URL(req.url)

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')
    const webhookId = searchParams.get('webhookId')
    const event = searchParams.get('event')
    const success = searchParams.get('success')

    const where: Record<string, unknown> = {}
    if (webhookId) where.webhookId = webhookId
    if (event) where.event = event
    if (success !== null) where.success = success === 'true'

    const deliveries = await db.webhookDelivery.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    })

    const total = await db.webhookDelivery.count({ where })

    // Statistika
    const successCount = await db.webhookDelivery.count({ where: { success: true } })
    const failCount = await db.webhookDelivery.count({ where: { success: false } })
    const pendingRetry = await db.webhookDelivery.count({
      where: { success: false, nextRetryAt: { not: null } },
    })

    return NextResponse.json({
      deliveries,
      total,
      limit,
      offset,
      stats: { successCount, failCount, pendingRetry },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/webhooks/deliveries', 'Napaka pri pridobivanju dostav')
  }
}

// ============================================
// POST /api/webhooks/deliveries — Obdelaj čakajoče ponovne poskuse
// ============================================

export async function POST(req: Request) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const result = await processRetryQueue()

    return NextResponse.json(deepToNumbers(result))
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/webhooks/deliveries', 'Napaka pri obdelavi ponovnih poskusov')
  }
}
