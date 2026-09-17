// ============================================
// SETUP/DB AUTH GATE — API route testi (runda 30)
//
// GET /api/setup/db (direktno, brez HTTP strežnika):
//   * CRON_SECRET set + pravi Bearer → 200 (deploy runbook pot)
//   * CRON_SECRET set + napačen Bearer + brez seje → 401
//   * CRON_SECRET set + napačen Bearer + admin seja → 200
//   * CRON_SECRET unset + admin seja → 200
//   * CRON_SECRET unset + brez seje → 401
//   * uspešen klic vseeno vrne poročilo (migrationSet r29, cisReady report)
//
// Runda 30: endpoint je prej bil odprt (samo rate-limit) — zdaj CRON_SECRET
// Bearer ALI admin seja (zrcali /api/cron/* vzorec).
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// --- Mocki PRED importom route-a ---
const requireAuthMock = vi.fn()
const queryRawMock = vi.fn()
const executeRawUnsafeMock = vi.fn()

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}))

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: (...args: unknown[]) => queryRawMock(...args),
    $executeRawUnsafe: (...args: unknown[]) => executeRawUnsafeMock(...args),
  },
}))

vi.mock('fs', () => {
  const readFileSync = vi.fn(() => {
    throw new Error('ENOENT: no schema.sql') // sql = '' → brez tabelskih statementov
  })
  return { readFileSync, default: { readFileSync } }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: vi.fn(async () => ({ allowed: true, remaining: 2 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  SEED_LIMIT: 3,
}))

import { GET } from '@/app/api/setup/db/route'

function get(authHeader?: string): Request {
  return new Request('http://localhost:3000/api/setup/db', {
    method: 'GET',
    headers: authHeader ? { Authorization: authHeader } : {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  queryRawMock.mockResolvedValue([])
  executeRawUnsafeMock.mockResolvedValue(1)
  requireAuthMock.mockResolvedValue({
    session: { employeeId: 'emp-1', locationId: 'loc-1', role: 'admin' },
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/setup/db — auth gate', () => {
  it('CRON_SECRET + pravi Bearer → 200 brez requireAuth (runbook pot)', async () => {
    vi.stubEnv('CRON_SECRET', 'test-cron-secret')

    const res = await GET(get('Bearer test-cron-secret'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.migrationSet).toBe('r29')
    expect(requireAuthMock).not.toHaveBeenCalled()
  })

  it('CRON_SECRET + napačen Bearer + brez seje → 401', async () => {
    vi.stubEnv('CRON_SECRET', 'test-cron-secret')
    requireAuthMock.mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna' }), { status: 401 }),
    })

    const res = await GET(get('Bearer wrong-secret'))

    expect(res.status).toBe(401)
    expect(requireAuthMock).toHaveBeenCalledTimes(1)
    expect(executeRawUnsafeMock).not.toHaveBeenCalled()
  })

  it('CRON_SECRET + napačen Bearer + admin seja → 200', async () => {
    vi.stubEnv('CRON_SECRET', 'test-cron-secret')

    const res = await GET(get('Bearer wrong-secret'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(requireAuthMock).toHaveBeenCalledWith(expect.any(Request), { permission: 'admin' })
  })

  it('CRON_SECRET unset + admin seja → 200', async () => {
    vi.stubEnv('CRON_SECRET', '')

    const res = await GET(get())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(requireAuthMock).toHaveBeenCalledTimes(1)
  })

  it('CRON_SECRET unset + brez seje → 401', async () => {
    vi.stubEnv('CRON_SECRET', '')
    requireAuthMock.mockResolvedValueOnce({
      error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna' }), { status: 401 }),
    })

    const res = await GET(get())

    expect(res.status).toBe(401)
    expect(executeRawUnsafeMock).not.toHaveBeenCalled()
  })

  it('brez Authorization headerja + CRON_SECRET set + admin seja → 200', async () => {
    vi.stubEnv('CRON_SECRET', 'test-cron-secret')

    const res = await GET(get())

    expect(res.status).toBe(200)
    expect(requireAuthMock).toHaveBeenCalledTimes(1)
  })
})

describe('GET /api/setup/db — uspešen potek (r29 report)', () => {
  it('poročilo vsebuje CIS verifikacijska polja', async () => {
    vi.stubEnv('CRON_SECRET', 'test-cron-secret')
    // cols query → 4 kolone; idx query → indeks (zaporedni $queryRaw klici)
    queryRawMock
      .mockResolvedValueOnce([]) // SELECT 1
      .mockResolvedValueOnce([]) // pg_tables
      .mockResolvedValueOnce([
        { column_name: 'cisJir' },
        { column_name: 'cisStatus' },
        { column_name: 'cisSubmittedAt' },
        { column_name: 'cisZki' },
      ])
      .mockResolvedValueOnce([{ indexname: 'Receipt_cisStatus_idx' }])

    const res = await GET(get('Bearer test-cron-secret'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.cisReady).toBe(true)
    expect(data.cisColumns).toHaveLength(4)
    expect(data.cisIndexPresent).toBe(true)
  })
})
