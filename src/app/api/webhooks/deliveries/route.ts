import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
// R93-b: enoten 429 helper (rate-limit/response.ts) — DIREKTEN import, ne barrel:
// testi mockajo '@/lib/rate-limit' z vi.hoisted, direkten path teče realen helper.
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { processRetryQueue } from '@/lib/webhook-engine'

import { handleApiError, parsePaginationParams } from '@/lib/api-utils'

// ============================================
// GET /api/webhooks/deliveries — Seznam dostav webhookov
// ============================================

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  try {
    const { searchParams } = new URL(req.url)

    // FIX R82-F (LEAK-MEDIUM): poln payload/responseBody VSEH tenantov.
    // WebhookDelivery NIMA lastnega tenant stolpca — scope pot prek relacije
    // webhook.locationId (nullable; pogojni spread — super-admin = global).
    // R86-2c2 (M2 klasa): scope prek kanonskega resolverja — prej raw spread
    // `session?.locationId ?? null` je bil fail-OPEN za non-admin seja z NULL
    // lokacijo (prazen filter = payload VSEH tenantov). Zdaj: 403 fail-closed.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/webhooks/deliveries',
    })
    if ('error' in scope) return scope.error
    const webhookScope = scope.locationId ? { webhook: { locationId: scope.locationId } } : {}

    // P1-16: centralna pagination validacija (limit max, search dolžina)
    const { limit } = parsePaginationParams(searchParams, { defaultLimit: 50 })
    const offset = parseInt(searchParams.get('offset') || '0')
    const webhookId = searchParams.get('webhookId')
    const event = searchParams.get('event')
    const success = searchParams.get('success')

    const where: Record<string, unknown> = { ...webhookScope }
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

    // Statistika (isti scope)
    const successCount = await db.webhookDelivery.count({ where: { ...where, success: true } })
    const failCount = await db.webhookDelivery.count({ where: { ...where, success: false } })
    const pendingRetry = await db.webhookDelivery.count({
      where: { ...where, success: false, nextRetryAt: { not: null } },
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

  // R92-a: rate limit TAKOJ po requireAuth — samo avtenticirani klici trošijo
  // vedro (anonimni probe-i ne onesnažijo NAT vedra pisarne); fail-closed
  // (checkRateLimitAsync zavrača, če cache odpove — core.ts kanon).
  // Fiksni ključ 'webhooks-deliveries-retry': processRetryQueue je GLOBALNA
  // batch operacija (ponovno pošilja webhookе VSEH tenantov) — brez vedra bi
  // en avtenticiran IP lahko zaprl zanko outbound dostav.
  const rateCheck = await checkRateLimitAsync('webhooks-deliveries-retry', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rateCheck.allowed) {
    // 429 oblika = hišni kanon (withRateLimit HOF): Retry-After / X-RateLimit-*
    // glave, fallback 60 s, ko odgovor ne nosi retryAfterMs.
    return rateLimitedResponse(rateCheck.retryAfterMs)
  }

  // FIX R82-F: processRetryQueue je GLOBALNA batch operacija (ponovno pošilja
  // webhookе vseh tenantov) → platformAdminGate (mirror receipts/rebuild).
  const session = authResult.session
  const isPlatformAdmin = !!session && ['admin', 'super_admin'].includes(session.role) && !session.locationId
  if (!isPlatformAdmin) {
    return NextResponse.json(
      { error: 'Globalno vzdrževanje lahko izvaja samo platformni administrator.' },
      { status: 403 },
    )
  }

  try {
    const result = await processRetryQueue()

    return NextResponse.json(deepToNumbers(result))
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/webhooks/deliveries', 'Napaka pri obdelavi ponovnih poskusov')
  }
}
