// ============================================
// WEBAUTHN (FIDO2) — Biometric login za POS
// Podpira: Touch ID, Face ID, Windows Hello, Android fingerprint, YubiKey
//
// IMPLEMENTACIJA: @simplewebauthn/server v11 — pravo kriptografsko preverjanje
// podpisa (COSE / ES256 / RS256 / EdDSA). Prejšnja implementacija je bila
// onemogočena, ker je verifyAssertion() preverjal samo clientData.challenge.
// ============================================

import {
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  generateRegistrationOptions,
  generateAuthenticationOptions,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/types'

export interface WebAuthnConfig {
  rpName: string
  rpID: string
  origin: string
}

/**
 * Preberi WebAuthn konfiguracijo iz env spremenljivk.
 *
 * rpID = hostname (npr. "localhost", "pos.example.com")
 * origin = protocol + rpID + port (npr. "https://pos.example.com")
 *
 * V produkciji MORA biti HTTPS (razen localhost za razvoj).
 */
export function getWebAuthnConfig(): WebAuthnConfig {
  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  let origin: string
  try {
    const url = new URL(appUrl)
    origin = url.origin
  } catch {
    origin = 'http://localhost:3000'
  }
  const rpID = new URL(origin).hostname

  return {
    rpName: process.env.NEXT_PUBLIC_APP_NAME || 'RestaurantOS',
    rpID,
    origin,
  }
}

/**
 * Ali je WebAuthn omogočen?
 *
 * true, ko je WEBAUTHN_ENABLED=true ALI ko je produkcija z HTTPS origin-om.
 */
export function isWebAuthnEnable(): boolean {
  if (process.env.WEBAUTHN_ENABLED === 'true') return true
  if (process.env.NODE_ENV === 'production') {
    const { origin } = getWebAuthnConfig()
    return origin.startsWith('https://')
  }
  return false
}

/**
 * Generiraj WebAuthn challenge (random 32 bytes) kot base64url string.
 */
export function generateChallenge(): string {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  return base64urlEncode(buf)
}

/**
 * Base64url encode za WebAuthn (RFC 4648 §5)
 */
export function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Base64url decode za WebAuthn (RFC 4648 §5)
 */
export function base64urlDecode(str: string): Uint8Array {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// ─── Verification result types ───
export interface VerifiedRegistration {
  verified: boolean
  registrationInfo?: VerifiedRegistrationResponse['registrationInfo']
}

export interface VerifiedAuthentication {
  verified: boolean
  authenticationInfo?: VerifiedAuthenticationResponse['authenticationInfo']
}

// ─── DB row shape ───
export interface StoredCredential {
  credentialId: string
  publicKey: string // base64url-encoded SPKI public key
  counter: number
  transports: string // JSON array string
}

/**
 * Convert DB-stored transports (JSON string) → typed array.
 */
export function parseTransports(transportsJson: string): AuthenticatorTransportFuture[] {
  try {
    const parsed = JSON.parse(transportsJson)
    if (Array.isArray(parsed)) {
      const valid: AuthenticatorTransportFuture[] = ['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']
      return parsed.filter(
        (t): t is AuthenticatorTransportFuture =>
          typeof t === 'string' && valid.includes(t as AuthenticatorTransportFuture)
      )
    }
  } catch {
    // ignore
  }
  return []
}

/**
 * Convert DB-stored publicKey (base64url string) → Uint8Array.
 */
export function decodePublicKey(b64url: string): Uint8Array {
  return base64urlDecode(b64url)
}

// ─── Registration options ───
export interface ExistingCredentialForReg {
  id: string
  transports: string
}

/**
 * Generiraj WebAuthn registration options za navigator.credentials.create().
 */
export async function buildRegistrationOptions(
  employeeId: string,
  employeeName: string,
  existingCredentials: ExistingCredentialForReg[],
) {
  const config = getWebAuthnConfig()
  return generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userName: employeeId,
    userDisplayName: employeeName,
    excludeCredentials: existingCredentials.map((c) => ({
      id: c.id,
      type: 'public-key' as const,
      transports: parseTransports(c.transports),
    })),
    authenticatorSelection: {
      authenticatorAttachment: 'platform' as const,
      userVerification: 'required' as const,
      residentKey: 'preferred' as const,
    },
    supportedAlgorithmIDs: [-7, -257], // ES256, RS256
  })
}

// ─── Authentication options ───

/**
 * Generiraj WebAuthn authentication options za navigator.credentials.get().
 */
export async function buildAuthenticationOptions() {
  const config = getWebAuthnConfig()
  return generateAuthenticationOptions({
    rpID: config.rpID,
    userVerification: 'required' as const,
  })
}

/**
 * Verificiraj WebAuthn registracijo.
 */
export async function verifyRegistration(
  credential: RegistrationResponseJSON,
  expectedChallenge: string,
): Promise<VerifiedRegistration> {
  const config = getWebAuthnConfig()
  try {
    const verified = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
    })
    return {
      verified: verified.verified,
      registrationInfo: verified.registrationInfo,
    }
  } catch (err) {
    console.warn('[webauthn] verifyRegistration failed:', err instanceof Error ? err.message : err)
    return { verified: false }
  }
}

/**
 * Verificiraj WebAuthn assertion (login).
 */
export async function verifyAssertion(
  assertion: AuthenticationResponseJSON,
  expectedChallenge: string,
  credential: StoredCredential,
): Promise<VerifiedAuthentication> {
  const config = getWebAuthnConfig()
  try {
    const verified = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      credential: {
        id: assertion.id,
        publicKey: decodePublicKey(credential.publicKey),
        counter: credential.counter,
        transports: parseTransports(credential.transports),
      },
      requireUserVerification: true,
    })
    return {
      verified: verified.verified,
      authenticationInfo: verified.authenticationInfo,
    }
  } catch (err) {
    console.warn('[webauthn] verifyAssertion failed:', err instanceof Error ? err.message : err)
    return { verified: false }
  }
}
