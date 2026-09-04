// ============================================
// SENTRY INSTRUMENTATION — Next.js App Router
// ============================================
// Next.js 14+ uporablja instrumentation.ts za inicializacijo
// Sentry-ja na server strani (API routes, middleware, edge).
//
// Brez tega file-a Sentry.server.config.ts in Sentry.edge.config.ts
// se NE inicializirata — server-side errorji se NE sledijo!
// ============================================

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}
