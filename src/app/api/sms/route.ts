// ============================================
// POST /api/sms/send — Pošlji SMS
// GET /api/sms/status — Preveri SMS konfiguracijo
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
// R93-b: enoten 429 helper (rate-limit/response.ts) — DIREKTEN import, ne barrel:
// testi mockajo '@/lib/rate-limit' z vi.hoisted, direkten path teče realen helper.
// Zdaj pridobi TUDI X-RateLimit-Remaining/Reset glave (prej samo Retry-After);
// telo 'Preveč zahtevkov' OHRANJENO (zgodovinsko sporočilo te rute).
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { isSmsConfigured, sendSms, type SmsMessage } from '@/lib/sms'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const sendSchema = z.object({
  to: z.string().min(6, "Telefonska številka je obvezna").regex(/^[+]?[0-9]{6,15}$/, "Telefonska številka mora biti v E.164 formatu (npr. +38641234567)"),
  body: z.string().min(1, 'Sporočilo je obvezno').max(1600, 'Sporočilo ne sme preseči 1600 znakov'),
  type: z.enum(['reservation', 'order_ready', 'loyalty', 'marketing', 'transactional']).default('transactional'),
})

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const rl = await checkRateLimitAsync('sms', getClientIp(req), AUTHENTICATED_LIMIT)
    // R93-b: 429 po hišnem kanonu — rate-limit plast ostane ZA requireAuth
    // (pri tej ruti NI anonimni-abuse modela, briefova domneva 'before auth'
    // ne drži); placement nedotaknjen, samo enotna oblika 429 odgovora.
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    return NextResponse.json({
      configured: isSmsConfigured(),
      provider: process.env.SMS_PROVIDER || null,
      from: process.env.SMS_FROM || null,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/sms', 'Napaka pri preverjanju SMS konfiguracije')
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const rl = await checkRateLimitAsync('sms', getClientIp(req), AUTHENTICATED_LIMIT)
    // R93-b: 429 po hišnem kanonu — rate-limit plast ostane ZA requireAuth
    // (pri tej ruti NI anonimni-abuse modela, briefova domneva 'before auth'
    // ne drži); placement nedotaknjen, samo enotna oblika 429 odgovora.
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error } = sendSchema.safeParse(bodyResult.data)
    if (error) {
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    const message: SmsMessage = {
      to: data.to,
      body: data.body,
      type: data.type,
    }

    const result = await sendSms(message)

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId })
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/sms', 'Napaka pri pošiljanju SMS')
  }
}
