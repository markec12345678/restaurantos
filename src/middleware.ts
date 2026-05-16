import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// =====================================================================
// MIDDLEWARE - Ne preusmerja na locale prefix (aplikacija nima [locale] route)
// Locale se nastavi prek cookieja za next-intl, brez URL prefixa
// =====================================================================

export default function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Nastavi locale cookie za next-intl (brez URL prefixa)
  const locale = request.cookies.get('NEXT_LOCALE')?.value || 'sl'
  response.cookies.set('NEXT_LOCALE', locale, { path: '/', sameSite: 'lax' })

  return response
}

export const config = {
  // Match all pathnames except for
  // - API routes
  // - _next (Next.js internals)
  // - static files (images, etc.)
  matcher: ['/((?!api|_next|menu-images|inventory-images|icons|favicon.*|sw\\.js|manifest\\.json|robots\\.txt).*)'],
}
