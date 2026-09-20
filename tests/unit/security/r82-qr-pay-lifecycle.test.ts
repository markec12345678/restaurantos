// ============================================
// R82-D — QR-pay token lifecycle (session / TTL / used / revoked)
//         + production secret fail-closed
// ============================================
// Pokriva uporabnikov R82-D:
//   1. TTL: token z issuedAt starejšim od QR_PAY_TOKEN_TTL_MS (15 min) je
//      neveljaven (GET → 404 / confirm → 403 brez DB klica)
//   2. Future-skew: issuedAt v prihodnje > 5 min zavrnjen
//   3. USED: plačan ček z veljavnim tokenom → 400 (enkratna uporaba)
//   4. REVOKED/RE-ISSUE: nov init = nov token (nov issuedAt)
//   5. Legacy 64-hex tokeni (R81, brez TTL) → neveljavni
//   6. PRODUCTION SECRET: hard-code dev fallback odstranjen — produkcija
//      brez QR_PAY_SECRET/ENCRYPTION_KEY/NEXTAUTH_SECRET → init 503,
//      qrPayTokenFor throw, verify fail-closed false
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkFindFirst: vi.fn(),
  checkFindMany: vi.fn(),
  checkFindUnique: vi.fn(),
  rateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}))

vi.mock('@/lib/db', () => ({
  db: {
    check: {
      findFirst: mocks.checkFindFirst,
      findMany: mocks.checkFindMany,
      findUnique: mocks.checkFindUnique,
    },
    payment: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), aggregate: vi.fn() },
    order: { update: vi.fn(), findUnique: vi.fn() },
    auditLog: { create: vi.fn().mockRejectedValue(new Error('audit off')) },
    $transaction: vi.fn(),
  },
  createAuditLog: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.rateLimit,
  getClientIp: () => '127.0.0.1',
  QR_PAY_LIMIT: { maxRequests: 10, windowMs: 60000 },
}))

vi.mock('@/lib/furs/config-resolver', () => ({
  getRestaurantInfoForLocation: vi.fn().mockResolvedValue({ name: 'Test', address: 'X', city: 'Y', postCode: '1000', taxId: 'SI1' }),
}))

vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tenant-scope')>()
  return { ...actual, requireAuth: vi.fn() }
})

vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'log').mockImplementation(() => {})

import {
  qrPayTokenFor,
  verifyQrPayToken,
  isQrPaySecretConfigured,
  QR_PAY_TOKEN_TTL_MS,
} from '@/lib/qr-pay-token'
import { GET as qrPayGET, POST as qrPayInit } from '@/app/api/qr-pay/route'
import { POST as qrPayConfirm } from '@/app/api/qr-pay/confirm/route'
import { requireAuth } from '@/lib/auth-middleware'

const CHECK_A = 'check-r82-a'
const ISSUED = 1_700_000_000_000

function makeCheck(id: string, paymentStatus = 'unpaid') {
  return {
    id,
    checkNumber: 1,
    paymentStatus,
    subtotal: 10,
    tax: 2.2,
    total: 12.2,
    order: { id: 'ord-1', locationId: 'loc-1', table: { number: 5 }, orderItems: [] },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.rateLimit.mockResolvedValue({ allowed: true })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ============================================
// 1) Token helper — TTL + skew (stateless lifecycle)
// ============================================
describe('R82-D: token TTL (stateless session)', () => {
  it('svež token je veljaven; token na meji TTL (TTL-1ms) še vedno', () => {
    const token = qrPayTokenFor(CHECK_A, ISSUED)
    expect(verifyQrPayToken(token, CHECK_A, ISSUED + 1000)).toBe(true)
    expect(verifyQrPayToken(token, CHECK_A, ISSUED + QR_PAY_TOKEN_TTL_MS - 1)).toBe(true)
  })

  it('expired token (issuedAt + TTL + 1ms) → false (GET bi bil 404)', () => {
    const token = qrPayTokenFor(CHECK_A, ISSUED)
    expect(verifyQrPayToken(token, CHECK_A, ISSUED + QR_PAY_TOKEN_TTL_MS)).toBe(false)
    expect(verifyQrPayToken(token, CHECK_A, ISSUED + QR_PAY_TOKEN_TTL_MS + 60_000)).toBe(false)
  })

  it('future-skew: issuedAt > now + 5 min → false; ≤ 5 min → true', () => {
    const NOW = 1_700_000_000_000
    const tooFar = qrPayTokenFor(CHECK_A, NOW + 5 * 60 * 1000 + 1)
    const okSkew = qrPayTokenFor(CHECK_A, NOW + 4 * 60 * 1000)
    expect(verifyQrPayToken(tooFar, CHECK_A, NOW)).toBe(false)
    expect(verifyQrPayToken(okSkew, CHECK_A, NOW)).toBe(true)
  })

  it('manipuliran issuedAt (isti MAC format) → HMAC ne ujema → false', () => {
    const token = qrPayTokenFor(CHECK_A, ISSUED)
    const [, , mac] = token.split(':')
    const forged = `v2:${ISSUED + 1}:${mac}`
    expect(verifyQrPayToken(forged, CHECK_A, ISSUED + 1000)).toBe(false)
  })

  it('malformati: ne-številski issuedAt, napačen prefix, napačen MAC format', () => {
    const mac = 'a'.repeat(64)
    expect(verifyQrPayToken(`v2:abc:${mac}`, CHECK_A)).toBe(false)
    expect(verifyQrPayToken(`v1:${ISSUED}:${mac}`, CHECK_A)).toBe(false)
    expect(verifyQrPayToken(`v2:${ISSUED}:${'Z'.repeat(64)}`, CHECK_A)).toBe(false)
    expect(verifyQrPayToken(`v2:${ISSUED}`, CHECK_A)).toBe(false)
    expect(verifyQrPayToken('', CHECK_A)).toBe(false)
  })

  it('legacy 64-hex token (R81, brez TTL) → false', () => {
    expect(verifyQrPayToken('a'.repeat(64), CHECK_A)).toBe(false)
  })

  it('token check-a A ni veljaven za check B (vezava ohranjena iz R81)', () => {
    const token = qrPayTokenFor(CHECK_A, ISSUED)
    expect(verifyQrPayToken(token, 'check-r82-b', ISSUED + 1000)).toBe(false)
  })
})

// ============================================
// 2) USED — plačan ček zavrnjen tudi z veljavnim tokenom
// ============================================
describe('R82-D: used/revoked semantika', () => {
  it('confirm: plačan ček (paymentStatus=paid) z VELJAVNIM tokenom → 400, payment se NE ustvari', async () => {
    mocks.checkFindUnique.mockResolvedValue(makeCheck(CHECK_A, 'paid'))

    const req = new Request('http://localhost/api/qr-pay/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkId: CHECK_A, paymentMethod: 'card', tipAmount: 0, sessionToken: qrPayTokenFor(CHECK_A) }),
    })
    const res = await qrPayConfirm(req as never)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('že plačan')
  })

  it('confirm: expired token → 403, DB NI klican (TTL pred podatkovno bazo)', async () => {
    const expired = qrPayTokenFor(CHECK_A, ISSUED)

    const req = new Request('http://localhost/api/qr-pay/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkId: CHECK_A, paymentMethod: 'card', tipAmount: 0, sessionToken: expired }),
    })
    // "zdaj" je oddaljen issuedAt za TTL+1min → token potekel
    vi.useFakeTimers()
    vi.setSystemTime(ISSUED + QR_PAY_TOKEN_TTL_MS + 60_000)
    try {
      const res = await qrPayConfirm(req as never)
      expect(res.status).toBe(403)
      expect(mocks.checkFindUnique).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('GET: expired token med neporavnanimi čeki → ni zadetka → 404', async () => {
    mocks.checkFindMany.mockResolvedValue([makeCheck(CHECK_A)])
    const expired = qrPayTokenFor(CHECK_A, ISSUED)

    vi.useFakeTimers()
    vi.setSystemTime(ISSUED + QR_PAY_TOKEN_TTL_MS + 60_000)
    try {
      const req = new Request(`http://localhost/api/qr-pay?token=${expired}`)
      const res = await qrPayGET(req as never)
      expect(res.status).toBe(404)
    } finally {
      vi.useRealTimers()
    }
  })

  it('re-issue: nov init = NOV token (nov issuedAt); oba veljavna do TTL (stateless kompromis, dokumentirano)', () => {
    const t1 = qrPayTokenFor(CHECK_A, ISSUED)
    const t2 = qrPayTokenFor(CHECK_A, ISSUED + 60_000)
    expect(t1).not.toBe(t2)
    expect(verifyQrPayToken(t1, CHECK_A, ISSUED + 1000)).toBe(true)
    expect(verifyQrPayToken(t2, CHECK_A, ISSUED + 61_000)).toBe(true)
  })
})

// ============================================
// 3) PRODUCTION SECRET — hard-code dev fallback odstranjen
// ============================================
describe('R82-D: production secret fail-closed', () => {
  function stubProductionWithoutSecrets() {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('QR_PAY_SECRET', '')
    vi.stubEnv('ENCRYPTION_KEY', '')
    vi.stubEnv('NEXTAUTH_SECRET', '')
  }

  it('isQrPaySecretConfigured: produkcija brez secretov → false; dev/test → true (fallback dovoljen)', () => {
    stubProductionWithoutSecrets()
    expect(isQrPaySecretConfigured()).toBe(false)

    vi.unstubAllEnvs()
    // Testno okolje ima ENCRYPTION_KEY iz setup.ts → konfigurirano
    expect(isQrPaySecretConfigured()).toBe(true)
  })

  it('isQrPaySecretConfigured: produkcija Z QR_PAY_SECRET → true', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('QR_PAY_SECRET', 'super-secret-value')
    expect(isQrPaySecretConfigured()).toBe(true)
  })

  it('qrPayTokenFor v produkciji brez secretov THROWA (nikoli tihi dev secret)', () => {
    stubProductionWithoutSecrets()
    expect(() => qrPayTokenFor(CHECK_A)).toThrow(/QR_PAY_SECRET/)
  })

  it('verifyQrPayToken v produkciji brez secretov → false (fail-closed)', () => {
    stubProductionWithoutSecrets()
    expect(verifyQrPayToken(`v2:${ISSUED}:${'a'.repeat(64)}`, CHECK_A)).toBe(false)
  })

  it('init route: produkcija brez secretov → 503, token NI izdan', async () => {
    stubProductionWithoutSecrets()
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'staff', locationId: 'loc-1' },
      error: null,
    })
    mocks.checkFindFirst.mockResolvedValue(makeCheck(CHECK_A))

    const req = new Request('http://localhost/api/qr-pay', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkId: CHECK_A }),
    })
    const res = await qrPayInit(req as never)

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toContain('ni konfigurirano')
  })

  it('init route: produkcija Z QR_PAY_SECRET → 201 + veljaven v2 token', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('QR_PAY_SECRET', 'super-secret-value')
    vi.stubEnv('ENCRYPTION_KEY', '')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'staff', locationId: 'loc-1' },
      error: null,
    })
    mocks.checkFindFirst.mockResolvedValue(makeCheck(CHECK_A))

    const req = new Request('http://localhost/api/qr-pay', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkId: CHECK_A }),
    })
    const res = await qrPayInit(req as never)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(verifyQrPayToken(body.sessionToken, CHECK_A)).toBe(true)
  })
})
