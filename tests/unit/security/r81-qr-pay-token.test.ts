// ============================================
// R81 — qr-pay HMAC token binding — regresijski testi
// ============================================
// Pokriva (R81-E2 LEAK-HIGH ×2):
//   1. Token helper: determinističen HMAC(checkId), timing-safe verify,
//      format validation (64 hex)
//   2. GET /api/qr-pay: token MORA biti veljaven HMAC NEKEGA neporavnanih
//      čeka — tuj token → 404 (prej: PRVI neporavnan ček GLOBALNO)
//   3. POST /api/qr-pay/confirm: token MORA biti veljaven HMAC za podani
//      checkId → sicer 403 (prej: token ignoriran, plačilo po checkId)
//   4. POST /api/qr-pay (init): ček lokacijsko scoped (order.locationId)
//      + izdani token = HMAC(check.id)
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkFindFirst: vi.fn(),
  checkFindMany: vi.fn(),
  checkFindUnique: vi.fn(),
  txPaymentFindUnique: vi.fn(), // R104: idempotency replay (tx-nivo)
  updateCheckAndOrderStatus: vi.fn(), // R104: status helper mockan (tx-nivo)
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
    auditLog: { create: vi.fn() },
    // R104: confirm pot teče znotraj $transaction(fn, opts) — tx klient ponovno
    // uporablja iste mocke (checkFindUnique tudi na tx-nivoju).
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $executeRaw: vi.fn(),
        check: { findUnique: mocks.checkFindUnique, update: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
        payment: {
          findUnique: mocks.txPaymentFindUnique,
          aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
          create: vi.fn().mockResolvedValue({ id: 'pay-r81' }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        order: { update: vi.fn(), findUnique: vi.fn() },
      })),
  },
  createAuditLog: vi.fn(),
}))

vi.mock('@/app/api/payments/_helpers/check-status', () => ({
  updateCheckAndOrderStatus: mocks.updateCheckAndOrderStatus,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.rateLimit,
  getClientIp: () => '127.0.0.1',
  QR_PAY_LIMIT: { maxRequests: 10, windowMs: 60000 },
  CALL_WAITER_LIMIT: { maxRequests: 3, windowMs: 60000 },
}))

vi.mock('@/lib/furs/config-resolver', () => ({
  getRestaurantInfoForLocation: vi.fn().mockResolvedValue({ name: 'Test', address: 'X', city: 'Y' }),
}))

vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tenant-scope')>()
  return { ...actual, requireAuth: vi.fn() }
})

vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'log').mockImplementation(() => {})

import { qrPayTokenFor, verifyQrPayToken, QR_PAY_TOKEN_TTL_MS } from '@/lib/qr-pay-token'
import { GET as qrPayGET, POST as qrPayInit } from '@/app/api/qr-pay/route'
import { POST as qrPayConfirm } from '@/app/api/qr-pay/confirm/route'
import { requireAuth } from '@/lib/auth-middleware'
import { NextResponse } from 'next/server'

const CHECK_A = 'check-r81-a'
const CHECK_B = 'check-r81-b'

function makeCheck(id: string) {
  return {
    id,
    checkNumber: 1,
    paymentStatus: 'unpaid',
    subtotal: 10,
    tax: 2.2,
    total: 12.2,
    order: { id: 'ord-1', locationId: 'loc-1', table: { number: 5 }, orderItems: [] },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.rateLimit.mockResolvedValue({ allowed: true })
  mocks.txPaymentFindUnique.mockResolvedValue(null) // R104: brez replay-a po privzetem
})

describe('R81: qr-pay token helper (HMAC binding)', () => {
  it('token je determinističen HMAC za checkId (v2 format, isti issuedAt)', () => {
    const t1 = qrPayTokenFor(CHECK_A, 1700000000000)
    const t2 = qrPayTokenFor(CHECK_A, 1700000000000)
    expect(t1).toBe(t2)
    // FIX R82-D: format v2 — `v2:<issuedAtMs>:<64 hex>` (legacy 64-hex brez
    // TTL ni več veljaven)
    expect(t1).toMatch(/^v2:\d{1,16}:[a-f0-9]{64}$/)
    expect(qrPayTokenFor(CHECK_B, 1700000000000)).not.toBe(t1)
  })

  it('verify sprejme pravi token, zavrne tujega in napačnega formata', () => {
    expect(verifyQrPayToken(qrPayTokenFor(CHECK_A), CHECK_A)).toBe(true)
    expect(verifyQrPayToken(qrPayTokenFor(CHECK_B), CHECK_A)).toBe(false)
    expect(verifyQrPayToken('tok', CHECK_A)).toBe(false)
    expect(verifyQrPayToken('g'.repeat(64), CHECK_A)).toBe(false)
  })
})

describe('R81: GET /api/qr-pay — token vezava na konkreten ček', () => {
  it('veljaven token za CHECK_A vrne CHECK_A (ne prvega neporavnanih)', async () => {
    const checks = [makeCheck(CHECK_B), makeCheck(CHECK_A)]
    mocks.checkFindMany.mockResolvedValue(checks)

    const req = new Request(`http://localhost/api/qr-pay?token=${qrPayTokenFor(CHECK_A)}`)
    const res = await qrPayGET(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.check.id).toBe(CHECK_A)
  })

  it('tuj token → 404, brez razkritja čekov', async () => {
    mocks.checkFindMany.mockResolvedValue([makeCheck(CHECK_A)])

    // v2 format, a napačen MAC → verify false → 404
    const req = new Request(`http://localhost/api/qr-pay?token=v2:1700000000000:${'f'.repeat(64)}`)
    const res = await qrPayGET(req as never)

    expect(res.status).toBe(404)
  })

  it('R82-D: legacy 64-hex token (brez TTL) → 400 (format zavrnjen)', async () => {
    const req = new Request(`http://localhost/api/qr-pay?token=${'a'.repeat(64)}`)
    const res = await qrPayGET(req as never)

    expect(res.status).toBe(400)
    expect(mocks.checkFindMany).not.toHaveBeenCalled()
  })
})

describe('R81: POST /api/qr-pay/confirm — token obvezen in vezan', () => {
  it('napačen token → 403, DB NI klican', async () => {
    const req = new Request('http://localhost/api/qr-pay/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkId: CHECK_A, paymentMethod: 'card', tipAmount: 0, sessionToken: 'a'.repeat(64) }),
    })
    const res = await qrPayConfirm(req as never)

    expect(res.status).toBe(403)
    expect(mocks.checkFindUnique).not.toHaveBeenCalled()
  })

  it('veljaven token za CHECK_A → prehode naprej (ček se naloži)', async () => {
    const check = makeCheck(CHECK_A) as never as Record<string, unknown> & { total: unknown }
    mocks.checkFindUnique.mockResolvedValue(check)

    const req = new Request('http://localhost/api/qr-pay/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkId: CHECK_A, paymentMethod: 'card', tipAmount: 1, sessionToken: qrPayTokenFor(CHECK_A) }),
    })
    await qrPayConfirm(req as never)

    expect(mocks.checkFindUnique).toHaveBeenCalled()
  })
})

describe('R81: POST /api/qr-pay (init) — lokacijski scope + HMAC token', () => {
  it('location-bound staff: ček scoped prek order.locationId, token = v2 HMAC(check.id)', async () => {
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

    const where = mocks.checkFindFirst.mock.calls[0][0].where
    expect(where.order.locationId).toBe('loc-1')
    expect(res.status).toBe(201)
    // R82-D: token iz init poti MORA biti v2 in MORA preiti verify za ta checkId
    // (prej točna enakost — issuedAt je zdaj Date.now() ob izdaji)
    expect(body.sessionToken).toMatch(/^v2:\d{1,16}:[a-f0-9]{64}$/)
    expect(verifyQrPayToken(body.sessionToken, CHECK_A)).toBe(true)
    expect(body.expiresAt).toBeTruthy()
    // stari random token (crypto.randomBytes) se NE uporablja več — token mora biti HMAC
    void NextResponse
  })
})
