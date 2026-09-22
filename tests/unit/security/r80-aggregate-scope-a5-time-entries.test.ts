// ============================================
// R80 — AGGREGATE SCOPE FIX A5: GET /api/time-entries
// ============================================
// REGRESIJA za HIGH aggregate leak (worklog 2-b):
//   timeEntry.findMany + count je prej izpostavljal payroll (payRate,
//   totalPay) in delovne ure VSEH tenantov (manage_employees) — where
//   brez locationId.
//
// Fix: resolveTenantLocationIdOrThrow + tenant filter v skupnem where
// (findMany + count oba dedita). TimeEntry ima lasten locationId stolpec
// (schema:906, nullable — legacy NULL vrstice so scoped uporabniku
// nevidne = fail-closed).
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  teFindMany: vi.fn(),
  teCount: vi.fn(),
}))

// Auth middleware: mock requireAuth, REALNI tenant-scope resolver
vi.mock('@/lib/auth-middleware', async () => {
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: mocks.requireAuth,
    resolveTenantLocationId: tenantScope.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: tenantScope.tenantScopeToWhere,
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    timeEntry: { findMany: mocks.teFindMany, count: mocks.teCount },
  },
}))

import { GET } from '@/app/api/time-entries/route'

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

function mockSession(overrides: Record<string, unknown> = {}) {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'manager', locationId: LOC_A, ...overrides },
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.teFindMany.mockResolvedValue([])
  mocks.teCount.mockResolvedValue(0)
})

describe('R80 A5: GET /api/time-entries — payroll tenant scope', () => {
  it('regular user brez locationId → 403 fail-closed, NI poizvedb na db', async () => {
    mockSession({ role: 'manager', locationId: null })

    const res = await GET(new Request('http://localhost:3000/api/time-entries'))

    expect(res.status).toBe(403)
    expect(mocks.teFindMany).not.toHaveBeenCalled()
    expect(mocks.teCount).not.toHaveBeenCalled()
  })

  it('manager loc-a: findMany + count dedita locationId (payRate/totalPay ne fulajo čez tenant)', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    const res = await GET(new Request('http://localhost:3000/api/time-entries'))
    expect(res.status).toBe(200)

    expect(mocks.teFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.teFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)

    // count uporablja ISTI where
    expect(mocks.teCount).toHaveBeenCalledTimes(1)
    expect(mocks.teCount.mock.calls[0][0].where).toEqual(
      mocks.teFindMany.mock.calls[0][0].where,
    )
  })

  it('employeeId filter se ZDRUŽI z tenant filterjem', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    await GET(new Request('http://localhost:3000/api/time-entries?employeeId=emp-7'))

    expect(mocks.teFindMany.mock.calls[0][0].where).toEqual({
      locationId: LOC_A,
      employeeId: 'emp-7',
    })
    expect(mocks.teCount.mock.calls[0][0].where).toEqual({
      locationId: LOC_A,
      employeeId: 'emp-7',
    })
  })

  it('?locationId bypass: regular useru je query parameter IGNORIRAN', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    await GET(new Request(`http://localhost:3000/api/time-entries?locationId=${LOC_B}`))

    expect(mocks.teFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.teCount.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin (null scope): filter OPUŠČEN — nikoli { locationId: null }', async () => {
    mockSession({ role: 'admin', locationId: null })

    await GET(new Request('http://localhost:3000/api/time-entries'))

    const where = mocks.teFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
    expect(
      Object.prototype.hasOwnProperty.call(mocks.teCount.mock.calls[0][0].where, 'locationId'),
    ).toBe(false)
  })

  it('super_admin z ?locationId: cross-branch pogled na podano lokacijo', async () => {
    mockSession({ role: 'super_admin', locationId: null })

    await GET(new Request(`http://localhost:3000/api/time-entries?locationId=${LOC_B}`))

    expect(mocks.teFindMany.mock.calls[0][0].where.locationId).toBe(LOC_B)
    expect(mocks.teCount.mock.calls[0][0].where.locationId).toBe(LOC_B)
  })
})
