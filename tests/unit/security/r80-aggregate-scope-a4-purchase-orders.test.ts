// ============================================
// R80 — AGGREGATE SCOPE FIX A4: GET /api/purchase-orders
// ============================================
// REGRESIJA za HIGH aggregate leak (worklog 2-b):
//   purchaseOrder.findMany + count je prej vračal nabavna naročila VSEH
//   lokacij (where je imel samo status/supplierId; manage_inventory) —
//   dobavitelji in zneski tujih tenantov.
//
// Fix: resolveTenantLocationIdOrThrow + tenant filter v skupnem where
// (findMany + count oba dedita). PurchaseOrder ima lasten locationId
// stolpec (schema:1885). POST pot je že resolvala lokacijo (ni spremembe).
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  poFindMany: vi.fn(),
  poCount: vi.fn(),
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
    purchaseOrder: { findMany: mocks.poFindMany, count: mocks.poCount },
  },
}))

import { GET } from '@/app/api/purchase-orders/route'

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
  mocks.poFindMany.mockResolvedValue([])
  mocks.poCount.mockResolvedValue(0)
})

describe('R80 A4: GET /api/purchase-orders — aggregate tenant scope', () => {
  it('regular user brez locationId → 403 fail-closed, NI poizvedb na db', async () => {
    mockSession({ role: 'manager', locationId: null })

    const res = await GET(new Request('http://localhost:3000/api/purchase-orders'))

    expect(res.status).toBe(403)
    expect(mocks.poFindMany).not.toHaveBeenCalled()
    expect(mocks.poCount).not.toHaveBeenCalled()
  })

  it('manager loc-a: findMany + count dedita locationId', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    const res = await GET(new Request('http://localhost:3000/api/purchase-orders'))
    expect(res.status).toBe(200)

    expect(mocks.poFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.poFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)

    // count uporablja ISTI where (tenant filter ne izgine pri count)
    expect(mocks.poCount).toHaveBeenCalledTimes(1)
    expect(mocks.poCount.mock.calls[0][0].where).toEqual(
      mocks.poFindMany.mock.calls[0][0].where,
    )
  })

  it('status/supplierId filter se ZDRUŽI z tenant filterjem', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    await GET(
      new Request('http://localhost:3000/api/purchase-orders?status=sent&supplierId=sup-1'),
    )

    expect(mocks.poFindMany.mock.calls[0][0].where).toEqual({
      locationId: LOC_A,
      status: 'sent',
      supplierId: 'sup-1',
    })
    expect(mocks.poCount.mock.calls[0][0].where).toEqual({
      locationId: LOC_A,
      status: 'sent',
      supplierId: 'sup-1',
    })
  })

  it('?locationId bypass: regular useru je query parameter IGNORIRAN', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    await GET(new Request(`http://localhost:3000/api/purchase-orders?locationId=${LOC_B}`))

    expect(mocks.poFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin (null scope): filter OPUŠČEN — nikoli { locationId: null }', async () => {
    mockSession({ role: 'admin', locationId: null })

    await GET(new Request('http://localhost:3000/api/purchase-orders'))

    const where = mocks.poFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(mocks.poCount.mock.calls[0][0].where, 'locationId')).toBe(false)
  })

  it('super_admin z ?locationId: cross-branch pogled na podano lokacijo', async () => {
    mockSession({ role: 'super_admin', locationId: null })

    await GET(new Request(`http://localhost:3000/api/purchase-orders?locationId=${LOC_B}`))

    expect(mocks.poFindMany.mock.calls[0][0].where.locationId).toBe(LOC_B)
    expect(mocks.poCount.mock.calls[0][0].where.locationId).toBe(LOC_B)
  })
})
