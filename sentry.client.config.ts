import * as Sentry from '@sentry/nextjs'

// ============================================
// SENTRY CLIENT CONFIG (browser-side)
// ============================================
// Error tracking + performance monitoring za RestaurantOS
// DSN: https://70dcdcf086eeda255201a5a5916da782@o4511022029733888.ingest.de.sentry.io/4511022031896656
// ============================================

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,

  // Environment
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',

  // Performance monitoring — 10% sample rate v produkciji (ne obremenjuj)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Debug samo v development
  debug: false,

  // Replay za session troubleshooting (1% v produkciji)
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.1,
  replaysOnErrorSampleRate: 1.0, // Vedno posnemi ob napaki

  // Ignoriraj nekatere napake (network errors, abort errors)
  ignoreErrors: [
    'Network request failed',
    'Failed to fetch',
    'AbortError',
    'ResizeObserver loop limit exceeded',
    'Navigation cancelled',
  ],

  // Integrations
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
})
