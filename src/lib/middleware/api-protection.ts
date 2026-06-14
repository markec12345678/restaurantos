// ============================================
// API ZAŠČITA V MIDDLEWARE
// - Omejitev velikosti zahtevka (prepreči DOS z velikimi body-ji)
// - Rate limiting za vse API rute
// ============================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkMiddlewareRateLimit, getMiddlewareClientIp, API_RATE_LIMITS } from './rate-limit'

const MAX_BODY_SIZE = 5 * 1024 * 1024 // 5 MB — dovolj za naročila z 30+ artikli, ne za upload

/**
// FIX HIGH: Omejitev velikosti zahtevka + rate limiting za API rute
// Content-Length header preverimo pred obdelavo (ne kličemo req.json() v middleware!)
// Vrne NextResponse če je zahtevek zavrnjen, sicer null
 */
export function handleApiProtection(request: NextRequest, requestId: string): NextResponse | null {
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return null
  }

  // FIX HIGH: Omejitev velikosti zahtevka — prepreči DOS z velikimi body-ji
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json(
      { error: 'Zahtevek je prevelik. Maksimalna velikost je 5 MB.' },
      { status: 413, headers: { 'X-Request-ID': requestId } }
    )
  }

  const clientIp = getMiddlewareClientIp(request)

  // Poišči ustrezno konfiguracijo za to pot
  for (const { pattern, config, name } of API_RATE_LIMITS) {
    if (pattern.test(request.nextUrl.pathname)) {
      const result = checkMiddlewareRateLimit(name, clientIp, config)
      if (!result.allowed) {
        const retryAfter = Math.ceil((result.retryAfterMs ?? 60000) / 1000)
        return NextResponse.json(
          { error: 'Preveč zahtev. Poskusite znova čez nekaj časa.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + retryAfter),
              'X-Request-ID': requestId,
            },
          }
        )
      }
      break // Uporabi prvo ujemajočo konfiguracijo
    }
  }

  return null
}
