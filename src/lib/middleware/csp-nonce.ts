// ============================================
// CSP NONCE — Per-request random nonce za inline scripts
//
// FIDO2 / CSP spec:
//   1. Generiramo 18 bajtov randomness (≥128-bit entropy) na vsak request
//   2. Base64 encode → 'nonce-<value>'
//   3. Dodaš v CSP: script-src 'self' 'nonce-<value>'
//   4. Next.js avtomatsko najde nonce v CSP-ju in ga injektira
//      v VSE <script> tag-e (hydration + bootstrap)
//
// ⚠️ EDGE RUNTIME: Ne moremo uporabiti node:crypto — moramo Web Crypto API.
//    (crypto.getRandomValues je global v Edge Runtime + Node.js 19+)
// ============================================

const NONCE_BYTES = 18

/**
 * Generiraj nov per-request nonce kot base64 string.
 *
 * Edge Runtime compatible — uporablja samo Web Crypto API.
 * crypto.getRandomValues je global v Next.js Edge Middleware.
 */
export function generateCspNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES)

  // Web Crypto API — global v Edge Runtime + Node.js 19+
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : (globalThis as { crypto?: Crypto }).crypto
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes)
  } else {
    // Zadnji fallback (ne bi se zgodil v modernem runtime-u)
    for (let i = 0; i < NONCE_BYTES; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }

  // Base64 encode (standard — ne base64url)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str)
}

/**
 * Format nonce za CSP directive: 'nonce-<base64>'
 */
export function formatNonceForCsp(nonce: string): string {
  return `'nonce-${nonce}'`
}

/**
 * Ali CSP vsebuje 'unsafe-inline' za script-src?
 */
export function cspHasUnsafeInline(cspHeaderValue: string): boolean {
  const directives = cspHeaderValue.split(';').map((d) => d.trim())
  const scriptSrc = directives.find((d) => d.startsWith('script-src'))
  if (!scriptSrc) return false
  return scriptSrc.includes("'unsafe-inline'")
}
