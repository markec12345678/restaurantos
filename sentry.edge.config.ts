import * as Sentry from '@sentry/nextjs'

// ─── Sentry Edge Config (Edge runtime — middleware, edge API routes) ──
// Minimalna konfiguracija za edge runtime (omejen API).

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
})
