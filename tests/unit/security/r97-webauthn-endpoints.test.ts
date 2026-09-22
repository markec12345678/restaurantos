// ============================================
// R97-a — WEBAUTHN DEVICE ATTESTATION ENDPOINTI (passkey temelj)
// ============================================
// Pokritost (logika, ne omrežje):
//   A. Signed challenge (REALNI HMAC crypto prek importActual — modul je
//      sicer mockan za route teste): mint/verify, TTL 120 s, lokacijska
//      vezava, tamper, fail-closed produkcija brez skrivnosti.
//   B. GET /api/auth/webauthn/options — javna površina: rate limit NA VRHU,
//      unified 404 matrika (zero db za manjkajoč/slab format), 503 fail-closed.
//   C. POST /api/auth/webauthn/verify — replay counter reject, neznana
//      poverilnica unified 401, cross-location spoof guard, counter increment.
//   D. POST /api/settings/webauthn/register — admin guard, tenant scope
//      (tuji locationId → 404 zero db), P2002 → 409, brez publicKey v odgovoru.
//   E. GET /api/settings/webauthn/credentials — admin guard, super-admin 400,
//      select NIKOLI publicKey.
//   F. DELETE /api/settings/webauthn/credentials/[id] — scoped deleteMany,
//      cross-tenant = neobstoječi = ISTI 404 (zero oracle, en klic).
//   G. fs-guard — route vir pina kanon (r93/r95 hišni stil).
//
// Vzorec (r95-login-binding/r92): vi.hoisted + vi.mock tovarne,
// mockResolvedValue (NIKOLI .Once), zero-klic asserti, invocationCallOrder.
// REALNI: rateLimitedResponse (direkten import), tenant-scope (db pade na
// mockan '@/lib/db'), parseJsonBody (realen Request parsing), base64urlEncode
// ('@/lib/webauthn' index ostane realen — pure functions).
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const mocks = vi.hoisted(() => ({
  // db
  locationFindFirst: vi.fn(),
  webauthnFindUnique: vi.fn(),
  webauthnFindMany: vi.fn(),
  webauthnCreate: vi.fn(),
  webauthnUpdate: vi.fn(),
  webauthnUpdateMany: vi.fn(), // R100: atomarni counter check-and-set
  webauthnDeleteMany: vi.fn(),
  // rate limit barrel (rute jemljejo iz barrela; response ostane realen)
  rateLimitCheck: vi.fn(),
  // auth-middleware barrel (settings guard)
  requireAuth: vi.fn(),
  // device-attestation (challenge + @simplewebauthn wrappers)
  secretConfigured: vi.fn(),
  buildRegistrationOptions: vi.fn(),
  buildAuthenticationOptions: vi.fn(),
  extractChallenge: vi.fn(),
  verifyChallenge: vi.fn(),
  verifyAssertion: vi.fn(),
  verifyRegistration: vi.fn(),
  joinTransports: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    location: {
      findFirst: mocks.locationFindFirst,
    },
    webAuthnCredential: {
      findUnique: mocks.webauthnFindUnique,
      findMany: mocks.webauthnFindMany,
      create: mocks.webauthnCreate,
      update: mocks.webauthnUpdate,
      updateMany: mocks.webauthnUpdateMany,
      deleteMany: mocks.webauthnDeleteMany,
    },
  },
}))

vi.mock('@/lib/rate-limit', async () => {
  const presets = await import('@/lib/rate-limit/presets')
  return {
    checkRateLimitAsync: mocks.rateLimitCheck,
    getClientIp: vi.fn(() => '203.0.113.7'),
    GENERAL_PUBLIC_LIMIT: presets.GENERAL_PUBLIC_LIMIT,
    AUTHENTICATED_LIMIT: presets.AUTHENTICATED_LIMIT,
  }
})

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// @simplewebauthn/server se TUKAJ ne sme naloziti realno: v14 ima module-scope
// side effect (new BaseSettingsService → runtimeSupportsWebCryptoKeyAlg), ki
// pade v unit-vm (vmThreads) okolju ("Cannot read properties of undefined
// (reading 'supports')"; obstoječi tests/unit/auth/webauthn.test.ts zato teče
// v forks poolu — GLOBAL_STUB_FILES v vitest.config.ts). Ta test fajl realnih
// lib funkcij NE izvaja (device-attestation je mockan; sekcija A prek
// importActual izvede SAMO challenge HMAC + transporte — lokalni crypto).
// Stub garantuje, da realen modul sploh ne vstopi v graf (vi.mock je hoisted).
vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}))

vi.mock('@/lib/webauthn/device-attestation', () => ({
  DEVICE_CHALLENGE_TTL_MS: 120 * 1000,
  isDeviceChallengeSecretConfigured: mocks.secretConfigured,
  buildDeviceRegistrationOptions: mocks.buildRegistrationOptions,
  buildDeviceAuthenticationOptions: mocks.buildAuthenticationOptions,
  extractChallengeFromClientData: mocks.extractChallenge,
  verifyDeviceChallenge: mocks.verifyChallenge,
  verifyDeviceAssertion: mocks.verifyAssertion,
  verifyDeviceRegistration: mocks.verifyRegistration,
  joinTransports: mocks.joinTransports,
}))

// Importi PO mockih
import { GET as optionsGET } from '@/app/api/auth/webauthn/options/route'
import { POST as verifyPOST } from '@/app/api/auth/webauthn/verify/route'
import { POST as registerPOST } from '@/app/api/settings/webauthn/register/route'
import { GET as credentialsGET } from '@/app/api/settings/webauthn/credentials/route'
import { DELETE as credentialsDELETE } from '@/app/api/settings/webauthn/credentials/[id]/route'
import { notInScopeResponse } from '@/lib/tenant-scope'

const LOCATION_FIXTURE = { id: 'loc-1', name: 'Test Lokacija' }
const VERIFY_FAILED_MESSAGE = 'WebAuthn verifikacija ni uspela.'
const REGISTER_FAILED_MESSAGE = 'Registracija ni uspela. Podpis ali podatek o napravi niso veljavni.'

/** clientDataJSON fixture — base64url({"challenge":"token-123"}) — REALNI b64url. */
const CLIENT_DATA_JSON = Buffer.from(JSON.stringify({ challenge: 'token-123' }), 'utf8')
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '')

function assertionFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cred-1',
    response: { clientDataJSON: CLIENT_DATA_JSON, authenticatorData: 'AAAA', signature: 'SIG' },
    ...overrides,
  }
}

function credentialRow(overrides: Record<string, unknown> = {}) {
  return {
    credentialId: 'cred-1',
    publicKey: 'pk-b64url',
    counter: 4,
    transports: 'internal',
    locationId: 'loc-1',
    location: { id: 'loc-1', name: 'Test Lokacija' },
    ...overrides,
  }
}

const SUPER_ADMIN_SESSION = {
  employeeId: 'admin-root',
  role: 'super_admin',
  locationId: null,
  permissions: ['admin'],
}
const BOUND_ADMIN_SESSION = {
  employeeId: 'admin-loc-1',
  role: 'admin',
  locationId: 'loc-1',
  permissions: [],
}

function jsonReq(
  url: string,
  method = 'GET',
  body?: unknown,
): Request {
  return new Request(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // privzeto: rate limit dovoli, skrivnost konfigurirana, lokacija obstaja
  mocks.rateLimitCheck.mockResolvedValue({ allowed: true, remaining: 19 })
  mocks.secretConfigured.mockReturnValue(true)
  mocks.locationFindFirst.mockResolvedValue(LOCATION_FIXTURE)
  // R100: atomarni counter guard privzeto "zmaga" (count 1)
  mocks.webauthnUpdateMany.mockResolvedValue({ count: 1 })
  mocks.joinTransports.mockImplementation(
    (t: readonly string[] | null | undefined) => (t && t.length ? t.join(',') : null),
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ══════════════════════════════════════════════════════════════════
// A. Signed challenge — REALNI HMAC crypto (importActual zaobi mock)
// ══════════════════════════════════════════════════════════════════
describe('R97-a A: signed challenge (realni HMAC)', () => {
  it('mint → verify true ( isti locationId, veljaven TTL)', async () => {
    const mod = await vi.importActual<typeof import('@/lib/webauthn/device-attestation')>(
      '@/lib/webauthn/device-attestation',
    )
    const token = mod.mintDeviceChallenge('loc-1')
    expect(mod.verifyDeviceChallenge(token, 'loc-1')).toBe(true)
  })

  it('token je ČIST base64url (brez "." — WebAuthn byte round-trip zahteva)', async () => {
    const mod = await vi.importActual<typeof import('@/lib/webauthn/device-attestation')>(
      '@/lib/webauthn/device-attestation',
    )
    const token = mod.mintDeviceChallenge('loc-1')
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    // payload razČlenljiv: lokacija vezana, expiry v prihodnosti
    const bytes = Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    const payload = JSON.parse(bytes.subarray(0, bytes.length - 32).toString('utf8')) as {
      v: number; e: number; l: string
    }
    expect(payload.v).toBe(1)
    expect(payload.l).toBe('loc-1')
    expect(payload.e).toBeGreaterThan(Date.now())
  })

  it('TTL = 120 s: verify pade na +121 s, pre\u017eivi na +60 s', async () => {
    const mod = await vi.importActual<typeof import('@/lib/webauthn/device-attestation')>(
      '@/lib/webauthn/device-attestation',
    )
    expect(mod.DEVICE_CHALLENGE_TTL_MS).toBe(120 * 1000)
    const token = mod.mintDeviceChallenge('loc-1', 1_000_000)
    expect(mod.verifyDeviceChallenge(token, 'loc-1', 1_000_000 + 60_000)).toBe(true)
    expect(mod.verifyDeviceChallenge(token, 'loc-1', 1_000_000 + 121_000)).toBe(false)
  })

  it('tuja lokacija → false (challenge vezan na lokacijo v payload-u)', async () => {
    const mod = await vi.importActual<typeof import('@/lib/webauthn/device-attestation')>(
      '@/lib/webauthn/device-attestation',
    )
    const token = mod.mintDeviceChallenge('loc-1')
    expect(mod.verifyDeviceChallenge(token, 'loc-2')).toBe(false)
  })

  it.each([
    ['tamperiran MAC', (t: string) => t.slice(0, -2) + (t.endsWith('AA') ? 'BB' : 'AA')],
    ['garbage token', () => 'nima!!podpisa'],
    ['prazen token', () => ''],
  ])('%s → false (brez throw-a)', async (_label, mutate) => {
    const mod = await vi.importActual<typeof import('@/lib/webauthn/device-attestation')>(
      '@/lib/webauthn/device-attestation',
    )
    const token = mod.mintDeviceChallenge('loc-1')
    expect(mod.verifyDeviceChallenge(mutate(token), 'loc-1')).toBe(false)
  })

  it('produkcija brez skrivnosti → fail-closed: secretConfigured false + verify false', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    vi.stubEnv('ENCRYPTION_KEY', '')
    vi.stubEnv('ORDERING_TOKEN_SECRET', '')
    const mod = await vi.importActual<typeof import('@/lib/webauthn/device-attestation')>(
      '@/lib/webauthn/device-attestation',
    )
    // setup.ts nastavi ENCRYPTION_KEY globato — stubEnv('') je falsy → veriga pade na null
    expect(mod.isDeviceChallengeSecretConfigured()).toBe(false)
    // mint je v produkciji brez skrivnosti THROW (fail-closed) — hkratna asercija
    // throw-a (ruto ovije 503 prek isDeviceChallengeSecretConfigured) in verify-false.
    expect(() => mod.mintDeviceChallenge('loc-1')).toThrow()
    // verify je v produkciji brez skrivnosti Vedno false (notranji try/catch —
    // fail-closed, ni oraklja): tokena, ki ga ni mogoče podpisati, ne more potrditi.
    expect(mod.verifyDeviceChallenge('dGVzdC10b2tlbg', 'loc-1')).toBe(false)
  })

  it('dev/test brez skrivnosti → fallback dovoljen (secretConfigured true)', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', '')
    vi.stubEnv('ENCRYPTION_KEY', '')
    vi.stubEnv('ORDERING_TOKEN_SECRET', '')
    const mod = await vi.importActual<typeof import('@/lib/webauthn/device-attestation')>(
      '@/lib/webauthn/device-attestation',
    )
    expect(mod.isDeviceChallengeSecretConfigured()).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════
// B. GET /api/auth/webauthn/options (javna površina)
// ══════════════════════════════════════════════════════════════════
describe('R97-a B: GET /api/auth/webauthn/options', () => {
  it.each([
    ['manjkajoČ locationId', 'http://localhost:3000/api/auth/webauthn/options'],
    ['slab format (pika)', 'http://localhost:3000/api/auth/webauthn/options?locationId=loc.1'],
    ['prekratek id', 'http://localhost:3000/api/auth/webauthn/options?locationId=ab'],
  ])('%s → unificiran 404 + ZERO db klicev', async (_label, url) => {
    const res = await optionsGET(new Request(url))

    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body).toEqual({ error: 'Lokacija ni najden' })
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.webauthnFindMany).not.toHaveBeenCalled()
  })

  it('neznana / neaktivna lokacija → isti 404 (findFirst null) + findMany NEZAZENAN', async () => {
    mocks.locationFindFirst.mockResolvedValue(null)

    const res = await optionsGET(
      new Request('http://localhost:3000/api/auth/webauthn/options?locationId=loc-404'),
    )

    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    expect(mocks.locationFindFirst).toHaveBeenCalledWith({
      where: { id: 'loc-404', isActive: true },
      select: { id: true, name: true },
    })
    expect(mocks.webauthnFindMany).not.toHaveBeenCalled()
  })

  it('uspeh → { location, challenge, rpID, registration, authentication } z ISTIM challenge-om', async () => {
    mocks.webauthnFindMany.mockResolvedValue([
      { credentialId: 'cred-9', transports: 'internal' },
    ])
    mocks.buildRegistrationOptions.mockResolvedValue({
      challenge: 'signed-token-1',
      rp: { id: 'localhost', name: 'RestaurantOS' },
      user: { id: 'bG9jLTE', name: 'device:loc-1' },
    })
    mocks.buildAuthenticationOptions.mockResolvedValue({
      challenge: 'signed-token-1',
      rpId: 'localhost',
    })

    const res = await optionsGET(
      new Request('http://localhost:3000/api/auth/webauthn/options?locationId=loc-1'),
    )

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.location).toEqual({ id: 'loc-1', name: 'Test Lokacija' })
    expect(body.challenge).toBe('signed-token-1')
    expect(body.rpID).toBe('localhost')
    expect((body.registration as Record<string, unknown>).challenge).toBe('signed-token-1')
    expect((body.authentication as Record<string, unknown>).challenge).toBe('signed-token-1')
    expect(res.headers.get('Cache-Control')).toBe('no-store')

    // options graditelji dobijo obstojeČe poverilnice (excludeCredentials vir)
    expect(mocks.buildRegistrationOptions).toHaveBeenCalledWith(
      'loc-1',
      'Test Lokacija',
      [{ credentialId: 'cred-9', transports: 'internal' }],
    )
    expect(mocks.webauthnFindMany).toHaveBeenCalledWith({
      where: { locationId: 'loc-1' },
      select: { credentialId: true, transports: true },
    })

    // rate limit NAJVIŠJI točki — PRED lokacijsko poizvedbo (R90 canon)
    expect(mocks.rateLimitCheck.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.locationFindFirst.mock.invocationCallOrder[0])
  })

  it('rate limit blocked → 429 kanon glave + fiksni store key + REALNI GENERAL_PUBLIC_LIMIT + zero db', async () => {
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false })

    const res = await optionsGET(
      new Request('http://localhost:3000/api/auth/webauthn/options?locationId=loc-1'),
    )

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(mocks.rateLimitCheck).toHaveBeenCalledWith(
      'auth-webauthn-options',
      '203.0.113.7',
      expect.objectContaining({ maxRequests: 20, windowMs: 60000 }),
    )
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
  })

  it('produkcija brez challenge skrivnosti → 503 fail-closed + zero db', async () => {
    mocks.secretConfigured.mockReturnValue(false)

    const res = await optionsGET(
      new Request('http://localhost:3000/api/auth/webauthn/options?locationId=loc-1'),
    )

    expect(res.status).toBe(503)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.buildRegistrationOptions).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// C. POST /api/auth/webauthn/verify (javna assertion verifikacija)
// ══════════════════════════════════════════════════════════════════
describe('R97-a C: POST /api/auth/webauthn/verify', () => {
  const URL = 'http://localhost:3000/api/auth/webauthn/verify'

  it('rate limit blocked → 429 + ZERO parsanja/verifikacije (throttle pred vsem)', async () => {
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false })

    const res = await verifyPOST(jsonReq(URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }))

    expect(res.status).toBe(429)
    expect(mocks.extractChallenge).not.toHaveBeenCalled()
    expect(mocks.verifyChallenge).not.toHaveBeenCalled()
    expect(mocks.webauthnFindUnique).not.toHaveBeenCalled()
  })

  it('malformed body (brez assertion) → unificiran 400 + ZERO db', async () => {
    const res = await verifyPOST(jsonReq(URL, 'POST', { locationId: 'loc-1' }))

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe(VERIFY_FAILED_MESSAGE)
    expect(mocks.webauthnFindUnique).not.toHaveBeenCalled()
  })

  it('neveljaven signed challenge → 401 + ZERO db klicev (challenge PRED db)', async () => {
    mocks.extractChallenge.mockReturnValue('token-123')
    mocks.verifyChallenge.mockReturnValue(false)

    const res = await verifyPOST(jsonReq(URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }))

    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe(VERIFY_FAILED_MESSAGE)
    expect(mocks.verifyChallenge).toHaveBeenCalledWith('token-123', 'loc-1')
    expect(mocks.webauthnFindUnique).not.toHaveBeenCalled()
  })

  it('neznana poverilnica → ISTI 401 (ni obstoja-oraklja) + update NEZAZENAN', async () => {
    mocks.extractChallenge.mockReturnValue('token-123')
    mocks.verifyChallenge.mockReturnValue(true)
    mocks.webauthnFindUnique.mockResolvedValue(null)

    const res = await verifyPOST(jsonReq(URL, 'POST', { assertion: assertionFixture({ id: 'cred-ghost' }), locationId: 'loc-1' }))

    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe(VERIFY_FAILED_MESSAGE)
    expect(mocks.webauthnUpdate).not.toHaveBeenCalled()
  })

  it('cross-location spoof: poverilnica lokacije B proti challenge-u lokacije A → 401 + update NEZAZENAN', async () => {
    mocks.extractChallenge.mockReturnValue('token-123')
    mocks.verifyChallenge.mockReturnValue(true)
    mocks.webauthnFindUnique.mockResolvedValue(credentialRow({ locationId: 'loc-2', location: { id: 'loc-2', name: 'Druga' } }))

    const res = await verifyPOST(jsonReq(URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }))

    expect(res.status).toBe(401)
    expect(mocks.verifyAssertion).not.toHaveBeenCalled()
    expect(mocks.webauthnUpdate).not.toHaveBeenCalled()
  })

  it('neveljaven podpis (verifyDeviceAssertion false) → 401 + update NEZAZENAN', async () => {
    mocks.extractChallenge.mockReturnValue('token-123')
    mocks.verifyChallenge.mockReturnValue(true)
    mocks.webauthnFindUnique.mockResolvedValue(credentialRow())
    mocks.verifyAssertion.mockResolvedValue({ verified: false })

    const res = await verifyPOST(jsonReq(URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }))

    expect(res.status).toBe(401)
    expect(mocks.webauthnUpdate).not.toHaveBeenCalled()
    expect(mocks.webauthnUpdateMany).not.toHaveBeenCalled()
  })

  it('REPLAY: newCounter == stored counter → 401 + update NEZAZENAN (strictly-greater)', async () => {
    mocks.extractChallenge.mockReturnValue('token-123')
    mocks.verifyChallenge.mockReturnValue(true)
    mocks.webauthnFindUnique.mockResolvedValue(credentialRow({ counter: 4 }))
    mocks.verifyAssertion.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 4 } })

    const res = await verifyPOST(jsonReq(URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }))

    expect(res.status).toBe(401)
    expect(mocks.webauthnUpdate).not.toHaveBeenCalled()
    expect(mocks.webauthnUpdateMany).not.toHaveBeenCalled()
  })

  it('counter regresija (klon): newCounter < stored → 401 + update NEZAZENAN', async () => {
    mocks.extractChallenge.mockReturnValue('token-123')
    mocks.verifyChallenge.mockReturnValue(true)
    mocks.webauthnFindUnique.mockResolvedValue(credentialRow({ counter: 4 }))
    mocks.verifyAssertion.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 3 } })

    const res = await verifyPOST(jsonReq(URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }))

    expect(res.status).toBe(401)
    expect(mocks.webauthnUpdate).not.toHaveBeenCalled()
    expect(mocks.webauthnUpdateMany).not.toHaveBeenCalled()
  })

  it('uspeh → 200 { location: { id, name } } + ATOMARNI counter increment (updateMany lt) + lastUsedAt (FIDO2 §6.1, R100)', async () => {
    mocks.extractChallenge.mockReturnValue('token-123')
    mocks.verifyChallenge.mockReturnValue(true)
    mocks.webauthnFindUnique.mockResolvedValue(credentialRow({ counter: 4 }))
    mocks.verifyAssertion.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 5 } })

    const res = await verifyPOST(jsonReq(URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }))

    expect(res.status).toBe(200)
    const body = await res.json() as { location: { id: string; name: string } }
    expect(body.location).toEqual({ id: 'loc-1', name: 'Test Lokacija' })

    // R100: ATOMARNI check-and-set — counter: { lt: newCounter } v where
    // (replay, ki zmaga TOCTOU race na branju, izgubi na pisanju)
    expect(mocks.webauthnUpdateMany).toHaveBeenCalledTimes(1)
    expect(mocks.webauthnUpdateMany).toHaveBeenCalledWith({
      where: { credentialId: 'cred-1', counter: { lt: 5 } },
      data: expect.objectContaining({ counter: 5 }),
    })
    expect(mocks.webauthnUpdate).not.toHaveBeenCalled()
    const updateArg = mocks.webauthnUpdateMany.mock.calls[0][0] as { data: { lastUsedAt: unknown } }
    expect(updateArg.data.lastUsedAt).toBeInstanceOf(Date)
  })

  it('authenticator brez counterja (0 → 0) → uspeh (FIDO2 spec izjema)', async () => {
    mocks.extractChallenge.mockReturnValue('token-123')
    mocks.verifyChallenge.mockReturnValue(true)
    mocks.webauthnFindUnique.mockResolvedValue(credentialRow({ counter: 0 }))
    mocks.verifyAssertion.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 0 } })

    const res = await verifyPOST(jsonReq(URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }))

    expect(res.status).toBe(200)
    expect(mocks.webauthnUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.webauthnUpdateMany).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// D. POST /api/settings/webauthn/register (ADMIN)
// ══════════════════════════════════════════════════════════════════
describe('R97-a D: POST /api/settings/webauthn/register', () => {
  const URL = 'http://localhost:3000/api/settings/webauthn/register'

  function registerBody(overrides: Record<string, unknown> = {}) {
    return {
      locationId: 'loc-1',
      deviceName: '  Kiosk 1  ',
      credential: {
        id: 'cred-9',
        response: { clientDataJSON: CLIENT_DATA_JSON, attestationObject: 'AAAA' },
      },
      ...overrides,
    }
  }

  function registrationInfoFixture() {
    return {
      verified: true,
      registrationInfo: {
        credential: {
          id: 'cred-9',
          publicKey: new Uint8Array([1, 2, 3]), // base64url → 'AQID' (realni encoder)
          counter: 0,
          transports: ['internal', 'hybrid'],
        },
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
      },
    }
  }

  beforeEach(() => {
    mocks.requireAuth.mockResolvedValue({ session: SUPER_ADMIN_SESSION, error: null })
    mocks.verifyChallenge.mockReturnValue(true)
    mocks.extractChallenge.mockReturnValue('token-123')
    mocks.verifyRegistration.mockResolvedValue(registrationInfoFixture())
    mocks.webauthnCreate.mockResolvedValue({
      id: 'wa-1',
      deviceName: 'Kiosk 1',
      transports: 'internal,hybrid',
      deviceType: 'singleDevice',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })
  })

  it('admin guard: requireAuth error → error return (401) + ZERO db + ZERO verifikacije', async () => {
    const errRes = new Response(JSON.stringify({ error: 'Avtentikacija je obvezna. Pošljite Authorization: Bearer <token>' }), { status: 401 })
    mocks.requireAuth.mockResolvedValue({ session: null, error: errRes })

    const res = await registerPOST(jsonReq(URL, 'POST', registerBody()))

    expect(res.status).toBe(401)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.webauthnCreate).not.toHaveBeenCalled()
    expect(mocks.verifyChallenge).not.toHaveBeenCalled()
  })

  it('lokacijsko vezan admin + TUJ body locationId → unificiran 404 + ZERO db (strict scope guard)', async () => {
    mocks.requireAuth.mockResolvedValue({ session: BOUND_ADMIN_SESSION, error: null })

    const res = await registerPOST(jsonReq(URL, 'POST', registerBody({ locationId: 'loc-9' })))

    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body).toEqual({ error: 'Lokacija ni najden' })
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.webauthnCreate).not.toHaveBeenCalled()
    // pisna operacija se ne "tiho preusmeri" na lastno lokacijo
    expect(mocks.verifyChallenge).not.toHaveBeenCalled()
  })

  it('super-admin + neznana lokacija → unificiran 404 + create NEZAZENAN', async () => {
    mocks.locationFindFirst.mockResolvedValue(null)

    const res = await registerPOST(jsonReq(URL, 'POST', registerBody()))

    expect(res.status).toBe(404)
    expect(mocks.webauthnCreate).not.toHaveBeenCalled()
  })

  it('super-admin brez body locationId → 400 (resolveWriteLocationId, MODEL A izrecen locationId) + zero db', async () => {
    const res = await registerPOST(jsonReq(URL, 'POST', registerBody({ locationId: undefined })))

    expect(res.status).toBe(400)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
  })

  it('neveljaven signed challenge → unificiran 400 + create NEZAZENAN', async () => {
    mocks.verifyChallenge.mockReturnValue(false)

    const res = await registerPOST(jsonReq(URL, 'POST', registerBody()))

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe(REGISTER_FAILED_MESSAGE)
    expect(mocks.webauthnCreate).not.toHaveBeenCalled()
  })

  it('neveljaven attestation (verifyRegistration false) → unificiran 400 + create NEZAZENAN', async () => {
    mocks.verifyRegistration.mockResolvedValue({ verified: false })

    const res = await registerPOST(jsonReq(URL, 'POST', registerBody()))

    expect(res.status).toBe(400)
    expect(mocks.webauthnCreate).not.toHaveBeenCalled()
  })

  it('uspeh → 201, create z scope-resolved locationId + comma-joined transports + NIKOLI publicKey v odgovoru', async () => {
    const res = await registerPOST(jsonReq(URL, 'POST', registerBody()))

    expect(res.status).toBe(201)
    const body = await res.json() as { success: boolean; credential: Record<string, unknown>; location: { id: string; name: string } }
    expect(body.success).toBe(true)
    // Polna lokacijska oblika (mirror verify rute — { id, name } iz findFirst select).
    expect(body.location).toEqual({ id: 'loc-1', name: 'Test Lokacija' })
    expect(Object.keys(body.credential).sort()).toEqual([
      'createdAt', 'deviceName', 'deviceType', 'id', 'transports',
    ])
    expect(JSON.stringify(body)).not.toContain('publicKey')

    // data pin: base64urlEncode REALNI ([1,2,3] → 'AQID'), deviceName triman,
    // transports comma-joined (model konvencija, ne JSON-as-String)
    expect(mocks.webauthnCreate).toHaveBeenCalledWith({
      data: {
        credentialId: 'cred-9',
        publicKey: 'AQID',
        counter: 0,
        locationId: 'loc-1',
        deviceName: 'Kiosk 1',
        transports: 'internal,hybrid',
        deviceType: 'singleDevice',
      },
      select: { id: true, deviceName: true, transports: true, deviceType: true, createdAt: true },
    })
  })

  it('P2002 unique race (isti authenticator \u017ee registriran) → 409', async () => {
    mocks.webauthnCreate.mockRejectedValue(
      new Error('Unique constraint failed on the fields: (`credentialId`)'),
    )

    const res = await registerPOST(jsonReq(URL, 'POST', registerBody()))

    expect(res.status).toBe(409)
  })

  it('rate limit blocked → 429 + ZERO auth/db klicev', async () => {
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false })

    const res = await registerPOST(jsonReq(URL, 'POST', registerBody()))

    expect(res.status).toBe(429)
    expect(mocks.rateLimitCheck).toHaveBeenCalledWith(
      'settings-webauthn-register',
      '203.0.113.7',
      expect.objectContaining({ maxRequests: 120, windowMs: 60000 }),
    )
    expect(mocks.requireAuth).not.toHaveBeenCalled()
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// E. GET /api/settings/webauthn/credentials (ADMIN seznam)
// ══════════════════════════════════════════════════════════════════
describe('R97-a E: GET /api/settings/webauthn/credentials', () => {
  const URL = 'http://localhost:3000/api/settings/webauthn/credentials'

  beforeEach(() => {
    mocks.requireAuth.mockResolvedValue({ session: BOUND_ADMIN_SESSION, error: null })
    mocks.webauthnFindMany.mockResolvedValue([
      {
        id: 'wa-1',
        deviceName: 'Kiosk 1',
        transports: 'internal',
        deviceType: 'singleDevice',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        lastUsedAt: null,
      },
    ])
  })

  it('admin guard error → 401 + ZERO db', async () => {
    const errRes = new Response(JSON.stringify({ error: 'unauth' }), { status: 401 })
    mocks.requireAuth.mockResolvedValue({ session: null, error: errRes })

    const res = await credentialsGET(new Request(`${URL}?locationId=loc-1`))

    expect(res.status).toBe(401)
    expect(mocks.webauthnFindMany).not.toHaveBeenCalled()
  })

  it('super-admin brez ?locationId → 400 (MODEL A izrecen locationId) + ZERO db', async () => {
    mocks.requireAuth.mockResolvedValue({ session: SUPER_ADMIN_SESSION, error: null })

    const res = await credentialsGET(new Request(URL))

    expect(res.status).toBe(400)
    expect(mocks.webauthnFindMany).not.toHaveBeenCalled()
  })

  it('slab format locationId (super-admin) → unificiran 404 + ZERO db', async () => {
    mocks.requireAuth.mockResolvedValue({ session: SUPER_ADMIN_SESSION, error: null })

    const res = await credentialsGET(new Request(`${URL}?locationId=loc.1`))

    expect(res.status).toBe(404)
    expect(mocks.webauthnFindMany).not.toHaveBeenCalled()
  })

  it('lokacijsko vezan admin: where { locationId: seja } (query ignoriran) + select NIKOLI publicKey', async () => {
    // klijent poskuša ?locationId=loc-2 — regular/vezan admin vidi SAMO svojo
    const res = await credentialsGET(new Request(`${URL}?locationId=loc-2`))

    expect(res.status).toBe(200)
    const body = await res.json() as { credentials: Array<Record<string, unknown>> }
    expect(body.credentials).toHaveLength(1)
    expect(JSON.stringify(body)).not.toContain('publicKey')

    expect(mocks.webauthnFindMany).toHaveBeenCalledTimes(1)
    const findManyArg = mocks.webauthnFindMany.mock.calls[0][0] as {
      where: { locationId: string }
      select: Record<string, boolean>
    }
    expect(findManyArg.where).toEqual({ locationId: 'loc-1' })
    // select pin: publicKey NE obstaja v selectu (PII/ključ na viru)
    expect(Object.keys(findManyArg.select).sort()).toEqual([
      'createdAt', 'deviceName', 'deviceType', 'id', 'lastUsedAt', 'transports',
    ])
  })

  it('super-admin z izrecnim ?locationId → where { locationId: query }', async () => {
    mocks.requireAuth.mockResolvedValue({ session: SUPER_ADMIN_SESSION, error: null })

    await credentialsGET(new Request(`${URL}?locationId=loc-2`))

    expect(mocks.webauthnFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { locationId: 'loc-2' } }),
    )
  })
})

// ══════════════════════════════════════════════════════════════════
// F. DELETE /api/settings/webauthn/credentials/[id] (ADMIN)
// ══════════════════════════════════════════════════════════════════
describe('R97-a F: DELETE /api/settings/webauthn/credentials/[id]', () => {
  const URL = (id: string) => `http://localhost:3000/api/settings/webauthn/credentials/${id}`

  it('admin guard error → 401 + ZERO db', async () => {
    const errRes = new Response(JSON.stringify({ error: 'unauth' }), { status: 401 })
    mocks.requireAuth.mockResolvedValue({ session: null, error: errRes })

    const res = await credentialsDELETE(new Request(URL('cred-1'), { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'cred-1' }),
    })

    expect(res.status).toBe(401)
    expect(mocks.webauthnDeleteMany).not.toHaveBeenCalled()
  })

  it('lokacijsko vezan admin + TUJ id → deleteMany { id, locationId } count 0 → 404 (atomaren scoped delete)', async () => {
    mocks.requireAuth.mockResolvedValue({ session: BOUND_ADMIN_SESSION, error: null })
    mocks.webauthnDeleteMany.mockResolvedValue({ count: 0 })

    const res = await credentialsDELETE(new Request(URL('cred-foreign'), { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'cred-foreign' }),
    })

    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body).toEqual({ error: 'Poverilnica ni najden' })
    expect(mocks.webauthnDeleteMany).toHaveBeenCalledWith({
      where: { id: 'cred-foreign', locationId: 'loc-1' },
    })
  })

  it('ZERO ORACLE: tuj id in neobstoječi id → ISTI odgovor (isti 404 telesa)', async () => {
    mocks.requireAuth.mockResolvedValue({ session: BOUND_ADMIN_SESSION, error: null })
    mocks.webauthnDeleteMany.mockResolvedValue({ count: 0 })

    const foreign = await credentialsDELETE(new Request(URL('cred-tuj'), { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'cred-tuj' }),
    })
    const missing = await credentialsDELETE(new Request(URL('cred-ni-ga'), { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'cred-ni-ga' }),
    })

    expect(foreign.status).toBe(404)
    expect(missing.status).toBe(404)
    expect(await foreign.json()).toEqual(await missing.json())
  })

  it('super-admin: deleteMany brez lokacijskega filtra → count 1 → 200 { success: true }', async () => {
    mocks.requireAuth.mockResolvedValue({ session: SUPER_ADMIN_SESSION, error: null })
    mocks.webauthnDeleteMany.mockResolvedValue({ count: 1 })

    const res = await credentialsDELETE(new Request(URL('cred-1'), { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'cred-1' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean }
    expect(body.success).toBe(true)
    expect(mocks.webauthnDeleteMany).toHaveBeenCalledWith({ where: { id: 'cred-1' } })
    // rate limit NAJVIŠJI točki handlerja (pred auth in db)
    expect(mocks.rateLimitCheck.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.webauthnDeleteMany.mock.invocationCallOrder[0])
  })
})

// ══════════════════════════════════════════════════════════════════
// G. fs-guard — route vir pina kanon (r93/r95 hišni stil)
// ══════════════════════════════════════════════════════════════════
describe('R97-a G: fs-guard', () => {
  it('options route: rate limit na vrhu, fiksni key, direkt response import, unified 404', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/auth/webauthn/options/route.ts'), 'utf8')
    expect(src).toContain("export const dynamic = 'force-dynamic'")
    expect(src).toContain("checkRateLimitAsync('auth-webauthn-options'")
    expect(src).toContain("from '@/lib/rate-limit/response'")
    expect(src).toContain("notInScopeResponse('Lokacija')")
  })

  it('verify route: counter strictly-greater pin + ATOMARNI updateMany guard (R100) + unified sporoČilo + update šele za uspehom', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/auth/webauthn/verify/route.ts'), 'utf8')
    expect(src).toContain("checkRateLimitAsync('auth-webauthn-verify'")
    // replay guard: strictly greater (izjema 0→0)
    expect(src).toContain('newCounter <= credential.counter')
    expect(src).toContain("checkRateLimitAsync('auth-webauthn-verify'")
    // R100: atomarni check-and-set (TOCTOU fix) — updateMany z counter lt
    expect(src).toContain('counter: { lt: newCounter }')
    expect(src).toContain('webAuthnCredential.updateMany')
    // update/write SELE po vseh preverjanjih (invokacijski vrstni red v viru)
    const verifyIdx = src.indexOf('verifyDeviceAssertion')
    const updateIdx = src.indexOf('webAuthnCredential.updateMany')
    expect(verifyIdx).toBeGreaterThan(-1)
    expect(updateIdx).toBeGreaterThan(verifyIdx)
  })

  it('credentials list route: select vira NIKOLI ne vsebuje publicKey', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/settings/webauthn/credentials/route.ts'), 'utf8')
    // Komentarji SMEJO omenjati publicKey (dokumentacija PII politike) — PIN gre
    // na kodo: (a) nikoli 'publicKey: true' select vrstica; (b) findMany blok
    // (med 'const credentials' in 'orderBy') brez omembe polja.
    expect(src).not.toContain('publicKey: true')
    const blockStart = src.indexOf('const credentials')
    const blockEnd = src.indexOf('orderBy', blockStart)
    expect(blockStart).toBeGreaterThan(-1)
    expect(blockEnd).toBeGreaterThan(blockStart)
    expect(src.slice(blockStart, blockEnd)).not.toContain('publicKey')
    expect(src).toContain("checkRateLimitAsync('settings-webauthn-credentials'")
  })

  it('tenant-scope.ts ni spremenjen (FORBIDDEN file — fs-guard za parallelni rundi)', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/tenant-scope.ts'), 'utf8')
    expect(src).toContain('export function resolveTenantLocationIdOrThrow')
    expect(src).toContain('export function resolveWriteLocationId')
    expect(src).toContain('export function isWithinScope')
    expect(src).toContain('export function notInScopeResponse')
  })
})
