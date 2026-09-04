import * as Sentry from '@sentry/nextjs'

// ============================================
// SENTRY SERVER CONFIG (server-side)
// ============================================
// Error tracking za API routes, server components, middleware
// ============================================

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Environment
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',

  // Performance monitoring — 10% sample rate v produkciji
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Debug samo v development
  debug: false,

  // Ignoriraj nekatere napake
  ignoreErrors: [
    'Network request failed',
    'Failed to fetch',
    'AbortError',
    'prisma:error', // Prisma errors se loggirajo locally
  ],
})
