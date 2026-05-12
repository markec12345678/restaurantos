import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'

export default createMiddleware({
  locales: ['sl', 'en', 'it', 'de', 'hr'],
  defaultLocale: 'sl',
  localePrefix: 'as-needed',
})

export const config = {
  // Match all pathnames except for
  // - API routes
  // - _next (Next.js internals)
  // - static files (images, etc.)
  matcher: ['/((?!api|_next|menu-images|inventory-images|icons|favicon.*|sw\\.js|manifest\\.json|robots\\.txt).*)'],
}
