import * as Sentry from '@sentry/nextjs'

// ─── Sentry Client Config (browser) ───────────────────────────
// Backendnapake (API routes, server components) se pošljejo preko server config.
// Tukaj lovlimo frontend JS napake, React hydration mismatch, itd.

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sampliranje performance tranzakcij (10% na client-u)
  tracesSampleRate: 0.1,

  // Sampliranje session replays (1% — brezplačni tier je 50/mesec)
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0, // Vse napake dobijo replay

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false, // Ne maskiraj besedila (pomembno za POS kontekst)
      blockAllMedia: false,
    }),
  ],

  // Environment tag — ločevanje production/preview
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',

  // Ignore nekritičnih napak (ne pošiljaj Sentry-ju)
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Network request failed',
    'Failed to fetch', // Pogosto pri offline SW mode
  ],

  // Preden pošlješ event, očisti občutljive podatke
  beforeSend(event) {
    // Odstrani auth tokene iz headers
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
    }
    // Odstrani PIN iz request body (če je prisoten)
    if (event.request?.data) {
      try {
        const data = JSON.parse(event.request.data)
        if (data.pin) data.pin = '[REDACTED]'
        event.request.data = JSON.stringify(data)
      } catch { /* not JSON */ }
    }
    return event
  },
})
