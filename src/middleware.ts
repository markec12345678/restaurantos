import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { generateRequestId } from '@/lib/logger'
import { handleApiProtection } from '@/lib/middleware/api-protection'
import { applySecurityHeaders } from '@/lib/middleware/security-headers'

// =====================================================================
// MIDDLEWARE - Varnostni headers + locale cookie + API rate limiting
// - Content-Security-Policy: prepreči XSS in injiciranje skript
// - Strict-Transport-Security: vsili HTTPS
// - X-Frame-Options: prepreči clickjacking
// - X-Content-Type-Options: prepreči MIME sniffing
// - Referrer-Policy: omeji razkritje refererja
// - API Rate Limiting: zaščita vseh API rut pred zlorabo
// =====================================================================

export default function middleware(request: NextRequest) {
  // FIX: Generiraj request ID za tracing — vključen v vse log vnose in odzivne headerje
  const requestId = generateRequestId()

  // ═══════════════════════════════════════════
  // API ZAŠČITA — rate limiting + body size limit
  // ═══════════════════════════════════════════
  const apiBlock = handleApiProtection(request, requestId)
  if (apiBlock) return apiBlock

  const response = NextResponse.next()

  // FIX: Dodaj X-Request-ID v odzivne headerje za klient-side tracing
  response.headers.set('X-Request-ID', requestId)

  // Nastavi locale cookie za next-intl (brez URL prefixa)
  const locale = request.cookies.get('NEXT_LOCALE')?.value || 'sl'
  response.cookies.set('NEXT_LOCALE', locale, { path: '/', sameSite: 'lax' })

  // ═══════════════════════════════════════════
  // VARNOSTNI HEADERS
  // ═══════════════════════════════════════════
  applySecurityHeaders(response, request)

  return response
}

export const config = {
  // Match ALL pathnames including API routes (for rate limiting)
  // and page routes (for security headers + locale cookie)
  // Excluded: _next (Next.js internals), static files
  matcher: ['/((?!_next|menu-images|inventory-images|icons|favicon.*|sw\\.js|manifest\\.json|robots\\.txt).*)'],
}
