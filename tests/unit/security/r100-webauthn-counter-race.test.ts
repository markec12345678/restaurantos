// ============================================
// R100 — WEBAUTHN ATOMARNI COUNTER REPLAY GUARD (TOCTOU fix)
// ============================================
// Kontekst: R97 verify ruta je counter povečala z read(2) → verify(4) →
// update(6) brez pogoja — klasičen check-then-act race. Dva SOČASNA verify
// klica bi oba prebrala stari counter iz baze, tako da bi replay-ani
// assertion (isti podpis, iste ceremony) sprejel TUDI drugi klic. Napadalec
// z ukradenim assertion response-om ima 120 s TTL okno, v katerem lahko
// požre vzporedne poizvedbe in pregazi replay zaščito.
//
// FIX (R100): write korak je ATOMAREN check-and-set — updateMany z
// where: { credentialId, counter: { lt: newCounter } }. Prisotnost vrstice
// z NIŽJIM counterjem je hkrati pogoj in zapis (ena DB operacija):
//   - replay po prvoupravičenem klicu najde že povišan counter → count 0
//     → unificiran 401;
//   - dva GENUINA assertion-a (dve ločeni ceremony, counters 5 in 6) pa
//     obe uspešni — guard zavrne SAMO vrednosti ≤ žive (4<5 ✓, 5<6 ✓);
//   - FIDO2 spec izjema 0→0 (authenticator brez signature counterja) gre
//     prek navadnega update (samo lastUsedAt) — 0<0 nikoli ne ujame, replay
//     zaščito nosi izključno 120 s TTL (kot doslej).
//
// Pokritost (logika, ne omrežje):
//   A. TOCTOU race: updateMany { count: 0 } → 401 unificiran body + plain
//      update NIKOLI (ni dvojnega zapisa).
//   B. Atomarni kontrakt: uspeh → updateMany byte-točen where (credentialId
//      + counter lt) + data (counter + lastUsedAt Date); zaporedje dveh
//      genuinih assertionov (5 nato 6) oba uspešna.
//   C. 0→0 izjema: plain update z ISKLJUČNO lastUsedAt (brez counter
//      zapisa), updateMany NIKOLI.
//   D. fs-guard: route vir pina atomarni guard + pre-check kanon.
//   E. Multi-key fan-out (R99-FINAL ostanka): lokacija z VEČ poverilnicami
//      → options endpoint podaja VSE credentialId-je v excludeCredentials
//      (registration) IN allowCredentials (authentication).
//   F. Mid-flight brisanje: poverilnica izbrisana MED options in verify →
//      findUnique null → ISTI unificiran 401 (zero-oracle temporalna vrzel
//      = neznana poverilnica), ZERO pisnih operacij.
//
// Vzorec (r99-webauthn-gate): vi.hoisted + vi.mock tovarne, mockResolvedValue
// (NIKOLI .Once), zero-klic asserti. REALNI: rateLimitedResponse (direkten
// import), parseJsonBody (realen Request parsing), tenant-scope (db pade na
// mockan '@/lib/db'). Kill switch ON prek vitest.config.ts env baseline.
// vmThreads kanon: @simplewebauthn/server NE vstopi realno v graf (stub).
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const mocks = vi.hoisted(() => ({
  // db
  locationFindFirst: vi.fn(),
  webauthnFindMany: vi.fn(),
  webauthnFindUnique: vi.fn(),
  webauthnUpdate: vi.fn(),
  webauthnUpdateMany: vi.fn(),
  // rate limit barrel
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

const VERIFY_FAILED_MESSAGE = 'WebAuthn verifikacija ni uspela.'
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

function jsonReq(url: string, method = 'GET', body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

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

/** Verify uspeh — stubi vse plasti do write koraka. */
function stubVerifySuccess(storedCounter: number, newCounter: number) {
  mocks.extractChallenge.mockReturnValue('token-123')
  mocks.verifyChallenge.mockReturnValue(true)
  mocks.webauthnFindUnique.mockResolvedValue(credentialRow({ counter: storedCounter }))
  mocks.verifyAssertion.mockResolvedValue({
    verified: true,
    authenticationInfo: { newCounter },
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
  mocks.webauthnUpdateMany.mockResolvedValue({ count: 1 })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ══════════════════════════════════════════════════════════════════
// A. TOCTOU race — updateMany count 0 = replay/klon je izgubil dirko
// ══════════════════════════════════════════════════════════════════
describe('R100 A: TOCTOU race — atomarni check-and-set izgubljen', () => {
  it('updateMany { count: 0 } → 401 unificiran body + plain update NIKOLI (ni dvojnega zapisa)', async () => {
    // "RACE": pre-check je šel skozi (stali branje counter=4, assertion 5),
    // a med crypto verifikacijo je drug klic ŽE povišal counter na 5 →
    // where counter lt 5 ne ujame ničesar → count 0.
    stubVerifySuccess(4, 5)
    mocks.webauthnUpdateMany.mockResolvedValue({ count: 0 })

    const res = await verifyPOST(
      jsonReq(VERIFY_URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }),
    )

    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body).toEqual({ error: VERIFY_FAILED_MESSAGE })
    // atomarni guard je EDINI pisec — navaden update NIKOLI v tej veji
    expect(mocks.webauthnUpdate).not.toHaveBeenCalled()
  })

  it('count 0 odgovor NIKOLI ne vsebuje location podanka (ni delne oddaje seje)', async () => {
    stubVerifySuccess(4, 5)
    mocks.webauthnUpdateMany.mockResolvedValue({ count: 0 })

    const res = await verifyPOST(
      jsonReq(VERIFY_URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }),
    )

    const bodyText = JSON.stringify(await res.json())
    expect(bodyText).not.toContain('location')
  })
})

// ══════════════════════════════════════════════════════════════════
// B. Atomarni kontrakt — byte-točen where + data, genuina zaporedja
// ══════════════════════════════════════════════════════════════════
describe('R100 B: atomarni kontrakt (check-and-set oblika)', () => {
  it('uspeh → updateMany where { credentialId, counter: { lt: newCounter } } + data { counter, lastUsedAt }', async () => {
    stubVerifySuccess(4, 5)

    const res = await verifyPOST(
      jsonReq(VERIFY_URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }),
    )

    expect(res.status).toBe(200)
    expect(mocks.webauthnUpdateMany).toHaveBeenCalledTimes(1)
    expect(mocks.webauthnUpdateMany).toHaveBeenCalledWith({
      where: { credentialId: 'cred-1', counter: { lt: 5 } },
      data: { counter: 5, lastUsedAt: expect.any(Date) },
    })
    expect(mocks.webauthnUpdate).not.toHaveBeenCalled()
  })

  it('dva GENUINA assertion-a (counters 5, 6) — where obliki 4<5 in 5<6 (guard zavrne SAMO ≤ žive)', async () => {
    stubVerifySuccess(4, 5)
    const res1 = await verifyPOST(
      jsonReq(VERIFY_URL, 'POST', { assertion: assertionFixture({ id: 'cred-1' }), locationId: 'loc-1' }),
    )
    expect(res1.status).toBe(200)

    // druga ceremony: stali counter je sedaj 5, nov assertion 6
    stubVerifySuccess(5, 6)
    const res2 = await verifyPOST(
      jsonReq(VERIFY_URL, 'POST', { assertion: assertionFixture({ id: 'cred-1' }), locationId: 'loc-1' }),
    )
    expect(res2.status).toBe(200)

    // prvi klic: 4 < 5; drugi: 5 < 6 — oba where-ja dovoljujeta napredek
    const wheres = mocks.webauthnUpdateMany.mock.calls.map(
      (c) => (c[0] as { where: { counter: { lt: number } } }).where.counter.lt,
    )
    expect(wheres).toEqual([5, 6])
  })
})

// ══════════════════════════════════════════════════════════════════
// C. FIDO2 spec izjema 0→0 — plain update, ISKLJUČNO lastUsedAt
// ══════════════════════════════════════════════════════════════════
describe('R100 C: authenticator brez counterja (0 → 0)', () => {
  it('0→0 → plain update z ISKLJUČNO lastUsedAt (brez counter zapisa) + updateMany NIKOLI', async () => {
    stubVerifySuccess(0, 0)

    const res = await verifyPOST(
      jsonReq(VERIFY_URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }),
    )

    expect(res.status).toBe(200)
    expect(mocks.webauthnUpdate).toHaveBeenCalledTimes(1)
    const arg = mocks.webauthnUpdate.mock.calls[0][0] as {
      where: { credentialId: string }
      data: Record<string, unknown>
    }
    expect(arg.where).toEqual({ credentialId: 'cred-1' })
    // counter se NE zapiše (0→0 je spec izjema; replay nosi 120 s TTL)
    expect('counter' in arg.data).toBe(false)
    expect(arg.data.lastUsedAt).toBeInstanceOf(Date)
    expect(mocks.webauthnUpdateMany).not.toHaveBeenCalled()
  })

  it('0 → 5 (authenticator brez counterja PRVIČ poišče podpisni) → ATOMARNA pot (counters zrastejo)', async () => {
    // shranjen 0, assertion nosi 5 — counterSupported (ni 0→0) → atomarni guard
    stubVerifySuccess(0, 5)

    const res = await verifyPOST(
      jsonReq(VERIFY_URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }),
    )

    expect(res.status).toBe(200)
    expect(mocks.webauthnUpdateMany).toHaveBeenCalledWith({
      where: { credentialId: 'cred-1', counter: { lt: 5 } },
      data: { counter: 5, lastUsedAt: expect.any(Date) },
    })
    expect(mocks.webauthnUpdate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// D. fs-guard — route vir pina atomarni guard kanon
// ══════════════════════════════════════════════════════════════════
describe('R100 D: fs-guard — atomarni counter guard v viru', () => {
  it('verify route: pre-check kanon (strictly-greater) + atomarni updateMany lt + race reject', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/auth/webauthn/verify/route.ts'), 'utf8')
    // fast-fail pre-check ob branju (stara kanon — intact)
    expect(src).toContain('newCounter <= credential.counter')
    // atomarni check-and-set (R100 fix)
    expect(src).toContain('counter: { lt: newCounter }')
    expect(src).toContain('webAuthnCredential.updateMany')
    expect(src).toContain('updated.count === 0')
    // 0→0 izjema: navaden update z lastUsedAt
    expect(src).toContain('lastUsedAt: new Date()')
  })
})

// ══════════════════════════════════════════════════════════════════
// E. Multi-key fan-out (R99-FINAL ostanka) — več ključev na lokaciji
// ══════════════════════════════════════════════════════════════════
describe('R100 E: multi-key options fan-out', () => {
  it('lokacija z 2 poverilnicama → VSE credentialId-je v options (exclude + allow)', async () => {
    mocks.webauthnFindMany.mockResolvedValue([
      { credentialId: 'cred-a', transports: 'internal' },
      { credentialId: 'cred-b', transports: 'hybrid' },
    ])

    const res = await optionsGET(new Request(OPTIONS_URL))

    expect(res.status).toBe(200)
    expect(mocks.locationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'loc-1', isActive: true } }),
    )
    // registration veja: VSA poverilnica v excludeCredentials
    expect(mocks.buildRegistrationOptions).toHaveBeenCalledWith(
      'loc-1',
      'Test Lokacija',
      expect.arrayContaining([
        expect.objectContaining({ credentialId: 'cred-a' }),
        expect.objectContaining({ credentialId: 'cred-b' }),
      ]),
    )
    // authentication veja: ISTA množica v allowCredentials
    expect(mocks.buildAuthenticationOptions).toHaveBeenCalledWith(
      'loc-1',
      expect.arrayContaining([
        expect.objectContaining({ credentialId: 'cred-a' }),
        expect.objectContaining({ credentialId: 'cred-b' }),
      ]),
    )
    const existingArg = mocks.webauthnFindMany.mock.calls[0][0] as {
      where: { locationId: string }
      select: Record<string, boolean>
    }
    expect(existingArg.where).toEqual({ locationId: 'loc-1' })
    // select NIKOLI publicKey (javen credentialId je OK, ključ ostaje strežniški)
    expect('publicKey' in existingArg.select).toBe(false)
  })

  it('verifikacija z DRUGIM ključem lokacije (multi-key) — findUnique per credentialId', async () => {
    // drugi ključ ima svoj neodvisen counter (9 → 10)
    stubVerifySuccess(9, 10)
    mocks.webauthnFindUnique.mockResolvedValue(
      credentialRow({ credentialId: 'cred-b', counter: 9 }),
    )

    const res = await verifyPOST(
      jsonReq(VERIFY_URL, 'POST', { assertion: assertionFixture({ id: 'cred-b' }), locationId: 'loc-1' }),
    )

    expect(res.status).toBe(200)
    // lookup po TAKEM credentialId, ki je poslal assertion (vsak ključ svoj counter)
    expect(mocks.webauthnFindUnique).toHaveBeenCalledWith({
      where: { credentialId: 'cred-b' },
      select: expect.objectContaining({ credentialId: true, publicKey: true, counter: true }),
    })
    expect(mocks.webauthnUpdateMany).toHaveBeenCalledWith({
      where: { credentialId: 'cred-b', counter: { lt: 10 } },
      data: { counter: 10, lastUsedAt: expect.any(Date) },
    })
  })
})

// ══════════════════════════════════════════════════════════════════
// F. Mid-flight brisanje — temporalna vrzel med options in verify
// ══════════════════════════════════════════════════════════════════
describe('R100 F: mid-flight brisanje (admin izbriše ključ med ceremony)', () => {
  it('poverilnica izbrisana po options → findUnique null → ISTI unificiran 401 + ZERO pisnih operacij', async () => {
    stubVerifySuccess(4, 5)
    // med options in verify: admin deleteMany je pobrisal poverilnico
    mocks.webauthnFindUnique.mockResolvedValue(null)

    const res = await verifyPOST(
      jsonReq(VERIFY_URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }),
    )

    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body).toEqual({ error: VERIFY_FAILED_MESSAGE })
    // zero-oracle: izbrisana = neznana (isti body) + NIČ pisnih operacij
    expect(mocks.webauthnUpdate).not.toHaveBeenCalled()
    expect(mocks.webauthnUpdateMany).not.toHaveBeenCalled()
  })

  it('izbrisana lokacija NE more verificirati (location relacija manjka) → 401 + zero pisnih operacij', async () => {
    stubVerifySuccess(4, 5)
    // lokacija deleted (cascade pobriše credential — modelira cascade onDelete);
    // defensive: vrstica brez location relacije → cross-check guard
    mocks.webauthnFindUnique.mockResolvedValue(
      credentialRow({ location: undefined }),
    )

    const res = await verifyPOST(
      jsonReq(VERIFY_URL, 'POST', { assertion: assertionFixture(), locationId: 'loc-1' }),
    )

    expect(res.status).toBe(401)
    expect(mocks.webauthnUpdate).not.toHaveBeenCalled()
    expect(mocks.webauthnUpdateMany).not.toHaveBeenCalled()
  })
})
