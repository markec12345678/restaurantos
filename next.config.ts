import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs/config';

// NOTE: Večina varnostnih headerjev se nastavi v `src/lib/middleware/security-headers.ts`
// (middleware teče na vsakem zahtevku in prevlada nad statičnimi headers tukaj).
// Tu ostanejo samo headerji, ki jih middleware NE nastavlja (COOP, CORP) ali
// ki so potrebni za statične datoteke (ki ne gredo skozi middleware).
const securityHeaders = [
  // X-Frame-Options: SAMEORIGIN — konsistentno z middleware (PWA manifest potrebuje iframe)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HSTS — vsili HTTPS v produkciji (1 leto, includeSubDomains, preload)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  // CSP — fallback za statične datoteke (middleware nastavi bolj restriktivno per-request z nonce)
  // FIX issue #34 (del 2): 'unsafe-inline' popolnoma odstranjen iz style-src
  // Middleware doda per-request nonce za script-src IN style-src
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self' ws: wss: https:",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  // Cross-Origin politike za sodobne brskalnike (Spectre mitigation)
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
]

const nextConfig: NextConfig = {
  output: "standalone",
  // FIX: pdfkit needs runtime access to font data files (.afm) in node_modules
  // Turbopack can't bundle these — mark as external package
  serverExternalPackages: ['pdfkit', '@electric-sql/pglite', 'pglite-prisma-adapter'],
  // FIX BUG 25: Onemogoči ignoreBuildErrors — skriva prave TS napake
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true, // FIX: Omogoči strict mode za boljšo kakovost kode
  // next/image: optimizacija slik (WebP/AVIF konverzija, responsive sizing, lazy loading)
  // FIX: Dodan remotePatterns za auto-image lookup (OpenFoodFacts, TheMealDB, TheCocktailDB)
  images: {
    formats: ['image/avif', 'image/webp'],
    // Dovoli optimizacijo slik do 2MB (default 1MB je premajhen za nekatere menijske slike)
    minimumCacheTTL: 60 * 60 * 24, // 1 dan
    remotePatterns: [
      { protocol: 'https', hostname: 'images.openfoodfacts.org' },
      { protocol: 'https', hostname: 'www.themealdb.com' },
      { protocol: 'https', hostname: 'www.thecocktaildb.com' },
      { protocol: 'https', hostname: 'foodish-api.com' },
    ],
  },
  headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
};

// FIX Test Production Launch: Sentry wrapper za error tracking + performance
export default withSentryConfig(nextConfig, {
  // Only run Sentry in production builds
  silent: true,
  org: 'markec12345678',
  project: 'restaurantos',
  // Source map upload (requires SENTRY_AUTH_TOKEN)
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
