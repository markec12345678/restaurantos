// ============================================
// VARNOSTNI HEADERS ZA MIDDLEWARE
// - Content-Security-Policy: prepreči XSS in injiciranje skript
// - Strict-Transport-Security: vsili HTTPS
// - X-Frame-Options: prepreči clickjacking
// - X-Content-Type-Options: prepreči MIME sniffing
// - Referrer-Policy: omeji razkritje refererja
// ============================================

import type { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'

export function applySecurityHeaders(response: NextResponse, request: NextRequest): void {
  // Strict-Transport-Security — vsili HTTPS za 1 leto (tudi poddomene)
  // Aktiviraj samo v produkciji (dev uporablja HTTP)
  if (request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // X-Frame-Options — prepreči clickjacking (iframe embedding)
  // SAMEORIGIN: dovoli iframe samo iz iste domene (potrebno za PWA manifest)
  // FIX: Konsistentno z next.config.ts (prej je bil tam DENY — inkonsistenca)
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')

  // X-Content-Type-Options — prepreči MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // Referrer-Policy — omeji razkritje referer informacij
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // X-DNS-Prefetch-Control — onemogoči DNS prefetch za zasebnost
  response.headers.set('X-DNS-Prefetch-Control', 'off')

  // Permissions-Policy — omeji dostop do brskalnikovih zmožnosti
  // Kamera in mikrofon nista potrebna za POS; geolokacija je opcijska za dostavo
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(self)'
  )

  // FIX: Cross-Origin politike za Spectre mitigation (prej samo v next.config.ts)
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')

  // Content-Security-Policy — prepreči XSS in injiciranje skript
  // Restriktivna politika z dovoljenjem za:
  // - self: lastni skripti, stili, slike, fonti
  // - inline styles: potrebno za Tailwind CSS in shadcn/ui
  // - data: URI: za slike v base64 formatu
  // - blob: za Service Worker in dinamične vire
  // - ws/wss: za WebSocket povezave (KDS real-time posodobitve)
  // - connect-src 'self' https: ws: wss: API klici samo na lasten strežnik + WSS
  //
  // NOTE: 'unsafe-inline' za scripts je še vedno prisoten ker Next.js injecta
  // inline hydration script (potreben za delovanje). Pravilna rešitev je nonce-based
  // CSP (experimental.nonce v next.config.ts) — sledi v issue #34.
  // 'unsafe-eval' je v produkciji odstranjen (dev only).
  const isDev = process.env.NODE_ENV === 'development'
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" // dev: potrebno za Next.js HMR
    : "script-src 'self' 'unsafe-inline'" // prod: unsafe-eval odstranjen

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
}
