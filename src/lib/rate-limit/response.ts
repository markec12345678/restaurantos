// ============================================
// RATE LIMITED RESPONSE — ENOTNA 429 OBLIKA (R92-b)
// ============================================
// Hišni kanon za 429 odgovore (izvira iz withRateLimit HOF, with-rate-limit.ts):
//   - telo: { error: <sporočilo> } (privzeto 'Preveč zahtev. Poskusite znova čez nekaj časa.')
//   - Retry-After           = Math.ceil((retryAfterMs ?? 60000) / 1000)  (fallback 60 s)
//   - X-RateLimit-Remaining = '0'
//   - X-RateLimit-Reset     = Math.ceil(Date.now() / 1000) + Retry-After
//
// R92-b unifikacija: direktni checkRateLimitAsync call-site-i (auth login,
// ordering-token/rotate, ...) uporabljajo ta pomožnik namesto inline
// NextResponse.json — vsi 429 odgovori nosijo ISTI nabor glav, ne glede na
// to, ali so nastali prek HOF ali direktnega klica (enoten kontrakt za
// kliente + monitoring).
// ============================================

import { NextResponse } from 'next/server'

/**
 * Zgradi 429 "rate limited" odgovor po hišnem kanonu (withRateLimit HOF oblika).
 *
 * @param retryAfterMs - Koliko časa še je omejitev aktivna (ms). `undefined`
 *   pade nazaj na 60000 ms (60 s) — isti fallback kot withRateLimit HOF.
 * @param message - Telo sporočila. Privzeto splošno hišno sporočilo; call-site
 *   sme podati specifično (npr. login minute-based sporočilo — R92-b).
 */
export function rateLimitedResponse(
  retryAfterMs: number | undefined,
  message = 'Preveč zahtev. Poskusite znova čez nekaj časa.'
): NextResponse {
  const retryAfter = Math.ceil((retryAfterMs ?? 60000) / 1000)
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + retryAfter),
      },
    }
  )
}
