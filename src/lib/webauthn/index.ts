// ============================================
// WEBAUTHN (FIDO2) — Biometric login za POS
// Podpira: Touch ID, Face ID, Windows Hello, Android fingerprint
// ============================================

/**
 * Generiraj WebAuthn challenge (random 32 bytes)
 * Klient uporabi to za navigator.credentials.create() ali .get()
 */
export function generateChallenge(): Uint8Array {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  return buf
}

/**
 * Base64url encode za WebAuthn
 */
export function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Base64url decode za WebAuthn
 */
export function base64urlDecode(str: string): Uint8Array {
  const padded = str + '='.repeat((4 - str.length % 4) % 4)
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/**
 * Verificiraj WebAuthn assertion (login)
 *
 * ⚠️ SECURITY WARNING: Ta funkcija NE preverja kriptografskega podpisa!
 * Trenutno samo preverja, da `clientData.challenge` ustreza pričakovanemu challenge-u,
 * kar napadalec lahko trivialno ponaredi (pove, da pozna employeeId → dobi session).
 *
 * Za pravo WebAuthn/FIDO2 integracijo uporabi `@simplewebauthn/server`:
 *   import { verifyAuthenticationResponse } from '@simplewebauthn/server'
 *
 * Dokler ni integriran, route `/api/auth/webauthn` vrača 503 (glej route.ts).
 */
export function verifyAssertion(_assertion: {
  credentialId: string
  authenticatorData: string
  clientDataJSON: string
  signature: string
}, _expectedChallenge: string): boolean {
  // NEVARNO: vrni false, dokler ni implementirano pravo preverjanje podpisa.
  // Route `/api/auth/webauthn` je sicer onemogočen, a če ga kdowo omogoči z
  // WEBAUTHN_ENABLED=true, ta funkcija še vedno zavrne vse assertion-e.
  return false
}
