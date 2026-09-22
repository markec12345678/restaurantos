// ============================================
// R80 — AGGREGATE SCOPE FIX A2: GET /api/reports/shifts
// ============================================
// REGRESIJA za HIGH aggregate leak (worklog 2-b):
//   cashRegisterShift.findMany + 2×count + aggregate (_sum totalSales/
//   cashSales/totalTips/totalVoided) je prej zajelo izmene VSEH lokacij
//   (finančni povzetek čez tenant-e) — where brez locationId.
//
// Fix: resolveTenantLocationIdOrThrow + tenant filter v SKUPNEM where, tako
// da findMany + oba count + aggregate vsi dedijo filter.
// CashRegisterShift ima lasten locationId stolpec (schema:948).
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  shiftFindMany: vi.fn(),
  shiftCount: vi.fn(),
  shiftAggregate: vi.fn(),
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
    cashRegisterShift: {
      findMany: mocks.shiftFindMany,
      count: mocks.shiftCount,
      aggregate: mocks.shiftAggregate,
    },
  },
}))

import { GET } from '@/app/api/reports/shifts/route'

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

const shiftRow = {
  id: 'shift-1',
  status: 'closed',
  openedAt: new Date('2026-01-01T08:00:00Z'),
  closedAt: new Date('2026-01-01T16:00:00Z'),
  startingCash: 100,
  closingCash: 500,
  expectedCash: 530,
  cashSales: 400,
  cardSales: 200,
  mobileSales: 0,
  alternateSales: 0,
  splitPayments: 0,
  totalSales: 600,
  totalOrders: 10,
  totalDiscounts: 0,
  totalTips: 50,
  totalVoided: 0,
  totalRefunds: 0,
  cashDifference: -30,
  notes: '',
  locationId: LOC_A,
  employeeId: null,
  employeeName: 'Blagajnik',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.shiftFindMany.mockResolvedValue([shiftRow])
  mocks.shiftCount.mockResolvedValue(2)
  mocks.shiftAggregate.mockResolvedValue({
    _sum: {
      totalSales: 600,
      cashSales: 400,
      cardSales: 200,
      mobileSales: 0,
      totalTips: 50,
      totalDiscounts: 0,
      totalVoided: 0,
    },
  })
})

describe('R80 A2: GET /api/reports/shifts — aggregate tenant scope', () => {
  it('regular user brez locationId → 403 fail-closed, NI poizvedb na db', async () => {
    mockSession({ role: 'manager', locationId: null })

    const res = await GET(new Request('http://localhost:3000/api/reports/shifts'))

    expect(res.status).toBe(403)
    expect(mocks.shiftFindMany).not.toHaveBeenCalled()
    expect(mocks.shiftCount).not.toHaveBeenCalled()
    expect(mocks.shiftAggregate).not.toHaveBeenCalled()
  })

  it('manager loc-a: findMany + oba count + aggregate VSI dedijo locationId', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    const res = await GET(new Request('http://localhost:3000/api/reports/shifts'))
    expect(res.status).toBe(200)

    // findMany
    expect(mocks.shiftFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.shiftFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)

    // count ×2 (open + closed) — isti tenant filter
    expect(mocks.shiftCount).toHaveBeenCalledTimes(2)
    expect(mocks.shiftCount.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.shiftCount.mock.calls[0][0].where.status).toBe('open')
    expect(mocks.shiftCount.mock.calls[1][0].where.locationId).toBe(LOC_A)
    expect(mocks.shiftCount.mock.calls[1][0].where.status).toBe('closed')

    // aggregate (_sum finančnih polj) — isti tenant filter
    expect(mocks.shiftAggregate).toHaveBeenCalledTimes(1)
    expect(mocks.shiftAggregate.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('?locationId bypass: regular useru je query parameter IGNORIRAN', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    await GET(new Request(`http://localhost:3000/api/reports/shifts?locationId=${LOC_B}`))

    expect(mocks.shiftFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.shiftAggregate.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin (null scope): filter OPUŠČEN na vseh 4 poizvedbah — nikoli { locationId: null }', async () => {
    mockSession({ role: 'admin', locationId: null })

    await GET(new Request('http://localhost:3000/api/reports/shifts'))

    const findWhere = mocks.shiftFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(findWhere, 'locationId')).toBe(false)
    for (const call of mocks.shiftCount.mock.calls) {
      expect(Object.prototype.hasOwnProperty.call(call[0].where, 'locationId')).toBe(false)
    }
    const aggWhere = mocks.shiftAggregate.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(aggWhere, 'locationId')).toBe(false)
  })

  it('super-admin z ?locationId: cross-branch pogled na podano lokacijo', async () => {
    mockSession({ role: 'super_admin', locationId: null })

    await GET(new Request(`http://localhost:3000/api/reports/shifts?locationId=${LOC_B}`))

    expect(mocks.shiftFindMany.mock.calls[0][0].where.locationId).toBe(LOC_B)
    expect(mocks.shiftAggregate.mock.calls[0][0].where.locationId).toBe(LOC_B)
  })

  it('status filter se ZDRUŽI s tenant filterjem (count ostane scoped)', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    await GET(new Request('http://localhost:3000/api/reports/shifts?status=open'))

    // findMany where: locationId + status
    expect(mocks.shiftFindMany.mock.calls[0][0].where).toEqual({ locationId: LOC_A, status: 'open' })
    // count(where { ...where, status: 'open' }) — locationId ohranjen
    expect(mocks.shiftCount.mock.calls[0][0].where).toEqual({ locationId: LOC_A, status: 'open' })
  })
})
