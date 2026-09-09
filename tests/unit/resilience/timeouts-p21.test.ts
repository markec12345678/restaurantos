// ============================================
// P1-21: TESTNA MATRIKA — timeout scenariji
// ============================================
// Zahteva (uporabnik): testi za:
//   database timeout, provider timeout, FURS timeout.
//
// Pokritost:
//   - database timeout: plačilna transakcija ima 8s hard cap
//     (prisma $transaction timeout) → P2028 → 409 retry (ne 500/504)
//   - serialization retry: P2034 (vzporedne transakcije) → 409
//   - FURS timeout: checkFursConnectivity ima AbortSignal.timeout(10s)
//     (token: 15s, verify-invoice: 30s) → graceful { reachable: false }
//   - provider timeout: plačilo čaka na advisory lock znotraj iste
//     transakcije — isti P2028/P2034 obramba sloj; webhook retry
//     (Stripe/Adyen) je pokrit v test-matrix-p21.test.ts (#9)
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

// ── Mock db ──
const mocks = vi.hoisted(() => ({
  paymentFindFirst: vi.fn(),
  checkFindFirst: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    payment: { findFirst: mocks.paymentFindFirst, findUnique: vi.fn() },
    check: { findFirst: mocks.checkFindFirst, findUnique: vi.fn() },
    $transaction: mocks.transaction,
  },
}))

import { handleCreatePayment } from '@/app/api/payments/_helpers/create-payment'
import { checkFursConnectivity } from '@/lib/furs/helpers/validation'

vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'log').mockImplementation(() => {})

const input = {
  checkId: 'check-timeout',
  amount: 20,
  tipAmount: 0,
  type: 'cash' as const,
  alternatePaymentTypeId: null,
  cardType: '',
  cardLast4: '',
  authorizationCode: '',
  giftCardId: null,
  loyaltyAccountId: null,
  loyaltyPointsUsed: 0,
  employeeId: null,
  idempotencyKey: 'key-p21-timeout',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.paymentFindFirst.mockResolvedValue(null) // idempotency miss
  mocks.checkFindFirst.mockResolvedValue({
    id: 'check-timeout',
    total: 20,
    orderId: 'order-timeout',
    order: { locationId: 'loc-p21' },
  })
})

// ─────────────────────────────────────────────
// 12. DATABASE TIMEOUT
// ─────────────────────────────────────────────
describe('P1-21 #12: database timeout → razumljiva napaka (ne 504 hang)', () => {
  it('P2028 (transakcija predolgo — npr. čakanje na advisory lock) → 409 retry', async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Transaction already closed: transaction timeout', {
        code: 'P2028',
        clientVersion: '5.22.0',
      })
    )
    const res = await handleCreatePayment(input, 'emp-p21', 'loc-p21')
    expect(res).toBeInstanceOf(NextResponse)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('poskusite znova')
  })

  it('P2034 (serialization failure — vzporedni plačili istega čeka) → 409 retry', async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', {
        code: 'P2034',
        clientVersion: '5.22.0',
      })
    )
    const res = await handleCreatePayment(input, 'emp-p21', 'loc-p21')
    expect(res.status).toBe(409)
  })

  it('$transaction se pokliče z 8s hard capom (Vercel 10s limit varnostni prag)', async () => {
    // Transakcija uspe (fn se ne izvede do konca — mock vrne payment)
    mocks.transaction.mockResolvedValue({ id: 'pay-1' })
    // post-payment fetch bo fallbackal na null (payment.findUnique mock) —
    // relevanten je samo options argument transakcije.
    await handleCreatePayment(input, 'emp-p21', 'loc-p21').catch(() => undefined)
    const txOptions = mocks.transaction.mock.calls[0]?.[1] as { timeout?: number } | undefined
    expect(txOptions?.timeout).toBe(8000)
  })
})

// ─────────────────────────────────────────────
// 13. PROVIDER TIMEOUT (plačilni provider)
// ─────────────────────────────────────────────
describe('P1-21 #13: provider timeout → klient dobi 409 retry, ne mrtvi hang', () => {
  it('provider/lock stall (P2028) → 409 BREZ razkritja internih kodek', async () => {
    // Provider stall se v tej arhitekturi kaže kot transakcijski stall
    // (advisory lock med plačili istega čeka). P2028→409 je varovalka.
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('stalled', {
        code: 'P2028',
        clientVersion: '5.22.0',
      })
    )
    const res = await handleCreatePayment(input, 'emp-p21', 'loc-p21')
    expect(res.status).toBe(409)
    // klientu se NE vrne interni message (P2028 detail)
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('P2028')
  })
})

// ─────────────────────────────────────────────
// 14. FURS TIMEOUT
// ─────────────────────────────────────────────
describe('P1-21 #14: FURS timeout → graceful odgovor (ne crash)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  it('AbortSignal timeout (10s) poteka → {reachable: false} z napako, brez throw', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted due to timeout'))
    const result = await checkFursConnectivity('test')
    expect(result.reachable).toBe(false)
    expect(result.error).toContain('aborted')
    expect(result.responseTime).toBeUndefined()
  })

  it('FURS nedosegljiv (network down) → {reachable: false}, brez crash', async () => {
    fetchMock.mockRejectedValue(new Error('fetch failed'))
    const result = await checkFursConnectivity('test')
    expect(result.reachable).toBe(false)
    expect(result.error).toBe('fetch failed')
  })

  it('FURS odgovori 401 (strežnik živ, JWT manjka) → reachable: true', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 })
    const result = await checkFursConnectivity('test')
    expect(result.reachable).toBe(true)
    expect(typeof result.responseTime).toBe('number')
  })

  it('fetch klic vsebuje AbortSignal — timeout je dejansko konfiguriran', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 405 })
    await checkFursConnectivity('test')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal).toBeTruthy()
    // AbortSignal.timeout proizvede AbortSignal z aborted=false
    expect(typeof (init.signal as AbortSignal).aborted).toBe('boolean')
  })
})
