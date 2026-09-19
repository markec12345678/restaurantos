// ============================================
// VARNOSTNI HEADERS ZA MIDDLEWARE
// - Content-Security-Policy: prepreči XSS in injiciranje skript
//   ✅ Issue #34: nonce-based CSP (odstranjen 'unsafe-inline' za scripts)
//   ✅ Issue #34 (popravek 2): nonce-based CSP za styles (odstranjen 'unsafe-inline' za styles)
// - Strict-Transport-Security: vsili HTTPS
// - X-Frame-Options: prepreči clickjacking
// - X-Content-Type-Options: prepreči MIME sniffing
// - Referrer-Policy: omeji razkritje refererja
// ============================================

import type { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'
import { generateCspNonce, formatNonceForCsp } from './csp-nonce'

export interface SecurityHeadersResult {
  /** Generiran nonce za ta request (base64) — Next.js ga injektira v <script> tag-e */
  nonce: string
}

/**
 * Zgradi CSP header + nonce (ločeno od applySecurityHeaders, da lahko middleware
 * ista politika nastavi TUDI na request headerje — glej middleware.ts).
 */
export function buildContentSecurityPolicy(): { nonce: string; cspHeader: string } {
  const nonce = generateCspNonce()
  const nonceDirective = formatNonceForCsp(nonce)

  const isDev = process.env.NODE_ENV === 'development'
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-eval' ${nonceDirective}`
    : `script-src 'self' ${nonceDirective}`
  const styleSrc = `style-src 'self' ${nonceDirective} https://fonts.googleapis.com`

  const cspHeader = [
    "default-src 'self'",
    scriptSrc,
    styleSrc,
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' ws: wss: https:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "manifest-src 'self'",
  ].join('; ')

  return { nonce, cspHeader }
}

/**
 * Nastavi vse varnostne headerje na response + vrne nonce.
 * BUG-HUNT FIX 2026-09-19: prej je bil CSP nastavljen SAMO na response —
 * Next.js pa injektira nonce v svoje inline skripte LE, če vidi CSP na REQUEST
 * headerjih (glej middleware.ts). Politika se zdaj gradi ENKRAT in nastavi
 * na obe mesti (prebuilt param).
 */
export function applySecurityHeaders(
  response: NextResponse,
  _request: NextRequest,
  prebuilt?: { nonce: string; cspHeader: string },
): SecurityHeadersResult {
  const { nonce, cspHeader } = prebuilt ?? buildContentSecurityPolicy()

  if (_request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-DNS-Prefetch-Control', 'off')

  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(self)'
  )

  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')

  // FIX Test 7.3/Production: CORS konfiguracija
  // Same-origin by default. Dovoli samo lasten domeni.
  // Za cross-origin API access (npr. mobilna aplikacija) dodaj dovoljene origine v ALLOWED_ORIGINS.
  const origin = _request.headers.get('origin')
  const ALLOWED_ORIGINS = [
    process.env.NEXT_PUBLIC_APP_URL, // https://restaurantos.app
    'http://localhost:3000', // dev
  ].filter(Boolean) as string[]

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-Offline-Sync, X-Offline-Created-At')
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Max-Age', '86400') // 24h preflight cache
    response.headers.set('Vary', 'Origin')
  }

  response.headers.set('Content-Security-Policy', cspHeader)
  response.headers.set('x-csp-nonce', nonce)

  return { nonce }
}
