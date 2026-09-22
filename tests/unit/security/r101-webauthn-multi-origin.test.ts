// ============================================
// R101 — WEBAUTHN MULTI-ORIGIN expectedOrigin (produkcija-readiness fix)
// ============================================
// Kontekst: getWebAuthnConfig() je expectedOrigin izpeljal IZKLJUČNO iz
// NEXTAUTH_URL (en string). FIDO2 verifikacija primerja origin clientDataJSON
// z expectedOrigin — poljuben legitimen dostop prek DRUGE domene (custom
// domena ob vercel.app, www vs apex, staging port) bi pomenil, da VSE
// ceremony (registracija + assertion, employee BIOMETRIČNI sloj R79 IN
// device attestation sloj R97) padejo na origin mismatch — WebAuthn bi bil
// praktično pokvarjen, takoj ko operater doda domeno.
//
// FIX (R101): v14 @simplewebauthn/server sprejme expectedOrigin string |
// string[] — getWebAuthnOrigins() zbere allowlist (NEXTAUTH_URL prioritetno,
// NEXT_PUBLIC_APP_URL, WEBAUTHN_EXTRA_ORIGINS vejica-ločeno; validacija
// http/https; dedup; localhost fallback) in VSI ŠTIRI verify wrapperji
// podajajo ARRAY. Cross-domain uporaba poverilnic ostane nemogoča — browser
// sam uveljavlja rpID kompatibilnost ob ceremony (rpID je registrable
// suffix izvornega domena), expectedOrigin array torej NIKOLI ne razširi
// varnosti, samo tolerira legitimate variante.
//
// Pokritost (logika, ne omrežje):
//   A. Employee sloj (R79, index.ts): verifyRegistration + verifyAssertion
//      prejmeta expectedOrigin kot ARRAY vseh originov; UV 'required'
//      kontrakt ostane (regresijski pin).
//   B. Device sloj (R97, device-attestation.ts): verifyDeviceRegistration +
//      verifyDeviceAssertion prejmeta ARRAY; UV 'preferred'/false kontrakt.
//   C. Single-origin env → array z natanko enim elementom (v14 sprejme).
//   D. fs-guard: vsi štirje wrapperji v viru uporabljajo
//      'expectedOrigin: config.origins' — 'expectedOrigin: config.origin,'
//      (stari enojni kontrakt) je IZBRISAN iz obeh fajlov.
//
// Vzorec (r97/r99): vi.hoisted + vi.mock tovarne, capture args, realni
// helperji (base64url) ostanejo — @simplewebauthn/server stuban (vmThreads
// kanon: module-scope side effect crash). FONKS pool: ta fajl NE stuba
// window/navigator direktno (jsdom env v unit-vm je OK za URL/env operacije).
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const mocks = vi.hoisted(() => ({
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}))

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyRegistrationResponse: mocks.verifyRegistrationResponse,
  verifyAuthenticationResponse: mocks.verifyAuthenticationResponse,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// Importi PO mockih — REALNI wrapperji (samo @simplewebauthn/server je stuban)
import {
  verifyRegistration,
  verifyAssertion,
} from '@/lib/webauthn'
import {
  verifyDeviceRegistration,
  verifyDeviceAssertion,
} from '@/lib/webauthn/device-attestation'

const MULTI_ORIGINS = ['https://pos.example.com', 'https://www.pos.example.com']

function stubEnv() {
  process.env.NEXTAUTH_URL = 'https://pos.example.com'
  process.env.WEBAUTHN_EXTRA_ORIGINS = 'https://www.pos.example.com'
}

const REG_RESPONSE = {
  id: 'cred-1',
  rawId: 'cred-1',
  type: 'public-key' as const,
  response: {
    clientDataJSON: 'e30', // base64url('{}')
    attestationObject: 'ao',
  },
  clientExtensionResults: {},
} as unknown as Parameters<typeof verifyRegistration>[0]

const ASSERTION_RESPONSE = {
  id: 'cred-1',
  rawId: 'cred-1',
  type: 'public-key' as const,
  response: {
    clientDataJSON: 'e30',
    authenticatorData: 'ad',
    signature: 'sig',
    userHandle: null,
  },
  clientExtensionResults: {},
} as unknown as Parameters<typeof verifyAssertion>[0]

const STORED = { credentialId: 'cred-1', publicKey: 'QUJD', counter: 4, transports: 'internal' }

beforeEach(() => {
  vi.clearAllMocks()
  stubEnv()
  mocks.verifyRegistrationResponse.mockResolvedValue({
    verified: true,
    registrationInfo: { credential: { id: 'cred-1', publicKey: new Uint8Array([1]), counter: 0 } },
  })
  mocks.verifyAuthenticationResponse.mockResolvedValue({
    verified: true,
    authenticationInfo: { newCounter: 5 },
  })
})

afterEach(() => {
  delete process.env.NEXTAUTH_URL
  delete process.env.WEBAUTHN_EXTRA_ORIGINS
  delete process.env.NEXT_PUBLIC_APP_URL
})

// ══════════════════════════════════════════════════════════════════
// A. Employee sloj (R79) — array expectedOrigin + UV kontrakt
// ══════════════════════════════════════════════════════════════════
describe('R101 A: employee sloj (index.ts) — array expectedOrigin', () => {
  it('verifyRegistration podaja expectedOrigin kot ARRAY vseh originov', async () => {
    await verifyRegistration(REG_RESPONSE, 'chal-1')

    expect(mocks.verifyRegistrationResponse).toHaveBeenCalledTimes(1)
    const arg = mocks.verifyRegistrationResponse.mock.calls[0][0] as {
      expectedOrigin: string[]
      expectedRPID: string
      requireUserVerification: boolean
    }
    expect(Array.isArray(arg.expectedOrigin)).toBe(true)
    expect(arg.expectedOrigin).toEqual(MULTI_ORIGINS)
    expect(arg.expectedRPID).toBe('pos.example.com')
    // R79 kontrakt: UV 'required' ostane v employee sloju
    expect(arg.requireUserVerification).toBe(true)
  })

  it('verifyAssertion podaja expectedOrigin kot ARRAY vseh originov', async () => {
    const result = await verifyAssertion(ASSERTION_RESPONSE, 'chal-1', STORED)

    expect(result.verified).toBe(true)
    expect(mocks.verifyAuthenticationResponse).toHaveBeenCalledTimes(1)
    const arg = mocks.verifyAuthenticationResponse.mock.calls[0][0] as {
      expectedOrigin: string[]
      expectedRPID: string
    }
    expect(Array.isArray(arg.expectedOrigin)).toBe(true)
    expect(arg.expectedOrigin).toEqual(MULTI_ORIGINS)
    expect(arg.expectedRPID).toBe('pos.example.com')
  })

  it('neuspešna verifikacija (origin mismatch) → { verified: false } brez throw-a (fail-closed kanon)', async () => {
    mocks.verifyAuthenticationResponse.mockRejectedValue(new Error('Origin mismatch'))
    const result = await verifyAssertion(ASSERTION_RESPONSE, 'chal-1', STORED)
    expect(result.verified).toBe(false)
    expect(result.authenticationInfo).toBeUndefined()
  })
})

// ══════════════════════════════════════════════════════════════════
// B. Device sloj (R97) — array expectedOrigin + UV kontrakt
// ══════════════════════════════════════════════════════════════════
describe('R101 B: device sloj (device-attestation.ts) — array expectedOrigin', () => {
  it('verifyDeviceRegistration podaja expectedOrigin kot ARRAY vseh originov', async () => {
    const result = await verifyDeviceRegistration(REG_RESPONSE, 'token-123')

    expect(result.verified).toBe(true)
    expect(mocks.verifyRegistrationResponse).toHaveBeenCalledTimes(1)
    const arg = mocks.verifyRegistrationResponse.mock.calls[0][0] as {
      expectedOrigin: string[]
      expectedRPID: string
      requireUserVerification: boolean
    }
    expect(Array.isArray(arg.expectedOrigin)).toBe(true)
    expect(arg.expectedOrigin).toEqual(MULTI_ORIGINS)
    // R97 kontrakt: UV NI obvezen v device sloju (UX fail-open, posest ključa)
    expect(arg.requireUserVerification).toBe(false)
  })

  it('verifyDeviceAssertion podaja expectedOrigin kot ARRAY vseh originov', async () => {
    const result = await verifyDeviceAssertion(ASSERTION_RESPONSE, 'token-123', STORED)

    expect(result.verified).toBe(true)
    expect(mocks.verifyAuthenticationResponse).toHaveBeenCalledTimes(1)
    const arg = mocks.verifyAuthenticationResponse.mock.calls[0][0] as {
      expectedOrigin: string[]
      expectedRPID: string
    }
    expect(Array.isArray(arg.expectedOrigin)).toBe(true)
    expect(arg.expectedOrigin).toEqual(MULTI_ORIGINS)
    // device sloj podaja DB credentialId (ne klientovega assertion.id — R97)
    const credentialArg = (mocks.verifyAuthenticationResponse.mock.calls[0][0] as {
      credential: { id: string }
    }).credential
    expect(credentialArg.id).toBe('cred-1')
  })
})

// ══════════════════════════════════════════════════════════════════
// C. Single-origin env — array z natanko enim elementom (v14 sprejme)
// ══════════════════════════════════════════════════════════════════
describe('R101 C: single-origin env → enoelementni array', () => {
  it('brez EXTRA originov → expectedOrigin = [primary] (array, ne string)', async () => {
    delete process.env.WEBAUTHN_EXTRA_ORIGINS

    await verifyDeviceRegistration(REG_RESPONSE, 'token-123')

    const arg = mocks.verifyRegistrationResponse.mock.calls[0][0] as { expectedOrigin: string[] }
    expect(arg.expectedOrigin).toEqual(['https://pos.example.com'])
  })
})

// ══════════════════════════════════════════════════════════════════
// D. fs-guard — vir pina nov kontrakt
// ══════════════════════════════════════════════════════════════════
describe('R101 D: fs-guard — multi-origin kontrakt v viru', () => {
  it('index.ts: expectedOrigin: config.origins (array), stari enojni kontrakt izbrisan', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/webauthn/index.ts'), 'utf8')
    expect(src).toContain('expectedOrigin: config.origins')
    // stari enojni kontrakt — trailing comma loči od novega (origins)
    expect(src).not.toContain('expectedOrigin: config.origin,')
    expect(src).toContain('export function getWebAuthnOrigins')
    // localhost fallback — nikoli prazen array
    expect(src).toContain("origins.push('http://localhost:3000')")
  })

  it('device-attestation.ts: expectedOrigin: config.origins (array), stari enojni kontrakt izbrisan', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/webauthn/device-attestation.ts'), 'utf8')
    expect(src).toContain('expectedOrigin: config.origins')
    expect(src).not.toContain('expectedOrigin: config.origin,')
  })

  it('.env.example dokumentira WEBAUTHN_EXTRA_ORIGINS (operater onboarding)', () => {
    const src = readFileSync(join(process.cwd(), '.env.example'), 'utf8')
    expect(src).toContain('WEBAUTHN_EXTRA_ORIGINS=')
    expect(src).toContain('expectedOrigin allowlist')
  })
})
