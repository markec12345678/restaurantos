// ============================================
// VARNOSTNI HEADERS ZA MIDDLEWARE
// - Content-Security-Policy: prepreči XSS in injiciranje skript
//   ✅ Issue #34 končan: nonce-based CSP (odstranjen 'unsafe-inline' za scripts)
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
 * Nastavi vse varnostne headerje na response + vrne nonce.
 */
export function applySecurityHeaders(
  response: NextResponse,
  _request: NextRequest,
): SecurityHeadersResult {
  const nonce = generateCspNonce()
  const nonceDirective = formatNonceForCsp(nonce)

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

  // Content-Security-Policy — nonce-based (Issue #34)
  const isDev = process.env.NODE_ENV === 'development'
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-eval' ${nonceDirective}`
    : `script-src 'self' ${nonceDirective}`

  const cspHeader = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
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

  response.headers.set('Content-Security-Policy', cspHeader)
  response.headers.set('x-csp-nonce', nonce)

  return { nonce }
}
