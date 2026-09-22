// ============================================
// R99-a — WEBAUTHN KILL SWITCH (WEBAUTHN_ENABLED) na device attestation rutah
// ============================================
// Matrika:
//   A. GET /api/auth/webauthn/options — gate OFF → 503 z FROZEN body
//      ('WebAuthn device attestation je onemogočen (503).'); VRSTNI RED
//      ohranjen: rate-limit ostane NAJPREJ (blocked → 429 TUDI ob OFF
//      gate-u), gate pa PRED secret gate-om (OFF → 503, secret check NI
//      več dosežen).
//   B. POST /api/auth/webauthn/verify — isti gate, UNIFICIRAN
//      VERIFY_FAILED_MESSAGE 503 body (ni oraklja — isti error telesa kot
//      vsi ostali verify neuspehi).
//   C. Gate ON → tok se nadaljuje po obstoječih R97 poteh (secret 503 z
//      STARIM body, unified 404, uspeh 200; verify 400/200) — kill switch
//      NE sme spremeniti vedenja, ko je flag vklopljen (produkcija HTTPS).
//
// Vzorec r97-webauthn-endpoints.test.ts (hišni stil): vi.hoisted + vi.mock
// tovarne, mockResolvedValue (NIKOLI .Once), zero-db asserti,
// invocationCallOrder.
//
// ⚠️ KANON (R97-FINAL): @simplewebauthn/server v14 ima module-scope side
// effect, ki CRASHA v unit-vm (vmThreads) poolu → vi.mock stub (realen modul
// ne vstopi v graf). '@/lib/webauthn' barrel pa ostane REALen:
// isWebAuthnEnable() je čista env funkcija (WEBAUTHN_ENABLED === 'true' ALI
// produkcija + HTTPS) — testira REALNI gate prek vi.stubEnv, ne mocka.
// vitest.config.ts env nastavi WEBAUTHN_ENABLED='true' kot unit-baseline;
// OFF primeri ga izrecno prekrijejo z vi.stubEnv('WEBAUTHN_ENABLED', 'false').
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  // db
  locationFindFirst: vi.fn(),
  webauthnFindMany: vi.fn(),
  webauthnFindUnique: vi.fn(),
  webauthnUpdate: vi.fn(),
  webauthnUpdateMany: vi.fn(), // R100: atomarni counter check-and-set
  // rate limit barrel (rute jemljejo iz barrela; response ostane realen)
  rateLimitCheck: vi.fn(),
  // device-attestation (challenge + @simplewebauthn wrappers)
  secretConfigured: vi.fn(),
  buildRegistrationOptions: vi.fn(),
  buildAuthenticationOptions: vi.fn(),
  extractChallenge: vi.fn(),
  verifyChallenge: vi.fn(),
  verifyAssertion: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    location: {
      findFirst: mocks.locationFindFirst,
    },
    webAuthnCredential: {
      findUnique: mocks.webauthnFindUnique,
      findMany: mocks.webauthnFindMany,
      update: mocks.webauthnUpdate,
      updateMany: mocks.webauthnUpdateMany,
    },
  },
}))

vi.mock('@/lib/rate-limit', async () => {
  const presets = await import('@/lib/rate-limit/presets')
  return {
    checkRateLimitAsync: mocks.rateLimitCheck,
    getClientIp: vi.fn(() => '203.0.113.7'),
    GENERAL_PUBLIC_LIMIT: presets.GENERAL_PUBLIC_LIMIT,
  }
})

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// vmThreads kanon: realen @simplewebauthn/server se NE sme naložiti (module-
// scope side effect crash). Rute ga niti ne uporabljajo direktno — samo tip.
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
  joinTransports: vi.fn(),
}))

// Importi PO mockih
import { GET as optionsGET } from '@/app/api/auth/webauthn/options/route'
import { POST as verifyPOST } from '@/app/api/auth/webauthn/verify/route'

const OPTIONS_GATE_BODY = 'WebAuthn device attestation je onemogočen (503).'
const VERIFY_FAILED_MESSAGE = 'WebAuthn verifikacija ni uspela.'
const OPTIONS_SECRET_BODY = 'WebAuthn device attestation ni konfiguriran (503).'

const LOCATION_FIXTURE = { id: 'loc-1', name: 'Test Lokacija' }

const OPTIONS_URL = 'http://localhost:3000/api/auth/webauthn/options?locationId=loc-1'
const VERIFY_URL = 'http://localhost:3000/api/auth/webauthn/verify'

const REGISTRATION_FIXTURE = {
  challenge: 'chal-1',
  rp: { id: 'localhost', name: 'RestaurantOS' },
  user: { id: 'loc-1', name: 'loc-1', displayName: 'Test Lokacija' },
}

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

function jsonReq(url: string, method = 'GET', body?: unknown): Request {
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
  mocks.buildRegistrationOptions.mockResolvedValue(REGISTRATION_FIXTURE)
  mocks.buildAuthenticationOptions.mockResolvedValue({ challenge: 'chal-1', allowCredentials: [] })
  // R100: atomarni counter guard privzeto "zmaga" (count 1)
  mocks.webauthnUpdateMany.mockResolvedValue({ count: 1 })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ══════════════════════════════════════════════════════════════════
// A. GET /api/auth/webauthn/options — kill switch OFF matrika
// ══════════════════════════════════════════════════════════════════
describe('R99-a A: options kill switch OFF (WEBAUTHN_ENABLED ≠ true)', () => {
  it.each([
    ['izrecno false', 'false'],
    ['prazen string', ''],
  ])('WEBAUTHN_ENABLED=%s → 503 FROZEN body + gate PRED secret checkom', async (_label, value) => {
    vi.stubEnv('WEBAUTHN_ENABLED', value)

    const res = await optionsGET(new Request(OPTIONS_URL))

    expect(res.status).toBe(503)
    const body = await res.json() as { error: string }
    expect(body).toEqual({ error: OPTIONS_GATE_BODY })
    // vrstni red: rate-limit je STEKEL (throttle NAJPREJ), secret gate pa NI
    // več dosežen (kill switch PRED njim — flag ne sme niti pomakniti skrivnosti)
    expect(mocks.rateLimitCheck).toHaveBeenCalledTimes(1)
    expect(mocks.secretConfigured).not.toHaveBeenCalled()
    // zero db, zero options gradnje
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.webauthnFindMany).not.toHaveBeenCalled()
    expect(mocks.buildRegistrationOptions).not.toHaveBeenCalled()
    expect(mocks.buildAuthenticationOptions).not.toHaveBeenCalled()
  })

  it('rate-limit blocked + gate OFF → 429 (throttle ostane PRED gate-om)', async () => {
    vi.stubEnv('WEBAUTHN_ENABLED', 'false')
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false, retryAfterMs: 60000 })

    const res = await optionsGET(new Request(OPTIONS_URL))

    expect(res.status).toBe(429)
    expect(mocks.secretConfigured).not.toHaveBeenCalled()
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// B. POST /api/auth/webauthn/verify — isti gate, UNIFICIRAN body
// ══════════════════════════════════════════════════════════════════
describe('R99-a B: verify kill switch OFF (WEBAUTHN_ENABLED ≠ true)', () => {
  it('gate OFF → 503 z UNIFICIRANIM VERIFY_FAILED_MESSAGE + zero parsanja', async () => {
    vi.stubEnv('WEBAUTHN_ENABLED', 'false')

    const res = await verifyPOST(
      jsonReq(VERIFY_URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }),
    )

    expect(res.status).toBe(503)
    const body = await res.json() as { error: string }
    // ni oraklja: isti error telesa kot vsi ostali verify neuspehi (400/401)
    expect(body).toEqual({ error: VERIFY_FAILED_MESSAGE })
    expect(mocks.rateLimitCheck).toHaveBeenCalledTimes(1)
    expect(mocks.secretConfigured).not.toHaveBeenCalled()
    expect(mocks.extractChallenge).not.toHaveBeenCalled()
    expect(mocks.verifyChallenge).not.toHaveBeenCalled()
    expect(mocks.webauthnFindUnique).not.toHaveBeenCalled()
  })

  it('rate-limit blocked + gate OFF → 429 (throttle ostane PRED gate-om)', async () => {
    vi.stubEnv('WEBAUTHN_ENABLED', 'false')
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false, retryAfterMs: 60000 })

    const res = await verifyPOST(
      jsonReq(VERIFY_URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }),
    )

    expect(res.status).toBe(429)
    expect(mocks.secretConfigured).not.toHaveBeenCalled()
    expect(mocks.extractChallenge).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// C. Gate ON → tok se nadaljuje (obstoječe R97 poti, kill switch = noop)
// ══════════════════════════════════════════════════════════════════
describe('R99-a C: gate ON (WEBAUTHN_ENABLED=true) → obstoječe poti', () => {
  it('options: secret NI konfiguriran → 503 z SECRET body (gate je PRED secret-om, ne okrog njega)', async () => {
    vi.stubEnv('WEBAUTHN_ENABLED', 'true')
    mocks.secretConfigured.mockReturnValue(false)

    const res = await optionsGET(new Request(OPTIONS_URL))

    expect(res.status).toBe(503)
    const body = await res.json() as { error: string }
    // STAR R97 fail-closed body — kill switch body se NE sme zamenjati s tem
    expect(body).toEqual({ error: OPTIONS_SECRET_BODY })
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
  })

  it('options: manjkajoč locationId → unificiran 404 (zero db) — R97 pot nedotaknjena', async () => {
    vi.stubEnv('WEBAUTHN_ENABLED', 'true')

    const res = await optionsGET(
      new Request('http://localhost:3000/api/auth/webauthn/options'),
    )

    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body).toEqual({ error: 'Lokacija ni najden' })
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
  })

  it('options: uspeh → 200 z registration+authentication in no-store (R97 kontrakt)', async () => {
    vi.stubEnv('WEBAUTHN_ENABLED', 'true')
    mocks.webauthnFindMany.mockResolvedValue([])

    const res = await optionsGET(new Request(OPTIONS_URL))

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.location).toEqual(LOCATION_FIXTURE)
    expect(body.challenge).toBe('chal-1')
    expect(body.rpID).toBe('localhost')
    expect(body.registration).toEqual(REGISTRATION_FIXTURE)
    expect(body.authentication).toEqual({ challenge: 'chal-1', allowCredentials: [] })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('verify: malformed body → 400 VERIFY_FAILED_MESSAGE (R97 zero-oracle pot)', async () => {
    vi.stubEnv('WEBAUTHN_ENABLED', 'true')

    const res = await verifyPOST(jsonReq(VERIFY_URL, 'POST', { locationId: 'loc-1' }))

    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body).toEqual({ error: VERIFY_FAILED_MESSAGE })
    expect(mocks.extractChallenge).not.toHaveBeenCalled()
    expect(mocks.webauthnFindUnique).not.toHaveBeenCalled()
  })

  it('verify: uspeh → 200 { location } + counter increment (R97 kontrakt)', async () => {
    vi.stubEnv('WEBAUTHN_ENABLED', 'true')
    mocks.extractChallenge.mockReturnValue('token-123')
    mocks.verifyChallenge.mockReturnValue(true)
    mocks.webauthnFindUnique.mockResolvedValue(credentialRow())
    mocks.verifyAssertion.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 5 },
    })

    const res = await verifyPOST(
      jsonReq(VERIFY_URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }),
    )

    expect(res.status).toBe(200)
    const body = await res.json() as { location: { id: string; name: string } }
    expect(body.location).toEqual({ id: 'loc-1', name: 'Test Lokacija' })
    // šele za uspehom: ATOMARNI counter increment + lastUsedAt (FIDO2 §6.1;
    // R100 updateMany check-and-set)
    expect(mocks.webauthnUpdateMany).toHaveBeenCalledWith({
      where: { credentialId: 'cred-1', counter: { lt: 5 } },
      data: { counter: 5, lastUsedAt: expect.any(Date) },
    })
  })
})
