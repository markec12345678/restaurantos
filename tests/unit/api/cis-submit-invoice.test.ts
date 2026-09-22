// ============================================
// CIS SUBMIT INVOICE — API route testi (runda 29)
//
// POST /api/cis/submit-invoice handler (direktno, brez HTTP strežnika):
//   * uspešna oddaja (orderId path) → 200, ok=true + jir
//   * receiptId path (direktna referenca)
//   * body brez receiptId/orderId → 400 (zod refine)
//   * račun ni najden (orderId brez računa) → 400
//   * submitReceiptToCis vrne receipt-not-found → 400
//   * 401 brez auth; 429 rate limit
//   * ok=false z serverErrorCode → 200 (VELJAVEN izid — pending)
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocki PRED importom route-a ---
const receiptFindFirstMock = vi.fn()
const submitReceiptToCisMock = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    receipt: {
      findFirst: (...args: unknown[]) => receiptFindFirstMock(...args),
    },
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: vi.fn(async () => ({
    session: { employeeId: 'emp-1', locationId: 'loc-1', role: 'admin' },
  })),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: vi.fn(async () => ({ allowed: true, remaining: 59 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  AUTHENTICATED_LIMIT: 60,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/cis', () => ({
  submitReceiptToCis: (...args: unknown[]) => submitReceiptToCisMock(...args),
}))

import { POST } from '@/app/api/cis/submit-invoice/route'

function post(body?: unknown): Request {
  return new Request('http://localhost:3000/api/cis/submit-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  submitReceiptToCisMock.mockResolvedValue({
    ok: true, skipped: false, cisStatus: 'submitted',
    jir: '17012345678901234', zki: 'a'.repeat(32), environment: 'test',
  })
})

describe('POST /api/cis/submit-invoice', () => {
  it('orderId path → resolvcija računa + 200 ok=true z JIR', async () => {
    receiptFindFirstMock.mockResolvedValue({ id: 'rcpt-1' })

    const res = await POST(post({ orderId: 'order-1' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.jir).toBe('17012345678901234')
    expect(data.cisStatus).toBe('submitted')

    expect(receiptFindFirstMock).toHaveBeenCalledWith({
      where: { orderId: 'order-1', isStorno: false, order: { locationId: 'loc-1' } },
      select: { id: true },
    })
    expect(submitReceiptToCisMock).toHaveBeenCalledWith('rcpt-1')
  })

  it('receiptId path → lastniška preverba (R86-4) + direktna oddaja', async () => {
    receiptFindFirstMock.mockResolvedValue({ id: 'rcpt-direct' })
    const res = await POST(post({ receiptId: 'rcpt-direct' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    // R86-4: scoped lastniška preverba PRED oddajo (order.locationId iz seje)
    expect(receiptFindFirstMock).toHaveBeenCalledWith({
      where: { id: 'rcpt-direct', order: { locationId: 'loc-1' } },
      select: { id: true },
    })
    expect(submitReceiptToCisMock).toHaveBeenCalledWith('rcpt-direct')
  })

  it('body brez receiptId/orderId → 400 (zod refine)', async () => {
    const res = await POST(post({}))
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toContain('receiptId')
    expect(submitReceiptToCisMock).not.toHaveBeenCalled()
  })

  it('orderId brez računa → 400 "Račun ni najden"', async () => {
    receiptFindFirstMock.mockResolvedValue(null)

    const res = await POST(post({ orderId: 'order-x' }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('Račun ni najden')
    expect(submitReceiptToCisMock).not.toHaveBeenCalled()
  })

  it('submitReceiptToCis → receipt-not-found → 400', async () => {
    receiptFindFirstMock.mockResolvedValue({ id: 'rcpt-1' })
    submitReceiptToCisMock.mockResolvedValue({ ok: false, skipped: true, reason: 'receipt-not-found' })

    const res = await POST(post({ receiptId: 'rcpt-gone' }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('ni najden')
  })

  it('ok=false s serverErrorCode → 200 (veljaven izid, pending)', async () => {
    receiptFindFirstMock.mockResolvedValue({ id: 'rcpt-1' })
    submitReceiptToCisMock.mockResolvedValue({
      ok: false, skipped: false, cisStatus: 'pending',
      zki: 'b'.repeat(32), serverErrorCode: 'b001', errorMessage: 'Račun već poslan',
    })

    const res = await POST(post({ orderId: 'order-1' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(false)
    expect(data.serverErrorCode).toBe('b001')
    expect(data.cisStatus).toBe('pending')
  })

  it('skip no-cert-config → 200 z reason (SI tenant)', async () => {
    receiptFindFirstMock.mockResolvedValue({ id: 'rcpt-1' })
    submitReceiptToCisMock.mockResolvedValue({ ok: false, skipped: true, reason: 'no-cert-config' })

    const res = await POST(post({ orderId: 'order-1' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.skipped).toBe(true)
    expect(data.reason).toBe('no-cert-config')
  })

  it('neveljaven OIB-tip body (orderId prazen niz) → 400', async () => {
    const res = await POST(post({ orderId: '' }))
    expect(res.status).toBe(400)
  })
})

// ─── Auth + rate limit (ločena describe, override mockov) ───
describe('POST /api/cis/submit-invoice — varnost', () => {
  it('401 brez auth', async () => {
    const { requireAuth } = await import('@/lib/auth-middleware')
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna' }), { status: 401 }),
    })

    const res = await POST(post({ orderId: 'order-1' }))
    expect(res.status).toBe(401)
    expect(submitReceiptToCisMock).not.toHaveBeenCalled()
  })

  it('429 ob preseženem rate limitu', async () => {
    const { checkRateLimitAsync } = await import('@/lib/rate-limit')
    ;(checkRateLimitAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      retryAfterMs: 30000,
    })

    const res = await POST(post({ orderId: 'order-1' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
    expect(submitReceiptToCisMock).not.toHaveBeenCalled()
  })
})
