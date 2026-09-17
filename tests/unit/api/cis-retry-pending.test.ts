// ============================================
// CIS RETRY PENDING — API route testi (runda 30)
//
// GET/POST /api/cis/retry-pending (direktno, brez HTTP strežnika):
//   * GET → 200 { pendingCount, failedCount } (badge števec)
//   * POST brez telesa → privzeti limit 10
//   * POST { limit: 5 } → findMany take 5
//   * POST { limit: 0 / 26 / 'x' } → 400 (zod)
//   * mešani izidi → pravilna sumarizacija (submitted/skipped/stillPending)
//   * submitReceiptToCis REJECT → errors++, batch gre naprej (resilience)
//   * prazen seznam → attempted 0, 200
//   * 401 brez auth; 429 rate limit
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocki PRED importom route-a ---
const receiptFindManyMock = vi.fn()
const receiptCountMock = vi.fn()
const submitReceiptToCisMock = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    receipt: {
      findMany: (...args: unknown[]) => receiptFindManyMock(...args),
      count: (...args: unknown[]) => receiptCountMock(...args),
    },
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: vi.fn(async () => ({
    session: { employeeId: 'emp-1', locationId: 'loc-1', role: 'admin' },
  })),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: vi.fn(async () => ({ allowed: true, remaining: 9 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  CIS_BATCH_RETRY_LIMIT: 10,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/cis', () => ({
  submitReceiptToCis: (...args: unknown[]) => submitReceiptToCisMock(...args),
}))

import { GET, POST } from '@/app/api/cis/retry-pending/route'

function post(body?: unknown): Request {
  return new Request('http://localhost:3000/api/cis/retry-pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

function get(): Request {
  return new Request('http://localhost:3000/api/cis/retry-pending', { method: 'GET' })
}

beforeEach(() => {
  vi.clearAllMocks()
  receiptCountMock.mockResolvedValue(0)
  receiptFindManyMock.mockResolvedValue([])
})

// ─── GET (badge števec) ───
describe('GET /api/cis/retry-pending', () => {
  it('vrne števce pending + failed', async () => {
    receiptCountMock.mockImplementation(async ({ where }: { where: { cisStatus: string } }) =>
      where.cisStatus === 'pending' ? 3 : 1
    )

    const res = await GET(get())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.pendingCount).toBe(3)
    expect(data.failedCount).toBe(1)
    expect(receiptCountMock).toHaveBeenCalledTimes(2)
  })

  it('401 brez auth', async () => {
    const { requireAuth } = await import('@/lib/auth-middleware')
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna' }), { status: 401 }),
    })

    const res = await GET(get())
    expect(res.status).toBe(401)
    expect(receiptCountMock).not.toHaveBeenCalled()
  })
})

// ─── POST (batch retry) ───
describe('POST /api/cis/retry-pending', () => {
  it('prazno telo → privzeti limit 10, prazen seznam → attempted 0', async () => {
    const res = await POST(post())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.attempted).toBe(0)
    expect(receiptFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    )
  })

  it('tel brez JSON-a → privzeti limit (telo je opcijsko)', async () => {
    // Bodyless Request — req.json() vrže → raw = {} → privzeti batch
    const res = await POST(new Request('http://localhost:3000/api/cis/retry-pending', { method: 'POST' }))
    expect(res.status).toBe(200)
    expect(receiptFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    )
  })

  it('{ limit: 5 } → findMany take 5 + FIFO orderBy', async () => {
    const res = await POST(post({ limit: 5 }))

    expect(res.status).toBe(200)
    expect(receiptFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        orderBy: { createdAt: 'asc' },
        where: { cisStatus: { in: ['pending', 'failed'] } },
      })
    )
  })

  it('neveljaven limit (0, 26, necelo) → 400', async () => {
    for (const bad of [{ limit: 0 }, { limit: 26 }, { limit: 'x' }]) {
      const res = await POST(post(bad))
      expect(res.status).toBe(400)
    }
    expect(receiptFindManyMock).not.toHaveBeenCalled()
  })

  it('mešani izidi → pravilna sumarizacija (submitted/skipped/stillPending/jirs)', async () => {
    receiptFindManyMock.mockResolvedValue([
      { id: 'r1', receiptNumber: 'R-2026-000001' },
      { id: 'r2', receiptNumber: 'R-2026-000002' },
      { id: 'r3', receiptNumber: 'R-2026-000003' },
      { id: 'r4', receiptNumber: 'R-2026-000004' },
    ])
    submitReceiptToCisMock
      .mockResolvedValueOnce({ ok: true, skipped: false, cisStatus: 'submitted', jir: '17012345678901234' })
      .mockResolvedValueOnce({ ok: true, skipped: true, reason: 'already-submitted', jir: '17099999999999999' })
      .mockResolvedValueOnce({ ok: false, skipped: false, cisStatus: 'pending', serverErrorCode: 'b001' })
      .mockResolvedValueOnce({ ok: false, skipped: true, reason: 'no-cert-config' })

    const res = await POST(post({ limit: 4 }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.attempted).toBe(4)
    expect(data.submitted).toBe(1)
    expect(data.skipped).toBe(2)
    expect(data.stillPending).toBe(1)
    expect(data.errors).toBe(0)
    expect(data.jirs).toEqual(['17012345678901234'])
    expect(data.results).toHaveLength(4)
    expect(data.results[2].serverErrorCode).toBeUndefined() // items nosijo samo relevantna polja
    expect(submitReceiptToCisMock).toHaveBeenNthCalledWith(1, 'r1')
  })

  it('submitReceiptToCis REJECT → errors++, batch gre naprej', async () => {
    receiptFindManyMock.mockResolvedValue([
      { id: 'r-bad', receiptNumber: 'R-2026-000009' },
      { id: 'r-good', receiptNumber: 'R-2026-000010' },
    ])
    submitReceiptToCisMock
      .mockRejectedValueOnce(new Error('db update catastrophe'))
      .mockResolvedValueOnce({ ok: true, skipped: false, cisStatus: 'submitted', jir: '17012345678901235' })

    const res = await POST(post())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.errors).toBe(1)
    expect(data.submitted).toBe(1)
    expect(data.results[0].error).toContain('db update catastrophe')
    expect(data.results[0].ok).toBe(false)
    expect(data.jirs).toEqual(['17012345678901235'])
    expect(submitReceiptToCisMock).toHaveBeenCalledTimes(2) // ni prekinitve batcha
  })

  it('401 brez auth', async () => {
    const { requireAuth } = await import('@/lib/auth-middleware')
    ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna' }), { status: 401 }),
    })

    const res = await POST(post({}))
    expect(res.status).toBe(401)
    expect(receiptFindManyMock).not.toHaveBeenCalled()
  })

  it('429 ob preseženem rate limitu', async () => {
    const { checkRateLimitAsync } = await import('@/lib/rate-limit')
    ;(checkRateLimitAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      retryAfterMs: 120000,
    })

    const res = await POST(post({}))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('120')
    expect(receiptFindManyMock).not.toHaveBeenCalled()
  })
})
