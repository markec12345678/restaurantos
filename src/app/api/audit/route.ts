import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

import { handleApiError, parsePaginationParams, parseJsonBody, validateBody } from '@/lib/api-utils'
import { z } from 'zod'

// GET /api/audit — Pridobi revizijski dnevnik
// Samo admin lahko vidi revizijske vnose (PCI DSS zahteva)
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const userId = searchParams.get('userId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    // FIX: Varno parsanje z NaN fallback
    // P1-16: centralna pagination validacija (limit max, offset, search dolžina)
    const { limit, offset } = parsePaginationParams(searchParams)

    const where: Record<string, unknown> = {}
    if (action) where.action = action
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId
    if (userId) where.userId = userId
    if (dateFrom || dateTo) {
      where.timestamp = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      }
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.auditLog.count({ where }),
    ])

    return NextResponse.json({ logs, total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/audit', 'Napaka pri pridobivanju revizijskega dnevnika')
  }
}

// POST /api/audit — Zapiši ročni revizijski vnos
// P1-15/P1-16: admin pregledni panel offline vrste zapiše discard
// odločitev (vnos odstranjen po ročnem pregledu konflikta) v revizijski
// dnevnik, da je odločitev sledljiva (kdo, kdaj, zakaj).
const createAuditLogSchema = z.object({
  action: z.enum(['OFFLINE_QUEUE_DISCARD', 'OFFLINE_QUEUE_RESOLVE', 'MANUAL_AUDIT_NOTE'])
    .or(z.string().max(64).regex(/^[A-Z][A-Z0-9_]*$/, 'Ime akcije: velike črke/številke/podčrtaj')),
  entityType: z.string().min(1).max(64),
  entityId: z.string().min(1).max(128),
  details: z.union([z.string().max(4000), z.record(z.string(), z.unknown())]).optional(),
})

export async function POST(req: Request) {
  try {
    // Samo admin (view_reports bi bil prešibek — ročni revizijski vpisi
    // spadajo k administraciji; GET dnevnika je prav tako admin-only)
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const parsed = await parseJsonBody(req)
    if (parsed.error) return parsed.error
    const { data, error: validationError } = validateBody(createAuditLogSchema, parsed.data)
    if (validationError) return validationError

    const details = typeof data.details === 'string'
      ? data.details
      : data.details !== undefined ? JSON.stringify(data.details) : JSON.stringify({})

    const log = await db.auditLog.create({
      data: {
        userId: authResult.session?.employeeId ?? null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        details,
        ipAddress: '',
      },
    })

    logger.info('AUDIT', 'Ročni revizijski vnos', {
      userId: authResult.session?.employeeId ?? null,
      locationId: authResult.session?.locationId ?? null,
      action: data.action,
      entityId: data.entityId,
    })

    return NextResponse.json({ success: true, log: deepToNumbers(log) }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/audit', 'Napaka pri zapisu revizijskega vnosa', 500, undefined)
  }
}
