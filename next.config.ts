import type { NextConfig } from "next";

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
  // CSP — fallback za statične datoteke (middleware nastavi bolj restriktivno per-request)
  // FIX: Prej je bilo tukaj 'unsafe-eval' in http://localhost:* — dev artifacti v produkciji.
  // 'unsafe-inline' za scripts je še vedno potreben ker Next.js injecta inline hydration script.
  // TODO (issue #34): implementiraj nonce-based CSP in odstrani 'unsafe-inline' za scripts.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
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
  serverExternalPackages: ['pdfkit'],
  // FIX BUG 25: Onemogoči ignoreBuildErrors — skriva prave TS napake
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true, // FIX: Omogoči strict mode za boljšo kakovost kode
  // next/image: optimizacija slik (WebP/AVIF konverzija, responsive sizing, lazy loading)
  // Vse slike so lokalne v /public/menu-images/ — ni treba nastavljati remotePatterns.
  images: {
    formats: ['image/avif', 'image/webp'],
    // Dovoli optimizacijo slik do 2MB (default 1MB je premajhen za nekatere menijske slike)
    minimumCacheTTL: 60 * 60 * 24, // 1 dan
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

export default nextConfig;
