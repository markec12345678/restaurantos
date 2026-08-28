// ============================================
// CSP NONCE — Per-request random nonce za inline scripts
//
// FIDO2 / CSP spec:
//   1. Generiramo 18 bajtov randomness (≥128-bit entropy) na vsak request
//   2. Base64 encode → 'nonce-<value>'
//   3. Dodaš v CSP: script-src 'self' 'nonce-<value>'
//   4. Next.js avtomatsko najde nonce v CSP-ju in ga injektira
//      v VSE <script> tag-e (hydration + bootstrap)
// ============================================

import { webcrypto } from 'node:crypto'

const NONCE_BYTES = 18

/**
 * Generiraj nov per-request nonce kot base64 string.
 */
export function generateCspNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES)
  if (webcrypto?.getRandomValues) {
    webcrypto.getRandomValues(bytes)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomBytes } = require('node:crypto') as { randomBytes: (n: number) => Buffer }
    const buf = randomBytes(NONCE_BYTES)
    bytes.set(buf)
  }

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
