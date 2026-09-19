// ============================================
// R80 — AGGREGATE SCOPE FIX A3: GET /api/operational-alerts
// ============================================
// REGRESIJA za HIGH aggregate leak (worklog 2-b):
//   Celoten GET je bil brez lokacijskega filtra (view_reports): 3 agregati
//   (order.count, orderItem.count, receipt.count) + findMany, ki je razkril
//   naročila (številke/zneski tujih miz), odprte izmene (startingCash) in
//   zalogo vseh tenantov.
//
// Fix: resolveTenantLocationIdOrThrow + locFilter v VSEH 9 poizvedbah.
// Schema poti: Order/Receipt/InventoryItem/Table/CashRegisterShift imajo
// lasten locationId; OrderItem NIMA → relacija order.locationId.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  orderFindMany: vi.fn(),
  orderCount: vi.fn(),
  orderItemCount: vi.fn(),
  inventoryItemFindMany: vi.fn(),
  receiptCount: vi.fn(),
  shiftFindMany: vi.fn(),
  tableFindMany: vi.fn(),
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
    order: { findMany: mocks.orderFindMany, count: mocks.orderCount },
    orderItem: { count: mocks.orderItemCount },
    inventoryItem: {
      findMany: mocks.inventoryItemFindMany,
      fields: { minQuantity: { toString: () => 'minQuantity' } },
    },
    receipt: { count: mocks.receiptCount },
    cashRegisterShift: { findMany: mocks.shiftFindMany },
    table: { findMany: mocks.tableFindMany },
  },
}))

import { GET } from '@/app/api/operational-alerts/route'

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
  mocks.orderFindMany.mockResolvedValue([])
  mocks.orderCount.mockResolvedValue(0)
  mocks.orderItemCount.mockResolvedValue(0)
  mocks.inventoryItemFindMany.mockResolvedValue([])
  mocks.receiptCount.mockResolvedValue(0)
  mocks.shiftFindMany.mockResolvedValue([])
  mocks.tableFindMany.mockResolvedValue([])
})

describe('R80 A3: GET /api/operational-alerts — aggregate tenant scope', () => {
  it('regular user brez locationId → 403 fail-closed, NI NOBENE poizvedbe', async () => {
    mockSession({ role: 'manager', locationId: null })

    const res = await GET(new Request('http://localhost:3000/api/operational-alerts'))

    expect(res.status).toBe(403)
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
    expect(mocks.orderCount).not.toHaveBeenCalled()
    expect(mocks.orderItemCount).not.toHaveBeenCalled()
    expect(mocks.inventoryItemFindMany).not.toHaveBeenCalled()
    expect(mocks.receiptCount).not.toHaveBeenCalled()
    expect(mocks.shiftFindMany).not.toHaveBeenCalled()
    expect(mocks.tableFindMany).not.toHaveBeenCalled()
  })

  it('manager loc-a: vse 3 order.findMany scoped', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    await GET(new Request('http://localhost:3000/api/operational-alerts'))

    expect(mocks.orderFindMany).toHaveBeenCalledTimes(3)
    for (const call of mocks.orderFindMany.mock.calls) {
      expect(call[0].where.locationId).toBe(LOC_A)
    }
  })

  it('manager loc-a: order.count + orderItem.count (prek order.locationId) scoped', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    await GET(new Request('http://localhost:3000/api/operational-alerts'))

    expect(mocks.orderCount).toHaveBeenCalledTimes(1)
    expect(mocks.orderCount.mock.calls[0][0].where.locationId).toBe(LOC_A)

    // OrderItem nima lastnega locationId — filter v gnezdenem order objektu
    expect(mocks.orderItemCount).toHaveBeenCalledTimes(1)
    const itemWhere = mocks.orderItemCount.mock.calls[0][0].where
    expect(itemWhere.order.locationId).toBe(LOC_A)
    expect(itemWhere.status).toBe('cancelled')
  })

  it('manager loc-a: receipt.count + cashRegisterShift + inventoryItem + table scoped', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    await GET(new Request('http://localhost:3000/api/operational-alerts'))

    expect(mocks.receiptCount).toHaveBeenCalledTimes(1)
    expect(mocks.receiptCount.mock.calls[0][0].where.locationId).toBe(LOC_A)

    expect(mocks.shiftFindMany).toHaveBeenCalledTimes(1)
    const shiftWhere = mocks.shiftFindMany.mock.calls[0][0].where
    expect(shiftWhere.locationId).toBe(LOC_A)
    expect(shiftWhere.status).toBe('open')

    expect(mocks.inventoryItemFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.inventoryItemFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)

    // Table ima lasten locationId — occupied mize tujih lokacij niso vidne
    expect(mocks.tableFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.tableFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.tableFindMany.mock.calls[0][0].where.status).toBe('occupied')
  })

  it('?locationId bypass: regular useru je query parameter IGNORIRAN', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    await GET(new Request(`http://localhost:3000/api/operational-alerts?locationId=${LOC_B}`))

    for (const call of mocks.orderFindMany.mock.calls) {
      expect(call[0].where.locationId).toBe(LOC_A)
    }
    expect(mocks.receiptCount.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin (null scope): filter OPUŠČEN v vseh poizvedbah — nikoli { locationId: null }', async () => {
    mockSession({ role: 'admin', locationId: null })

    await GET(new Request('http://localhost:3000/api/operational-alerts'))

    for (const call of mocks.orderFindMany.mock.calls) {
      expect(Object.prototype.hasOwnProperty.call(call[0].where, 'locationId')).toBe(false)
    }
    expect(
      Object.prototype.hasOwnProperty.call(mocks.orderCount.mock.calls[0][0].where, 'locationId'),
    ).toBe(false)
    const itemWhere = mocks.orderItemCount.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(itemWhere.order, 'locationId')).toBe(false)
    expect(
      Object.prototype.hasOwnProperty.call(mocks.receiptCount.mock.calls[0][0].where, 'locationId'),
    ).toBe(false)
    expect(
      Object.prototype.hasOwnProperty.call(mocks.shiftFindMany.mock.calls[0][0].where, 'locationId'),
    ).toBe(false)
    expect(
      Object.prototype.hasOwnProperty.call(
        mocks.inventoryItemFindMany.mock.calls[0][0].where,
        'locationId',
      ),
    ).toBe(false)
    expect(
      Object.prototype.hasOwnProperty.call(mocks.tableFindMany.mock.calls[0][0].where, 'locationId'),
    ).toBe(false)
  })

  it('super_admin z ?locationId: cross-branch pogled na podano lokacijo', async () => {
    mockSession({ role: 'super_admin', locationId: null })

    await GET(new Request(`http://localhost:3000/api/operational-alerts?locationId=${LOC_B}`))

    expect(mocks.orderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_B)
    expect(mocks.receiptCount.mock.calls[0][0].where.locationId).toBe(LOC_B)
    expect(mocks.tableFindMany.mock.calls[0][0].where.locationId).toBe(LOC_B)
  })
})
