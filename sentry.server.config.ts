import * as Sentry from '@sentry/nextjs'

// ─── Sentry Server Config (Node.js runtime — API routes, server components) ──
// Tukaj lovlimo backend napake: Prisma napake, API route crashes, FURS timeout-i.

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // 20% tranzakcij na server-u (API klicev)
  tracesSampleRate: 0.2,

  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',

  // Označi release s commit SHA (za sledenje kateri deploy je uvedel napako)
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Ignore nekritičnih backend napak
  ignoreErrors: [
    'OVERPAYMENT', // Poslovna logika — ne napaka
    'ni aktiven', // Darilna kartica poslovna validacija
    'ni zadostno', // Loyalty točke
  ],

  beforeSend(event) {
    // Odstrani auth tokene in PIN iz request data
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
    }
    if (event.request?.data) {
      try {
        const data = typeof event.request.data === 'string' ? JSON.parse(event.request.data) : event.request.data
        if (data.pin) data.pin = '[REDACTED]'
        if (data.password) data.password = '[REDACTED]'
        event.request.data = data
      } catch { /* not JSON */ }
    }
    return event
  },
})
