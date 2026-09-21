// ============================================
// ROTACIJA API KLJUČEV — Varno spreminjanje ključev za integracije
// POST /api/integrations/[id]/rotate-key
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
// R93-b: enoten 429 helper (rate-limit/response.ts) — DIREKTEN import, ne barrel:
// testi mockajo '@/lib/rate-limit' z vi.hoisted, direkten path teče realen helper.
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import crypto from 'crypto'


const rotateKeySchema = z.object({
  field: z.enum(['apiKey', 'apiSecret']),
  newValue: z.string().min(1).max(500).optional(),
  autoGenerate: z.boolean().default(false),
})

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // R92-a: rate limit TAKOJ po requireAuth — samo avtenticirani klici trošijo
  // vedro (anonimni probe-i ne onesnažijo NAT vedra pisarne); fail-closed
  // (checkRateLimitAsync zavrača, če cache odpove — core.ts kanon).
  // Fiksni ključ 'integrations-rotate-key' (NE iz pathname): en IP ne more
  // fan-out prek različnih integrationId-jev — pathname-izpeljan ključ bi
  // vsaki integraciji dal svoje vedro. IZDAJNA ruta (obrat ključa = material
  // za podpis) — najbolj kritična R92-a plast.
  const rateCheck = await checkRateLimitAsync('integrations-rotate-key', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rateCheck.allowed) {
    // 429 oblika = hišni kanon (withRateLimit HOF): Retry-After / X-RateLimit-*
    // glave, fallback 60 s, ko odgovor ne nosi retryAfterMs.
    return rateLimitedResponse(rateCheck.retryAfterMs)
  }

  try {
    const { id } = await params
    const { data, error: validationError } = await validateRequest(req, rotateKeySchema)
    if (validationError) return validationError

    const { field, newValue, autoGenerate } = data

    // Preveri, da integracija obstaja
    const integration = await db.integration.findUnique({ where: { id } })
    if (!integration) {
      return NextResponse.json({ error: 'Integracija ni najdena' }, { status: 404 })
    }

    // Generiraj nov ključ če je autoGenerate
    const keyValue = autoGenerate
      ? `ros_${field === 'apiKey' ? 'ak' : 'sk'}_${crypto.randomBytes(24).toString('hex')}`
      : newValue

    if (!keyValue) {
      return NextResponse.json({ error: 'Navedi novo vrednost ali omogoči autoGenerate' }, { status: 400 })
    }

    // Posodobi ključ
    await db.integration.update({
      where: { id },
      data: { [field]: keyValue },
    })

    // Zabeleži v integracijski log
    await db.integrationLog.create({
      data: {
        integrationId: id,
        action: 'rotate_key',
        direction: 'outbound',
        status: 'success',
        statusCode: 200,
        requestData: JSON.stringify({ field, autoGenerate }),
        responseData: JSON.stringify({ rotated: true }),
        durationMs: 0,
      },
    })

    return NextResponse.json({
      success: true,
      field,
      maskedValue: `${keyValue.substring(0, 8)}••••••••`,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/integrations/[id]/rotate-key', 'Napaka pri rotaciji ključa')
  }
}
