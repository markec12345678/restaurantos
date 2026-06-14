import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { generateRequestId } from '@/lib/logger'

// =====================================================================
// MIDDLEWARE - Varnostni headers + locale cookie + API rate limiting
// - Content-Security-Policy: prepreči XSS in injiciranje skript
// - Strict-Transport-Security: vsili HTTPS
// - X-Frame-Options: prepreči clickjacking
// - X-Content-Type-Options: prepreči MIME sniffing
// - Referrer-Policy: omeji razkritje refererja
// - API Rate Limiting: zaščita vseh API rut pred zlorabo
// =====================================================================

// ============================================
// IN-MEMORY RATE LIMITER ZA MIDDLEWARE
// Enostavna implementacija za Edge Runtime
// (Ne uporablja Node.js setInterval — Edge kompatibilna)
// ============================================

interface RateEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateEntry>()
const MAX_ENTRIES = 5000

// Čiščenje poteklih vnosov — klicano ob vsakem zahtevku
function cleanExpired() {
  const now = Date.now()
  if (rateLimitStore.size > MAX_ENTRIES) {
    // Evict expired + oldest entries
    for (const [key, entry] of rateLimitStore) {
      if (entry.resetAt <= now) {
        rateLimitStore.delete(key)
      }
    }
    // Če je še vedno preveč, odstrani najstarejše
    if (rateLimitStore.size > MAX_ENTRIES * 0.8) {
      const keysToDelete: string[] = []
      let count = 0
      for (const [key] of rateLimitStore) {
        keysToDelete.push(key)
        count++
        if (count >= rateLimitStore.size * 0.3) break
      }
      keysToDelete.forEach(k => rateLimitStore.delete(k))
    }
  }
}

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

// Konfiguracije omejitev po vzorcu poti
// VRSTNI RED JE POMEMBEN — prvo ujemanje zmaga, specifične rute morajo biti PRED splošnimi
const API_RATE_LIMITS: { pattern: RegExp; config: RateLimitConfig; name: string }[] = [
  // ═══════════════════════════════════════════
  // JAVNI ENDPOINTI — strožje omejitve (brez avtentikacije)
  // ═══════════════════════════════════════════
  { pattern: /\/api\/auth$/, config: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, name: 'auth-login' },
  { pattern: /\/api\/public\/order$/, config: { maxRequests: 5, windowMs: 60 * 1000 }, name: 'public-order' },
  { pattern: /\/api\/public\/online-order/, config: { maxRequests: 5, windowMs: 2 * 60 * 1000 }, name: 'online-order' },
  { pattern: /\/api\/public\/call-waiter/, config: { maxRequests: 3, windowMs: 60 * 1000 }, name: 'call-waiter' },
  { pattern: /\/api\/public\/promo-check/, config: { maxRequests: 10, windowMs: 60 * 1000 }, name: 'promo-check' },
  { pattern: /\/api\/public\/order-track/, config: { maxRequests: 20, windowMs: 60 * 1000 }, name: 'order-track' },
  { pattern: /\/api\/public\/delivery-check/, config: { maxRequests: 10, windowMs: 60 * 1000 }, name: 'delivery-check' },
  { pattern: /\/api\/public\/verify-table/, config: { maxRequests: 15, windowMs: 60 * 1000 }, name: 'verify-table' },
  { pattern: /\/api\/public\/order-config/, config: { maxRequests: 20, windowMs: 60 * 1000 }, name: 'order-config' },
  { pattern: /\/api\/public\/menu/, config: { maxRequests: 30, windowMs: 60 * 1000 }, name: 'public-menu' },
  { pattern: /\/api\/public\//, config: { maxRequests: 20, windowMs: 60 * 1000 }, name: 'public-general' },
  { pattern: /\/api\/feedback-public/, config: { maxRequests: 5, windowMs: 60 * 1000 }, name: 'feedback-public' },
  { pattern: /\/api\/qr-menu/, config: { maxRequests: 30, windowMs: 60 * 1000 }, name: 'qr-menu' },
  { pattern: /\/api\/digital-receipt/, config: { maxRequests: 20, windowMs: 60 * 1000 }, name: 'digital-receipt' },

  // ═══════════════════════════════════════════
  // WEBHOOK ENDPOINTI — zunanje platforme (Glovo, Wolt, Bolt)
  // ═══════════════════════════════════════════
  { pattern: /\/api\/delivery\/webhook/, config: { maxRequests: 30, windowMs: 60 * 1000 }, name: 'delivery-webhook' },
  { pattern: /\/api\/webhooks\//, config: { maxRequests: 30, windowMs: 60 * 1000 }, name: 'webhooks' },

  // ═══════════════════════════════════════════
  // AI ENDPOINTI — dražji klici (Gemini API)
  // ═══════════════════════════════════════════
  { pattern: /\/api\/ai-assistant/, config: { maxRequests: 10, windowMs: 60 * 1000 }, name: 'ai-assistant' },
  { pattern: /\/api\/ai\//, config: { maxRequests: 15, windowMs: 60 * 1000 }, name: 'ai' },

  // ═══════════════════════════════════════════
  // DESTRUKTIVNI ENDPOINTI — zelo omejeni
  // ═══════════════════════════════════════════
  { pattern: /\/api\/orders\/seed/, config: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, name: 'seed' },
  { pattern: /\/api\/seed/, config: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, name: 'seed-general' },

  // ═══════════════════════════════════════════
  // WEBSOCKET BROADCAST — interno, a omejimo zlorabo
  // ═══════════════════════════════════════════
  { pattern: /\/api\/ws-broadcast/, config: { maxRequests: 30, windowMs: 60 * 1000 }, name: 'ws-broadcast' },

  // ═══════════════════════════════════════════
  // SPLOŠNI AVTENTICIRANI API — 60/min (catch-all)
  // ═══════════════════════════════════════════
  { pattern: /\/api\//, config: { maxRequests: 60, windowMs: 60 * 1000 }, name: 'api-general' },
]

function checkMiddlewareRateLimit(storeKey: string, clientIp: string, config: RateLimitConfig): { allowed: boolean; retryAfterMs?: number; remaining?: number } {
  const key = `${storeKey}:${clientIp}`
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (entry && entry.resetAt <= now) {
    rateLimitStore.delete(key)
  }

  const current = rateLimitStore.get(key)

  if (!current) {
    if (rateLimitStore.size >= MAX_ENTRIES) {
      cleanExpired()
    }
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, remaining: config.maxRequests - 1 }
  }

  if (current.count >= config.maxRequests) {
    return { allowed: false, retryAfterMs: current.resetAt - now, remaining: 0 }
  }

  current.count++
  return { allowed: true, remaining: config.maxRequests - current.count }
}

function getMiddlewareClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0)
    const lastIp = ips[ips.length - 1] || ''
    if (lastIp && lastIp.length <= 45 && /^[\d.:a-fA-F]+$/.test(lastIp)) {
      return lastIp
    }
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp && realIp.length <= 45 && /^[\d.:a-fA-F]+$/.test(realIp)) {
    return realIp
  }
  return 'unknown'
}

export default function middleware(request: NextRequest) {
  // FIX: Generiraj request ID za tracing — vključen v vse log vnose in odzivne headerje
  const requestId = generateRequestId()

  // ═══════════════════════════════════════════
  // API ZAŠČITA — rate limiting + body size limit
  // ═══════════════════════════════════════════
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // FIX HIGH: Omejitev velikosti zahtevka — prepreči DOS z velikimi body-ji
    // Content-Length header preverimo pred obdelavo (ne kličemo req.json() v middleware!)
    const contentLength = request.headers.get('content-length')
    const MAX_BODY_SIZE = 5 * 1024 * 1024 // 5 MB — dovolj za naročila z 30+ artikli, ne za upload
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
  }

  const response = NextResponse.next()

  // FIX: Dodaj X-Request-ID v odzivne headerje za klient-side tracing
  response.headers.set('X-Request-ID', requestId)

  // Nastavi locale cookie za next-intl (brez URL prefixa)
  const locale = request.cookies.get('NEXT_LOCALE')?.value || 'sl'
  response.cookies.set('NEXT_LOCALE', locale, { path: '/', sameSite: 'lax' })

  // ═══════════════════════════════════════════
  // VARNOSTNI HEADERS
  // ═══════════════════════════════════════════

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

  // Content-Security-Policy — prepreči XSS in injiciranje skript
  // Restriktivna politika z dovoljenjem za:
  // - self: lastni skripti, stili, slike, fonti
  // - inline styles: potrebno za Tailwind CSS in shadcn/ui
  // - data: URI: za slike v base64 formatu
  // - blob: za Service Worker in dinamične vire
  // - ws/wss: za WebSocket povezave (KDS real-time posodobitve)
  // - connect-src 'self': API klici samo na lasten strežnik
  // V produkciji je 'unsafe-eval' odstranjen za boljšo XSS zaščito
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

  return response
}

export const config = {
  // Match ALL pathnames including API routes (for rate limiting)
  // and page routes (for security headers + locale cookie)
  // Excluded: _next (Next.js internals), static files
  matcher: ['/((?!_next|menu-images|inventory-images|icons|favicon.*|sw\\.js|manifest\\.json|robots\\.txt).*)'],
}
