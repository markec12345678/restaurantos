// ============================================
// R120 / EPIC #115 §4 — ROUTE GET /api/inventory/batches
// ============================================
// Scope (fail-closed 403), computed flags (isExpired/isExpiringSoon/daysToExpiry),
// summary agregati (§4: expiry soon · expired) in lokacijski scope where-pin
// (lokacija + skupni vir NULL).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const LOC_A = 'loc-a'
const LOC_B = 'loc-b'
const DAY = 24 * 60 * 60 * 1000
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY)

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: { inventoryBatch: { findMany: mocks.findMany } },
  createAuditLog: vi.fn(),
}))

vi.mock('@/lib/decimal', () => ({
  deepToNumbers: <T>(v: T): T => v,
}))

vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return { ...actual, requireAuth: (...args: unknown[]) => mocks.requireAuth(...args) }
})

import { GET } from '@/app/api/inventory/batches/route'

function session(overrides: Record<string, unknown> = {}) {
  return {
    session: {
      employeeId: 'e1', role: 'manager', locationId: LOC_A,
      permissions: ['manage_inventory'], ...overrides,
    },
    error: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue(session())
})

describe('R120 route: GET /api/inventory/batches', () => {
  it('I1: fail-closed 403 — non-admin brez session lokacije', async () => {
    mocks.requireAuth.mockResolvedValue(session({ role: 'manager', locationId: null }))
    const res = await GET(new Request('http://localhost:3000/api/inventory/batches'))
    expect(res.status).toBe(403)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('I2: 401 brez auth', async () => {
    mocks.requireAuth.mockResolvedValue({ session: null, error: new Response('unauth', { status: 401 }) })
    const res = await GET(new Request('http://localhost:3000/api/inventory/batches'))
    expect(res.status).toBe(401)
  })

  it('I3: computed flags + summary (expired / expiringSoon / active / exhausted)', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'b1', inventoryItemId: 'i1', lotNumber: 'L-1', locationId: LOC_A, supplierId: null, supplierName: 'Sup', receivedAt: new Date(), expiryDate: daysFromNow(-1), quantityInitial: 5, quantityRemaining: 5, unitCost: 1, status: 'ACTIVE', note: '', inventoryItem: { id: 'i1', name: 'Moka', unit: 'kg', quantity: 10, minQuantity: 2, locationId: LOC_A }, supplier: null },
      { id: 'b2', inventoryItemId: 'i1', lotNumber: 'L-2', locationId: LOC_A, supplierId: null, supplierName: '', receivedAt: new Date(), expiryDate: daysFromNow(3), quantityInitial: 5, quantityRemaining: 2, unitCost: 1, status: 'ACTIVE', note: '', inventoryItem: { id: 'i1', name: 'Moka', unit: 'kg', quantity: 10, minQuantity: 2, locationId: LOC_A }, supplier: null },
      { id: 'b3', inventoryItemId: 'i1', lotNumber: 'L-3', locationId: LOC_A, supplierId: null, supplierName: '', receivedAt: new Date(), expiryDate: daysFromNow(30), quantityInitial: 5, quantityRemaining: 0, unitCost: 1, status: 'EXHAUSTED', note: '', inventoryItem: { id: 'i1', name: 'Moka', unit: 'kg', quantity: 10, minQuantity: 2, locationId: LOC_A }, supplier: null },
      { id: 'b4', inventoryItemId: 'i1', lotNumber: 'L-4', locationId: LOC_A, supplierId: null, supplierName: '', receivedAt: new Date(), expiryDate: null, quantityInitial: 5, quantityRemaining: 5, unitCost: 1, status: 'ACTIVE', note: '', inventoryItem: { id: 'i1', name: 'Moka', unit: 'kg', quantity: 10, minQuantity: 2, locationId: LOC_A }, supplier: null },
    ])
    const res = await GET(new Request('http://localhost:3000/api/inventory/batches'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.summary.expired).toBe(1)
    expect(data.summary.expiringSoon).toBe(1)
    expect(data.summary.active).toBe(3)
    expect(data.summary.exhausted).toBe(1)
    const b1 = data.batches.find((b: { id: string }) => b.id === 'b1')
    expect(b1.isExpired).toBe(true)
    expect(b1.daysToExpiry).toBeLessThanOrEqual(0)
    const b2 = data.batches.find((b: { id: string }) => b.id === 'b2')
    expect(b2.isExpiringSoon).toBe(true)
    expect(b2.isExpired).toBe(false)
    const b4 = data.batches.find((b: { id: string }) => b.id === 'b4')
    expect(b4.expiryDate).toBeNull()
    expect(b4.isExpiringSoon).toBe(false)
    expect(b4.isExpired).toBe(false)
  })

  it('I4: lokacijski scope where-pin — lokacija + skupni vir (NULL)', async () => {
    mocks.findMany.mockResolvedValue([])
    await GET(new Request('http://localhost:3000/api/inventory/batches'))
    const where = mocks.findMany.mock.calls[0][0].where
    expect(where.OR).toEqual([{ locationId: LOC_A }, { locationId: null }])
  })

  it('I5: super-admin brez session lokacije z izrecnim ?locationId= → izrecen scope', async () => {
    mocks.requireAuth.mockResolvedValue(session({ role: 'super_admin', locationId: null }))
    mocks.findMany.mockResolvedValue([])
    await GET(new Request(`http://localhost:3000/api/inventory/batches?locationId=${LOC_B}`))
    const where = mocks.findMany.mock.calls[0][0].where
    expect(where.OR).toEqual([{ locationId: LOC_B }, { locationId: null }])
  })

  it('I6: ?expiringWithinDays=7 → ACTIVE + expiry window [now, now+7d]', async () => {
    mocks.findMany.mockResolvedValue([])
    const before = Date.now()
    await GET(new Request('http://localhost:3000/api/inventory/batches?expiringWithinDays=7'))
    const where = mocks.findMany.mock.calls[0][0].where
    expect(where.status).toBe('ACTIVE')
    expect(where.expiryDate.not).toBeNull()
    expect(where.expiryDate.lte.getTime()).toBeGreaterThanOrEqual(before + 7 * DAY - 1000)
    expect(where.expiryDate.gte.getTime()).toBeGreaterThanOrEqual(before - 1000)
  })

  it('I7: ?expired=1 → samo pretečene serije (expiryDate lt now)', async () => {
    mocks.findMany.mockResolvedValue([])
    const before = Date.now()
    await GET(new Request('http://localhost:3000/api/inventory/batches?expired=1'))
    const where = mocks.findMany.mock.calls[0][0].where
    expect(where.expiryDate.lt.getTime()).toBeLessThanOrEqual(before + 1000)
  })
})
