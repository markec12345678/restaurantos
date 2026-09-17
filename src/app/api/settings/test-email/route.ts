
// ============================================
// POST /api/settings/test-email — REALNI SMTP test (Task 21)
// ============================================
// FIX: EmailTab je prej imel lažni test (setTimeout + prikazan "uspeh" brez
// pošiljanja). Ta endpoint dejansko pošlje email prek shranjenih SMTP
// nastavitev in vrne resnični rezultat (vključno s SMTP error message).
//
// Namerno deluje TUDI, če emailEnabled=false — admin želi testirati
// konfiguracijo preden jo omogoči (sendTestEmail preskoči ta flag).
// Zahteva pa vseeno shranjen emailSmtpHost + emailSmtpUser.
//
// Auth: admin. Rate limit: AUTHENTICATED_LIMIT (brute-force zaščita SMTP).
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { sendTestEmail, getReportRecipients } from '@/lib/email'

export const dynamic = 'force-dynamic'

const testEmailSchema = z.object({
  // Neobvezen naslov — če manjka, uporabi prvega konfiguriranega prejemnika
  to: z.string().email('Neveljaven email naslov').max(200).optional(),
})

export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo (SMTP brute-force / spam)
    const rl = await checkRateLimitAsync('settings-test-email', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Preveč zahtevkov' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } }
      )
    }

    // FIX BUG 11 pattern: spreminjanje/pošiljanje nastavitev = admin
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = testEmailSchema.safeParse(bodyResult.data ?? {})
    if (validationError) {
      return NextResponse.json(
        { error: validationError.issues[0]?.message || 'Neveljavni podatki' },
        { status: 400 }
      )
    }

    let to = data.to
    if (!to) {
      // Fallback: prvi konfigurirani prejemnik poročil
      const recipients = await getReportRecipients()
      if (recipients.length === 0) {
        return NextResponse.json(
          { error: 'Podaj naslov prejemnika ali nastavi emailReportRecipients' },
          { status: 400 }
        )
      }
      to = recipients[0]
    }

    const result = await sendTestEmail(to)

    if (!result.success) {
      // 502 = upstream (SMTP) napaka — konfiguracija/problem strežnika, ne requesta
      return NextResponse.json(
        { error: result.error || 'Pošiljanje ni uspelo', to: result.to },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      to: result.to,
      from: result.from,
      host: result.host,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/settings/test-email', 'Napaka pri testnem pošiljanju')
  }
}
