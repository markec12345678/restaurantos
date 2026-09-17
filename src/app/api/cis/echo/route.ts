// ============================================
// GET /api/cis/echo — Povezljivost s CIS strežnikom (Hrvaška)
// ============================================
// Task 23: app-level živo preverjanje CIS povezljivosti (zrcali FURS echo iz
// GET /api/furs). Izvede SOAP EchoRequest round-trip na test/prod endpoint —
// brez certifikata (CIS podpisuje XML Body, ne TLS — glej src/lib/cis/echo.ts).
//
// Auth: admin. Rate limit: AUTHENTICATED_LIMIT.
// Query: ?environment=test|production (privzeto test)
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { checkCisConnectivity } from '@/lib/cis'
import type { CisEnvironment } from '@/lib/cis'

export const dynamic = 'force-dynamic'

const echoQuerySchema = z.object({
  environment: z.enum(['test', 'production']).optional(),
})

export async function GET(req: Request) {
  try {
    const rl = await checkRateLimitAsync('cis-echo', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Preveč zahtevkov' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } }
      )
    }

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const url = new URL(req.url)
    const { data: parsed, error: validationError } = echoQuerySchema.safeParse({
      environment: url.searchParams.get('environment') || undefined,
    })
    if (validationError) {
      return NextResponse.json({ error: validationError.issues[0]?.message }, { status: 400 })
    }

    const environment: CisEnvironment = parsed.environment ?? 'test'
    const connectivity = await checkCisConnectivity(environment)

    return NextResponse.json({
      environment,
      ...connectivity,
      checkedAt: new Date().toISOString(),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/cis/echo', 'Napaka pri preverjanju CIS povezljivosti')
  }
}
