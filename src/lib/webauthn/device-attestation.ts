// ============================================
// WEBAUTHN DEVICE ATTESTATION (R97-a) — WebAuthn/passkey temelj za
// device→location binding
// ============================================
// Kontekst: R95 je uvedel device→location binding prek localStorage
// ('restaurantos-pos-device-location' → resolveDeviceLocation.ts). Ta binding
// je SPOOFABLE (devtools). Ta modul je KRIPTOGRAFSKA plast: naprava dokaže
// posest FIDO2 poverilnice LOKACIJE (WebAuthn assertion / attestation), ki je
// ni mogoče kovati brez privatnega ključa authenticatorja.
//
// ADDITIVEN TEMELJ (R97): login kontrakt NI dotaknjen — PinLogin integracija
// teče v R98 po bake fazi. Ločeno od BiometricCredential (employee biometrična
// prijava, src/lib/webauthn/index.ts + db-helpers.ts — ta modul teh fajlov NE
// spreminja, samo re-uporablja config/base64url pomočnike).
//
// ─── CHALLENGE STRATEGIJA (dokumentirana odločitev, brief §2) ───
// STATELESS SIGNED CHALLENGE (HMAC) — brez challenge DB tabele:
//   token = base64url( payload || HMAC-SHA256(payload) )
//   payload = {"v":1,"e":<expiryMs>,"n":<nonce-hex>,"l":<locationId>}
//   - skrivnost: NEXTAUTH_SECRET || ENCRYPTION_KEY || ORDERING_TOKEN_SECRET
//     (bereta se OB KLICU — pin-lookup.ts standalone-build FIX vzorec);
//     dev/test fallback fiksen dev secret (ordering-token kanon);
//     produkcija BREZ skrivnosti = fail-closed 503 (isDeviceChallengeSecretConfigured).
//   - format jeČIST base64url (MAC je prilepljen na payload, BREZ '.' ločila!):
//     WebAuthn API round-tripa challenge kot bajte (browser: base64url-decode →
//     navigator.credentials → base64url-encode v clientDataJSON). Niz s '.'
//     ne bi preživel round-tripa byte-točno.
//   - SINGLE-USE enforcement: kratek TTL (120 s) + FIDO2 signature counter
//     (strictly-increasing) — brez nonce shrambe. WebAuthn assertion sam po
//     sebi nosi podpis + counter, tako da replay okna 120 s ne more ponoviti.
//   - lokacija je Vezana V payload ('l') — challenge mintan za lokacijo A ni
//     uporaben za lokacijo B (register in verify preverjata ujemanje).
//
// ─── USER VERIFICATION POLICIJA ───
// 'preferred' + requireUserVerification: false (UX fail-open; posest ključa je
// nosilec varnosti v tem temeljnem rundi). UV policy za prijavno integracijo
// odloči R98 (BiometricCredential prijava ostane 'required' — nespremenjeno).
// ============================================

import crypto from 'crypto'
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server'
import { base64urlEncode, base64urlDecode, getWebAuthnConfig } from '@/lib/webauthn'
import { logger } from '@/lib/logger'

/** Challenge TTL — 120 s (brief §2: single-use prek kratkega TTL + counter). */
export const DEVICE_CHALLENGE_TTL_MS = 120 * 1000

/** Payload verzija — buduča kompatibilnost (sprememba oblike = v:2). */
const CHALLENGE_VERSION = 1

/** Dolžina MAC-a (HMAC-SHA256 digest = 32 bajtov), prilepljen na payload. */
const MAC_LENGTH = 32

/**
 * Skrivnost za challenge HMAC — bere se OB KLICU (ne ob module load —
 * pin-lookup.ts FIX: Next.js standalone build lahko "bake in" env ob buildu).
 * Veriga: NEXTAUTH_SECRET (auth skrivnost — seje/pinLookup) || ENCRYPTION_KEY
 * || ORDERING_TOKEN_SECRET. null = ni nastavljena.
 */
function resolveDeviceChallengeSecret(): string | null {
  return (
    process.env.NEXTAUTH_SECRET ||
    process.env.ENCRYPTION_KEY ||
    process.env.ORDERING_TOKEN_SECRET ||
    null
  )
}

/**
 * Je HMAC skrivnost na voljo (ali je dev/test, kjer je fallback dovoljen)?
 * Produkcija brez skrivnosti = false → rute vrnejo 503 (fail-closed, nikoli
 * ne izdajaj challenge-jev z javno znanim dev secretom — ordering-token kanon).
 */
export function isDeviceChallengeSecretConfigured(): boolean {
  if (resolveDeviceChallengeSecret()) return true
  return process.env.NODE_ENV !== 'production'
}

function deviceChallengeSecret(): string {
  const secret = resolveDeviceChallengeSecret()
  if (secret) return secret
  // SAMO dev/test — produkcija fail-closed (glej isDeviceChallengeSecretConfigured).
  if (process.env.NODE_ENV !== 'production') {
    return 'restaurantos-device-challenge-dev-secret-DO-NOT-USE-IN-PROD'
  }
  throw new Error(
    'Device challenge secret ni nastavljen (produkcija zahteva NEXTAUTH_SECRET / ENCRYPTION_KEY / ORDERING_TOKEN_SECRET)',
  )
}

function hmacForPayload(payloadBytes: Uint8Array): Buffer {
  return crypto.createHmac('sha256', deviceChallengeSecret()).update(payloadBytes).digest()
}

/** Timing-safe primerjava dveh enako-dolgih hex-free Buffer-jev (false ob različni dolžini). */
function timingSafeEqualBuffers(a: Uint8Array, b: Uint8Array): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Mintaj stateless signed challenge za lokacijo.
 * Vrne ČIST base64url niz (payload || MAC) — varen za WebAuthn round-trip.
 * Ob produkciji brez skrivnosti THROW (rute prej preverijo isDeviceChallengeSecretConfigured → 503).
 */
export function mintDeviceChallenge(locationId: string, nowMs: number = Date.now()): string {
  const payload = JSON.stringify({
    v: CHALLENGE_VERSION,
    e: nowMs + DEVICE_CHALLENGE_TTL_MS,
    n: crypto.randomBytes(16).toString('hex'),
    l: locationId,
  })
  const payloadBytes = new TextEncoder().encode(payload)
  const mac = hmacForPayload(payloadBytes)
  const tokenBytes = new Uint8Array(payloadBytes.length + MAC_LENGTH)
  tokenBytes.set(payloadBytes, 0)
  tokenBytes.set(mac, payloadBytes.length)
  return base64urlEncode(tokenBytes)
}

/**
 * Verificiraj signed challenge token (timing-safe, brez throw-a).
 * Preveri: oblika, MAC, TTL (e > now), verzijo in LOKACIJO ('l' === locationId).
 * false za VSE neuspehe (tudi produkcija brez skrivnosti — fail-closed) —
 * klicatelj vrne unificirano napako (ni oraklja).
 */
export function verifyDeviceChallenge(
  token: string,
  locationId: string,
  nowMs: number = Date.now(),
): boolean {
  try {
    if (typeof token !== 'string' || token.length < 8) return false
    let tokenBytes: Uint8Array
    try {
      tokenBytes = base64urlDecode(token)
    } catch {
      return false
    }
    if (tokenBytes.length <= MAC_LENGTH) return false
    const payloadBytes = tokenBytes.subarray(0, tokenBytes.length - MAC_LENGTH)
    const mac = tokenBytes.subarray(tokenBytes.length - MAC_LENGTH)
    const expectedMac = hmacForPayload(payloadBytes)
    if (!timingSafeEqualBuffers(mac, expectedMac)) return false

    let payload: { v?: number; e?: number; l?: string }
    try {
      payload = JSON.parse(new TextDecoder().decode(payloadBytes))
    } catch {
      return false
    }
    if (payload.v !== CHALLENGE_VERSION) return false
    if (typeof payload.e !== 'number' || payload.e <= nowMs) return false
    if (payload.l !== locationId) return false
    return true
  } catch {
    // Produkcija brez HMAC skrivnosti → deviceChallengeSecret() throw → false
    // (fail-closed, brez oraklja).
    return false
  }
}

/**
 * Izlušči challenge iz clientDataJSON (base64url-encoded v assertion/attestation
 * response-u). null = neuparen JSON / manjkajoč challenge (unificirana napaka).
 */
export function extractChallengeFromClientData(clientDataJSON: string): string | null {
  if (typeof clientDataJSON !== 'string' || clientDataJSON.length === 0) return null
  try {
    const decoded = base64urlDecode(clientDataJSON)
    const parsed = JSON.parse(new TextDecoder().decode(decoded)) as { challenge?: unknown }
    return typeof parsed.challenge === 'string' ? parsed.challenge : null
  } catch {
    return null
  }
}

// ─── Transporti: comma-joined string (R97-a model konvencija, NE JSON-as-String) ───

const VALID_TRANSPORTS: AuthenticatorTransport[] = ['ble', 'hybrid', 'internal', 'nfc', 'usb']

/** Array → comma-joined string za DB (prazno → null). Sprejme tudi surov string[]
 *  (registrationInfo.credential.transports je v v14 tipiziran širše). */
export function joinTransports(
  transports: readonly string[] | null | undefined,
): string | null {
  if (!transports || transports.length === 0) return null
  return (
    transports
      .filter((t) => VALID_TRANSPORTS.includes(t as AuthenticatorTransport))
      .join(',') || null
  )
}

/** DB string → typed array za @simplewebauthn verification input. */
export function splitTransports(transports: string | null | undefined): AuthenticatorTransport[] {
  if (!transports) return []
  return transports
    .split(',')
    .map((t) => t.trim())
    .filter((t): t is AuthenticatorTransport => VALID_TRANSPORTS.includes(t as AuthenticatorTransport))
}

// ─── Registration / authentication options (device sloj) ───

export interface DeviceExistingCredential {
  credentialId: string
  transports: string | null
}

/**
 * Registration options za NOVO device poverilnico (DeviceTab "Registriraj ključ").
 * Challenge = SIGNED token (mintDeviceChallenge) — alternativni klicatelj bi ga
 * moral podpisati sam. excludeCredentials preprečuje dvojno registracijo istega
 * authenticatorja na isti lokaciji.
 */
export function buildDeviceRegistrationOptions(
  locationId: string,
  locationName: string,
  existingCredentials: DeviceExistingCredential[],
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const config = getWebAuthnConfig()
  const challenge = mintDeviceChallenge(locationId)
  return generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    // userID: lokacijsko vezan determinističen identifikator (hex iz locationId)
    // — device poverilnica pripada LOKACIJI, ne employee-ju.
    userID: new TextEncoder().encode(locationId),
    userName: `device:${locationId}`,
    userDisplayName: `Naprava — ${locationName}`,
    challenge,
    excludeCredentials: existingCredentials.map((c) => ({
      id: c.credentialId,
      type: 'public-key' as const,
      transports: splitTransports(c.transports),
    })),
    authenticatorSelection: {
      // platform attachment = Touch ID / Windows Hello / Android — kiosk naprave;
      // cross-platform (YubiKey) ostane možen prek 'preferred' attachment izpusta.
      userVerification: 'preferred',
      residentKey: 'preferred',
    },
    supportedAlgorithmIDs: [-7, -257], // ES256, RS256
  })
}

/**
 * Authentication options za ASSERTION na znani lokaciji (R98 prijavna integracija;
 * v R97 DeviceTab ne kliče te veje — options endpoint jo servisira dodano).
 */
export function buildDeviceAuthenticationOptions(
  locationId: string,
  allowCredentials: DeviceExistingCredential[] = [],
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const config = getWebAuthnConfig()
  const challenge = mintDeviceChallenge(locationId)
  return generateAuthenticationOptions({
    rpID: config.rpID,
    challenge,
    userVerification: 'preferred',
    allowCredentials: allowCredentials.map((c) => ({
      id: c.credentialId,
      type: 'public-key' as const,
      transports: splitTransports(c.transports),
    })),
  })
}

// ─── Verification wrappers (device sloj — mirror existing index.ts, UV 'preferred') ───

export interface DeviceVerifiedRegistration {
  verified: boolean
  registrationInfo?: VerifiedRegistrationResponse['registrationInfo']
}

export interface DeviceVerifiedAuthentication {
  verified: boolean
  authenticationInfo?: VerifiedAuthenticationResponse['authenticationInfo']
}

/** DB vrstica (minimalna oblika, ki jo rabi assertion verifikacija). */
export interface DeviceStoredCredential {
  credentialId: string
  publicKey: string // base64url COSE ključ
  counter: number
  transports: string | null
}

/**
 * Verificiraj attestation (registration) response — wrapper okoli
 * verifyRegistrationResponse z signed challenge + UV ne-obvezen (glej header).
 * Nikoli ne throw-a (napaka = { verified: false } — unificiran reject v ruti).
 */
export async function verifyDeviceRegistration(
  credential: RegistrationResponseJSON,
  expectedChallenge: string,
): Promise<DeviceVerifiedRegistration> {
  const config = getWebAuthnConfig()
  try {
    const verified = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: false,
    })
    return {
      verified: verified.verified,
      registrationInfo: verified.registrationInfo,
    }
  } catch (err) {
    logger.warn('webauthn', 'verifyDeviceRegistration failed', err instanceof Error ? err.message : err)
    return { verified: false }
  }
}

/**
 * Verificiraj assertion (authentication) response proti shranjeni poverilnici.
 * Nikoli ne throw-a (napaka = { verified: false }).
 */
export async function verifyDeviceAssertion(
  assertion: AuthenticationResponseJSON,
  expectedChallenge: string,
  credential: DeviceStoredCredential,
): Promise<DeviceVerifiedAuthentication> {
  const config = getWebAuthnConfig()
  try {
    const verified = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      credential: {
        id: credential.credentialId,
        publicKey: base64urlDecode(credential.publicKey),
        counter: credential.counter,
        transports: splitTransports(credential.transports),
      },
      requireUserVerification: false,
    })
    return {
      verified: verified.verified,
      authenticationInfo: verified.authenticationInfo,
    }
  } catch (err) {
    logger.warn('webauthn', 'verifyDeviceAssertion failed', err instanceof Error ? err.message : err)
    return { verified: false }
  }
}
