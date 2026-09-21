// ============================================
// R88 — per-location public ordering token (lib) — regresijski testi
// ============================================
// Pokriva lib/ordering-token.ts (R81 qr-pay HMAC vzorec, brez sheme/Redis-a):
//   1. Token format `v1:<64 hex>` — determinističen HMAC nad
//      `online-order:v1:${locationId}`, različen po lokacijah.
//   2. verifyOrderingToken — timing-safe, fail-closed: pravi token true,
//      token tuje lokacije / tamperiran HMAC / napačen prefix / prazen /
//      ne-string → false (NICCER meta odgovor true).
//   3. Dev fallback — izven produkcije je dovoljen (isOrderingSecretConfigured
//      true, token deluje brez env nastavitve); rotacija skrivnosti
//      annullira stare tokene (stateless revokacija kanon).
//   4. Production fail-closed (R82-D kanon): NODE_ENV=production brez
//      ORDERING_TOKEN_SECRET / QR_PAY_SECRET / ENCRYPTION_KEY /
//      NEXTAUTH_SECRET → isOrderingSecretConfigured() false,
//      verifyOrderingToken() false, orderingTokenFor() throws (nikoli token
//      z javno znanim dev secretom).
// Vzorec: r81-qr-pay-token.test.ts (lib testi brez db mockov) + vi.stubEnv
// manipulacija okolja z unstubAllEnvs čiščenjem.
// ============================================

import { describe, it, expect, afterEach, vi } from 'vitest'

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
describe('R88 A: orderingTokenFor — format `v1:<64 hex>`', () => {
  it('token je `v1:<64 hex>` (67 znakov)', () => {
    stubTestSecret()
    const token = orderingTokenFor(LOC_A)
    expect(token).toMatch(/^v1:[a-f0-9]{64}$/)
    expect(token.length).toBe(67)
  })

  it('determinističen: isti locationId → isti token', () => {
    stubTestSecret()
    expect(orderingTokenFor(LOC_A)).toBe(orderingTokenFor(LOC_A))
  })

  it('različen locationId → različen token (vezava na TOČNO eno lokacijo)', () => {
    stubTestSecret()
    expect(orderingTokenFor(LOC_B)).not.toBe(orderingTokenFor(LOC_A))
  })
})

// ══════════════════════════════════════════════════════════════════
// B. verifyOrderingToken — timing-safe, fail-closed
// ══════════════════════════════════════════════════════════════════
describe('R88 B: verifyOrderingToken — veljavni/napačni pari', () => {
  it('pravi token za lokacijo → true', () => {
    stubTestSecret()
    expect(verifyOrderingToken(orderingTokenFor(LOC_A), LOC_A)).toBe(true)
  })

  it('token za TUJO lokacijo → false (vezava locationId↔token)', () => {
    stubTestSecret()
    expect(verifyOrderingToken(orderingTokenFor(LOC_B), LOC_A)).toBe(false)
  })

  it('tamperiran HMAC (zadnja hex številka) → false', () => {
    stubTestSecret()
    const token = orderingTokenFor(LOC_A)
    const lastChar = token.charAt(token.length - 1)
    const tampered = token.slice(0, -1) + (lastChar === '0' ? '1' : '0')
    expect(tampered).not.toBe(token)
    expect(verifyOrderingToken(tampered, LOC_A)).toBe(false)
  })

  it('napačen prefix (`v2:` z istim MAC) → false', () => {
    stubTestSecret()
    const token = orderingTokenFor(LOC_A)
    const wrongPrefix = `v2:${token.slice(3)}`
    expect(verifyOrderingToken(wrongPrefix, LOC_A)).toBe(false)
  })

  it('preveč/preveliko segmentov (`v1:aa:bb`) → false', () => {
    stubTestSecret()
    const mac = orderingTokenFor(LOC_A).slice(3)
    expect(verifyOrderingToken(`v1:${mac}:extra`, LOC_A)).toBe(false)
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
// C. Dev fallback (izven produkcije dovoljen) + rotacija skrivnosti
// ══════════════════════════════════════════════════════════════════
describe('R88 C: dev fallback + rotacija', () => {
  it('test/dev okolje BREZ skrivnosti → konfigurirano (dev fallback) + token deluje', () => {
    stubNoSecrets() // NODE_ENV ostane 'test'
    expect(isOrderingSecretConfigured()).toBe(true)
    const token = orderingTokenFor(LOC_A)
    expect(verifyOrderingToken(token, LOC_A)).toBe(true)
  })

  it('rotacija skrivnosti annullira stare tokene (stateless revokacija)', () => {
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
describe('R88 D: isOrderingSecretConfigured — semantika okolja', () => {
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
describe('R88 E: produkcija brez skrivnosti — token funkcije fail-closed', () => {
  it('orderingTokenFor v produkciji brez skrivnosti THROWS (nikoli dev secret)', () => {
    stubProductionNoSecret()
    expect(() => orderingTokenFor(LOC_A)).toThrow()
  })

  it('verifyOrderingToken v produkciji brez skrivnosti → false tudi za veljaven dev token', () => {
    // token izdan v dev fallback okolju
    stubNoSecrets()
    const devToken = orderingTokenFor(LOC_A)
    // strežnik se premakne v produkcijo brez skrivnosti → fail-closed
    vi.stubEnv('NODE_ENV', 'production')
    expect(isOrderingSecretConfigured()).toBe(false)
    expect(verifyOrderingToken(devToken, LOC_A)).toBe(false)
  })
})
