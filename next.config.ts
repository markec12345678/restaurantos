import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs/config';
import { readFileSync } from 'fs';

// APP_VERSION iz package.json (RELEASE_PROCESS mesto #7 — health endpoint
// izpostavlja verzijo). Prej je bila fallback vrednost '1.0.13' hardcodirana,
// /api/health je poročal NAPAČNO verzijo (package.json je bil na 1.3.1).
// `env` inlined ob buildu — runtime process.env.APP_VERSION (če je nastavljen)
// še vedno prevlada (Docker lahko prepiše).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

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
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  // FIX OOM (QA 2026-09-17, runda 3): v omejenem okolju (4 GB RAM, cgroup ~2.7 GB
  // za proces) je Turbopack dev compile velikih API-rut ob prvi kompilaciji
  // sprožil OOM killer (next-server ubit pri RSS 1.7 GB). 'full' vsili agresivno
  // izpodrivanje modulov iz pomnilnika med kompilacijo → nižji vrh RSS.
  experimental: {
    turbopackMemoryEviction: 'full',
  },
  // Verzija aplikacije iz package.json — inline ob buildu (health endpoint).
  env: {
    APP_VERSION: pkg.version,
  },
  // FIX: pdfkit needs runtime access to font data files (.afm) in node_modules
  // Turbopack can't bundle these — mark as external package
  serverExternalPackages: ['pdfkit', '@electric-sql/pglite', 'pglite-prisma-adapter', 'undici'],
  // FIX BUG 25: Onemogoči ignoreBuildErrors — skriva prave TS napake.
  // IZJEMA (re-land runde 29, 2026-09-17): Vercel builder ima 4GB — faza
  // "Running TypeScript" (tsc nad ~197k vrsticami) je od runde 29 presegla
  // peak in builderja OOM-kill-a (exit 137; lokalno reploducirano). Tipi so
  // ŠE VEDNO vedno preverjeni: CI job "Lint & Typecheck" (tsc --noEmit) je
  // blocking required check + lokalni workflow. Na Vercelu build samo ne
  // ponovi istega checka — ni izguba varnosti, samo odstranitev duplikata.
  typescript: {
    ignoreBuildErrors: process.env.VERCEL === '1',
  },
  // FIX Vercel 308 MB function (Task 18, 2026-09-17): zmanjšaj traced node_modules.
  // @prisma/engines (34 MB: podvojen query engine + CLI-only schema engine) in
  // prisma CLI (27 MB) NIKOLI niso potrebni v serverless function — runtime engine
  // je v .prisma/client/libquery_engine-*.so.node (ostane vključen).
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@prisma/engines/**',
      'node_modules/prisma/**',
      'node_modules/docx/**',
    ],
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
