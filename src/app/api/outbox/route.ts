// ============================================
// /api/outbox — Outbox status & process trigger
// ============================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { handleApiError, parsePaginationParams } from '@/lib/api-utils'
import { db } from '@/lib/db'
import {
  getOutboxStats,
  processOutboxBatch,
  cleanupOldSentEvents,
} from '@/lib/outbox'

export const dynamic = 'force-dynamic'

// GET — statistika outboxa + seznam pending/failed events
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    // FIX R86-4 (MEDIUM): tenant scope — OutboxEvent.locationId (R84 stolpec).
    // Prej je lokacijski admin videl evente VSEH tenantov (aggregateId, eventType,
    // lastError, payload-idji). Super-admin = globalni pogled.
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/outbox',
    })
    if ('error' in scope) return scope.error

    const status = searchParams.get('status') || 'pending'
    const target = searchParams.get('target')
    // P1-16: centralna pagination validacija (limit max, search dolžina)
    const { limit } = parsePaginationParams(searchParams, { defaultLimit: 50 })

    const where: Record<string, unknown> = {}
    if (status !== 'all') where.status = status
    if (target) where.target = target
    // R86-4: pogojni spread — NIKOLI { locationId: null }
    if (scope.locationId) where.locationId = scope.locationId

    const [events, stats] = await Promise.all([
      db.outboxEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          aggregateType: true,
          aggregateId: true,
          eventType: true,
          target: true,
          status: true,
          attempts: true,
          maxAttempts: true,
          lastError: true,
          nextRetryAt: true,
          processedAt: true,
          createdAt: true,
        },
      }),
      getOutboxStats(scope.locationId),
    ])

    return NextResponse.json({
      stats,
      events,
      count: events.length,
    })
  } catch (err) {
    return handleApiError(err, 'outbox GET')
  }
}

// POST — ročno sproži procesiranje (admin cron trigger)
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json().catch(() => ({}))
    const action = body.action || 'process'

    if (action === 'process') {
      const limit = Math.min(body.limit || 25, 100)
      const result = await processOutboxBatch(limit)
      return NextResponse.json({ success: true, ...result })
    }

    if (action === 'cleanup') {
      const days = body.days || 30
      const deleted = await cleanupOldSentEvents(days)
      return NextResponse.json({ success: true, deleted })
    }

    return NextResponse.json({ error: 'Neznana akcija. Uporabite "process" ali "cleanup".' }, { status: 400 })
  } catch (err) {
    return handleApiError(err, 'outbox POST')
  }
}
