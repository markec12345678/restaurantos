import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs'

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // FIX HIGH: HSTS — vsili HTTPS v produkciji (1 leto, includeSubDomains, preload)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  // FIX HIGH: CSP — omeji vire, iz katerih se lahko nalaga vsebino
  // Dovoli: self, inline styles/scripts (Next.js potrebuje), ws: za WebSocket, data: za slike
  // Sentry: dodan https://*.sentry.io v connect-src in img-src
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss: http://localhost:* https://api.github.com https://*.sentry.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  // Cross-Origin politike za sodobne brskalnike
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
]

const nextConfig: NextConfig = {
  output: "standalone",
  // FIX: pdfkit needs runtime access to font data files (.afm) in node_modules
  // Turbopack can't bundle these — mark as external package
  serverExternalPackages: ['pdfkit'],
  // FIX BUG 25: Onemogoči ignoreBuildErrors — skriva prave TS napake
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true, // FIX: Omogoči strict mode za boljšo kakovost kode
  headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
};

// ─── Sentry wrapper (v10) ──────────────────────────────────────
// Minimal config — Sentry auto-detects org/project from env vars:
//   SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
// Source maps upload only if SENTRY_AUTH_TOKEN is set.
export default withSentryConfig(nextConfig, {
  // Source maps upload only when auth token is present
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  // Suppress logs in development (no token = no upload = no noise)
  silent: true,
})
