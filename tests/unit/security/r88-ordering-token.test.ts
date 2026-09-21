// ============================================
// R88/R89 — per-location public ordering token (lib) — regresijski testi
// ============================================
// Pokriva lib/ordering-token.ts (R81 qr-pay HMAC vzorec, brez sheme/Redis-a):
//   1. Token format `v1:<version>:<64 hex>` (R89) — determinističen HMAC nad
//      `online-order:v1:${locationId}:${tokenVersion}`, različen po lokacijah
//      IN po verzijah (R89 per-location revokacija).
//   2. verifyOrderingToken — timing-safe, fail-closed: pravi token true,
//      token tuje lokacije / tamperiran HMAC / napačen prefix / PRAVA verzija
//      token za NAPAČNO verzijo / legacy 2-delni R88 format / prazen /
//      ne-string → false (NIČER meta odgovor true).
//   3. R89 verzija parameter: negativen / necel / NaN / Infinity / prevelik
//      (nad MAX_SAFE_INTEGER) → false (verify) oziroma RangeError (mint —
//      fail-closed PRED kovanjem). Nad-Int32 safe integer → veljaven roundtrip.
//   4. Dev fallback — izven produkcije je dovoljen (isOrderingSecretConfigured
//      true, token deluje brez env nastavitve); rotacija skrivnosti annullira
//      stare tokene (stateless revokacija — R89: ZADNJA linija, per-location
//      revokacija gre prek tokenVersion rotate-a).
//   5. Production fail-closed (R82-D kanon): NODE_ENV=production brez
//      ORDERING_TOKEN_SECRET / QR_PAY_SECRET / ENCRYPTION_KEY /
//      NEXTAUTH_SECRET → isOrderingSecretConfigured() false,
//      verifyOrderingToken() false, orderingTokenFor() throws (nikoli token
//      z javno znanim dev secretom).
// Vzorec: r81-qr-pay-token.test.ts (lib testi brez db mockov) + vi.stubEnv
// manipulacija okolja z unstubAllEnvs čiščenjem.
// ============================================

import { describe, it, expect, afterEach, vi } from 'vitest'
import crypto from 'crypto'

import {
  orderingTokenFor, verifyOrderingToken, isOrderingSecretConfigured,
} from '@/lib/ordering-token'

const LOC_A = 'locTenantA'
const LOC_B = 'locTenantB'
const TEST_SECRET = 'r88-unit-test-ordering-secret'

/** Stub-a VSE štiri skrivnosti na prazno — resolveOrderingSecret → null. */
function stubNoSecrets() {
  vi.stubEnv('ORDERING_TOKEN_SECRET', '')
  vi.stubEnv('QR_PAY_SECRET', '')
  vi.stubEnv('ENCRYPTION_KEY', '')
  vi.stubEnv('NEXTAUTH_SECRET', '')
}

/** Stub-a produkcijo BREZ skrivnosti (R82-D fail-closed scenarij). */
function stubProductionNoSecret() {
  vi.stubEnv('NODE_ENV', 'production')
  stubNoSecrets()
}

/** Stub-a izrecno skrivnost (deterministični tokeni neodvisni od okolja). */
function stubTestSecret() {
  vi.stubEnv('ORDERING_TOKEN_SECRET', TEST_SECRET)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

// ══════════════════════════════════════════════════════════════════
// A. Token format + determinizem
// ══════════════════════════════════════════════════════════════════
describe('R89 A: orderingTokenFor — format `v1:<version>:<64 hex>`', () => {
  it('token je `v1:0:<64 hex>` (69 znakov) z default verzijo', () => {
    stubTestSecret()
    const token = orderingTokenFor(LOC_A)
    expect(token).toMatch(/^v1:0:[a-f0-9]{64}$/)
    expect(token.length).toBe(69)
  })

  it('izrazna verzija: orderingTokenFor(LOC_A, 3) → `v1:3:<64 hex>`', () => {
    stubTestSecret()
    const token = orderingTokenFor(LOC_A, 3)
    expect(token).toMatch(/^v1:3:[a-f0-9]{64}$/)
  })

  it('determinističen: isti (locationId, verzija) → isti token', () => {
    stubTestSecret()
    expect(orderingTokenFor(LOC_A)).toBe(orderingTokenFor(LOC_A, 0))
    expect(orderingTokenFor(LOC_A, 7)).toBe(orderingTokenFor(LOC_A, 7))
  })

  it('različen locationId → različen token (vezava na TOČNO eno lokacijo)', () => {
    stubTestSecret()
    expect(orderingTokenFor(LOC_B)).not.toBe(orderingTokenFor(LOC_A))
  })

  it('R89: različna verzija → različen token (isti locationId — revokacija ključ)', () => {
    stubTestSecret()
    const v0 = orderingTokenFor(LOC_A, 0)
    const v1 = orderingTokenFor(LOC_A, 1)
    expect(v1).not.toBe(v0)
    expect(v1.startsWith('v1:1:')).toBe(true)
  })

  it('neveljaven tokenVersion → RangeError (fail-closed PRED kovanjem)', () => {
    stubTestSecret()
    expect(() => orderingTokenFor(LOC_A, -1)).toThrow(RangeError)
    expect(() => orderingTokenFor(LOC_A, 1.5)).toThrow(RangeError)
    expect(() => orderingTokenFor(LOC_A, NaN)).toThrow(RangeError)
    expect(() => orderingTokenFor(LOC_A, Infinity)).toThrow(RangeError)
    expect(() => orderingTokenFor(LOC_A, Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError)
  })
})

// ══════════════════════════════════════════════════════════════════
// B. verifyOrderingToken — timing-safe, fail-closed
// ══════════════════════════════════════════════════════════════════
describe('R89 B: verifyOrderingToken — veljavni/napačni pari', () => {
  it('pravi token za lokacijo → true (default IN izrazna verzija)', () => {
    stubTestSecret()
    expect(verifyOrderingToken(orderingTokenFor(LOC_A), LOC_A)).toBe(true)
    expect(verifyOrderingToken(orderingTokenFor(LOC_A, 0), LOC_A, 0)).toBe(true)
    expect(verifyOrderingToken(orderingTokenFor(LOC_A, 5), LOC_A, 5)).toBe(true)
  })

  it('R89: token za NAPAČNO verzijo → false (rotate = stari tokeni mrtvi)', () => {
    stubTestSecret()
    const v0 = orderingTokenFor(LOC_A, 0)
    const v1 = orderingTokenFor(LOC_A, 1)
    // lokacija je rotirala na 1 → v0 token je neveljaven
    expect(verifyOrderingToken(v0, LOC_A, 1)).toBe(false)
    // in obratno (token novejši od lokacijske verzije — nikoli v praksi, a fail-closed)
    expect(verifyOrderingToken(v1, LOC_A, 0)).toBe(false)
  })

  it('token za TUJO lokacijo → false (vezava locationId↔token)', () => {
    stubTestSecret()
    expect(verifyOrderingToken(orderingTokenFor(LOC_B), LOC_A)).toBe(false)
    expect(verifyOrderingToken(orderingTokenFor(LOC_B, 2), LOC_A, 2)).toBe(false)
  })

  it('tamperiran HMAC (zadnja hex številka) → false', () => {
    stubTestSecret()
    const token = orderingTokenFor(LOC_A)
    const lastChar = token.charAt(token.length - 1)
    const tampered = token.slice(0, -1) + (lastChar === '0' ? '1' : '0')
    expect(tampered).not.toBe(token)
    expect(verifyOrderingToken(tampered, LOC_A)).toBe(false)
  })

  it('napačen prefix (`v2:` z isto verzijo+MAC) → false', () => {
    stubTestSecret()
    const token = orderingTokenFor(LOC_A)
    const wrongPrefix = `v2:${token.slice(3)}`
    expect(verifyOrderingToken(wrongPrefix, LOC_A)).toBe(false)
  })

  it('R89: legacy 2-delni R88 token (`v1:<hmac>`) → false (format change je nameren)', () => {
    stubTestSecret()
    // R88 format: MAC kovan nad kontekstom BREZ verzije (lib R88 vedenje —
    // rekonstruiran lokalno, ker lib ne ponuja več legacy kovanja).
    const legacyMac = crypto.createHmac('sha256', TEST_SECRET)
      .update(`online-order:v1:${LOC_A}`).digest('hex')
    expect(legacyMac).toMatch(/^[a-f0-9]{64}$/)
    expect(verifyOrderingToken(`v1:${legacyMac}`, LOC_A)).toBe(false)
    expect(verifyOrderingToken(`v1:${legacyMac}`, LOC_A, 0)).toBe(false)
  })

  it('preveč/preveliko segmentov (`v1:0:aa:bb`) → false', () => {
    stubTestSecret()
    const mac = orderingTokenFor(LOC_A).slice(5)
    expect(verifyOrderingToken(`v1:0:${mac}:extra`, LOC_A)).toBe(false)
  })

  it('ne-kanonska verzija v tokenu (`v1:01:…`, `v1:-1:…`, `v1:x:…`) → false', () => {
    stubTestSecret()
    const mac = orderingTokenFor(LOC_A, 1).slice(5)
    expect(verifyOrderingToken(`v1:01:${mac}`, LOC_A, 1)).toBe(false) // vodilna ničla
    expect(verifyOrderingToken(`v1:-1:${mac}`, LOC_A, -1)).toBe(false) // negativna
    expect(verifyOrderingToken(`v1:x:${mac}`, LOC_A, 1)).toBe(false)
    expect(verifyOrderingToken(`v1:1.5:${mac}`, LOC_A, 1)).toBe(false)
  })

  it('pražen / presledkovni token → false', () => {
    stubTestSecret()
    expect(verifyOrderingToken('', LOC_A)).toBe(false)
    expect(verifyOrderingToken('   ', LOC_A)).toBe(false)
  })

  it('ne-string token (številka/null/undefined/objekt) → false', () => {
    stubTestSecret()
    expect(verifyOrderingToken(123 as never, LOC_A)).toBe(false)
    expect(verifyOrderingToken(null as never, LOC_A)).toBe(false)
    expect(verifyOrderingToken(undefined as never, LOC_A)).toBe(false)
    expect(verifyOrderingToken({ v1: 'x' } as never, LOC_A)).toBe(false)
  })

  it('prazen/neveljaven locationId → false (fail-closed tudi na id strani)', () => {
    stubTestSecret()
    const token = orderingTokenFor(LOC_A)
    expect(verifyOrderingToken(token, '')).toBe(false)
    expect(verifyOrderingToken(token, 'ab')).toBe(false) // pod LOCATION_ID_RE min dolžino
  })
})

// ══════════════════════════════════════════════════════════════════
// B2. R89 verzija parameter — fail-closed na nenormalne vhode
// ══════════════════════════════════════════════════════════════════
describe('R89 B2: verifyOrderingToken — verzija parameter handling', () => {
  it('negativna / necela / NaN / Infinity verzija → false', () => {
    stubTestSecret()
    const token = orderingTokenFor(LOC_A)
    expect(verifyOrderingToken(token, LOC_A, -1)).toBe(false)
    expect(verifyOrderingToken(token, LOC_A, 0.5)).toBe(false)
    expect(verifyOrderingToken(token, LOC_A, NaN)).toBe(false)
    expect(verifyOrderingToken(token, LOC_A, Infinity)).toBe(false)
  })

  it('prevelika verzija (nad MAX_SAFE_INTEGER) → false (fail-closed)', () => {
    stubTestSecret()
    const token = orderingTokenFor(LOC_A)
    expect(verifyOrderingToken(token, LOC_A, Number.MAX_SAFE_INTEGER + 1)).toBe(false)
    expect(verifyOrderingToken(token, LOC_A, 1e21)).toBe(false)
  })

  it('nad-Int32 SAFE verzija → veljaven roundtrip (lib nima Int32 stropa; DB Int ga ima)', () => {
    stubTestSecret()
    const big = 4294967296 // 2^32 — nad Prisma Int32, pod MAX_SAFE_INTEGER
    const token = orderingTokenFor(LOC_A, big)
    expect(token.startsWith('v1:4294967296:')).toBe(true)
    expect(verifyOrderingToken(token, LOC_A, big)).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════
// C. Dev fallback (izven produkcije dovoljen) + rotacija skrivnosti
// ══════════════════════════════════════════════════════════════════
describe('R89 C: dev fallback + rotacija', () => {
  it('test/dev okolje BREZ skrivnosti → konfigurirano (dev fallback) + token deluje', () => {
    stubNoSecrets() // NODE_ENV ostane 'test'
    expect(isOrderingSecretConfigured()).toBe(true)
    const token = orderingTokenFor(LOC_A)
    expect(verifyOrderingToken(token, LOC_A)).toBe(true)
  })

  it('rotacija skrivnosti annullira stare tokene (stateless revokacija — zadnja linija)', () => {
    stubTestSecret()
    const oldToken = orderingTokenFor(LOC_A)
    vi.stubEnv('ORDERING_TOKEN_SECRET', `${TEST_SECRET}-rotated`)
    expect(verifyOrderingToken(oldToken, LOC_A)).toBe(false)
    expect(verifyOrderingToken(orderingTokenFor(LOC_A), LOC_A)).toBe(true)
  })

  it('QR_PAY_SECRET / ENCRYPTION_KEY / NEXTAUTH_SECRET so veljavni fallback viri', () => {
    stubNoSecrets()
    vi.stubEnv('QR_PAY_SECRET', TEST_SECRET)
    const token = orderingTokenFor(LOC_A)
    vi.stubEnv('QR_PAY_SECRET', '')
    vi.stubEnv('NEXTAUTH_SECRET', TEST_SECRET)
    // ista vsebnost skrivnosti prek druge spremenljivke → isti token
    expect(verifyOrderingToken(token, LOC_A)).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════
// D. isOrderingSecretConfigured — produkcija fail-closed (R82-D kanon)
// ══════════════════════════════════════════════════════════════════
describe('R89 D: isOrderingSecretConfigured — semantika okolja', () => {
  it('produkcija BREZ skrivnosti → false', () => {
    stubProductionNoSecret()
    expect(isOrderingSecretConfigured()).toBe(false)
  })

  it('produkcija z ORDERING_TOKEN_SECRET → true', () => {
    stubProductionNoSecret()
    vi.stubEnv('ORDERING_TOKEN_SECRET', TEST_SECRET)
    expect(isOrderingSecretConfigured()).toBe(true)
  })

  it('produkcija z QR_PAY_SECRET (fallback vir) → true', () => {
    stubProductionNoSecret()
    vi.stubEnv('QR_PAY_SECRET', TEST_SECRET)
    expect(isOrderingSecretConfigured()).toBe(true)
  })

  it('ne-produkcija BREZ skrivnosti → true (dev fallback dovoljen)', () => {
    stubNoSecrets()
    vi.stubEnv('NODE_ENV', 'development')
    expect(isOrderingSecretConfigured()).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════
// E. Production fail-closed vedenje token funkcij
// ══════════════════════════════════════════════════════════════════
describe('R89 E: produkcija brez skrivnosti — token funkcije fail-closed', () => {
  it('orderingTokenFor v produkciji brez skrivnosti THROWS (nikoli dev secret)', () => {
    stubProductionNoSecret()
    expect(() => orderingTokenFor(LOC_A)).toThrow()
    expect(() => orderingTokenFor(LOC_A, 2)).toThrow()
  })

  it('verifyOrderingToken v produkciji brez skrivnosti → false tudi za veljaven dev token', () => {
    // token izdan v dev fallback okolju
    stubNoSecrets()
    const devToken = orderingTokenFor(LOC_A)
    // strežnik se premakne v produkcijo brez skrivnosti → fail-closed
    vi.stubEnv('NODE_ENV', 'production')
    expect(isOrderingSecretConfigured()).toBe(false)
    expect(verifyOrderingToken(devToken, LOC_A)).toBe(false)
    expect(verifyOrderingToken(devToken, LOC_A, 0)).toBe(false)
  })
})
