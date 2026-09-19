// ============================================
// R80 — AGGREGATE SCOPE FIX A1: POST /api/ai/nl-query
// ============================================
// REGRESIJA za HIGH aggregate leak (worklog 2-a):
//   Vseh 6 NL poizvedb (revenue, top_items groupBy, peak_hour, cancellations
//   count ×2, tips, employee_perf groupBy) je prej agregiralo podatke VSEH
//   tenantov (revenue/tips/VAT/imena zaposlenih) — where brez locationId.
//
// Fix: resolveTenantLocationIdOrThrow na vrhu handlerja + locFilter v VSakem
// where. OrderItem nima lastnega locationId → pot prek relacije
// order.locationId (locFilter spreadan V order objekt).
//
// Test pristop (enoten vzorec idor-regression.test.ts): mock requireAuth +
// db, REALNI resolveTenantLocationIdOrThrow prek shim-a, kličemo route handler
// in assertamo where clause vsakega agregata.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  orderFindMany: vi.fn(),
  orderCount: vi.fn(),
  orderGroupBy: vi.fn(),
  orderItemGroupBy: vi.fn(),
  orderItemCount: vi.fn(),
  menuItemFindMany: vi.fn(),
  employeeFindMany: vi.fn(),
}))

// Auth middleware: mock requireAuth, REALNI tenant-scope resolver (konec-do-konec wiring)
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
    order: {
      findMany: mocks.orderFindMany,
      count: mocks.orderCount,
      groupBy: mocks.orderGroupBy,
    },
    orderItem: {
      groupBy: mocks.orderItemGroupBy,
      count: mocks.orderItemCount,
    },
    menuItem: { findMany: mocks.menuItemFindMany },
    employee: { findMany: mocks.employeeFindMany },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: vi.fn(async () => ({ allowed: true, retryAfterMs: 0 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  AI_ASSISTANT_LIMIT: {},
}))

import { POST } from '@/app/api/ai/nl-query/route'

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

function makeReq(question: string): Request {
  return new Request('http://localhost:3000/api/ai/nl-query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
  })
}

const orderRow = { total: 100, tip: 10, tax: 22, paidAt: new Date().toISOString() }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.orderFindMany.mockResolvedValue([orderRow])
  mocks.orderCount.mockResolvedValue(3)
  mocks.orderGroupBy.mockResolvedValue([
    { employeeId: 'emp-1', _sum: { total: 100, tip: 10 }, _count: 1 },
  ])
  mocks.orderItemGroupBy.mockResolvedValue([
    { menuItemId: 'mi-1', _sum: { quantity: 5 }, _count: 2 },
  ])
  mocks.orderItemCount.mockResolvedValue(2)
  mocks.menuItemFindMany.mockResolvedValue([{ id: 'mi-1', name: 'Pizza' }])
  mocks.employeeFindMany.mockResolvedValue([{ id: 'emp-1', name: 'Metka' }])
})

describe('R80 A1: POST /api/ai/nl-query — aggregate tenant scope', () => {
  it('regular user brez locationId → 403 fail-closed, NI poizvedb na db', async () => {
    mockSession({ role: 'manager', locationId: null })

    const res = await POST(makeReq('kakšen je bil promet danes'))

    expect(res.status).toBe(403)
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
    expect(mocks.orderGroupBy).not.toHaveBeenCalled()
    expect(mocks.orderItemGroupBy).not.toHaveBeenCalled()
    expect(mocks.orderCount).not.toHaveBeenCalled()
    expect(mocks.orderItemCount).not.toHaveBeenCalled()
    expect(mocks.employeeFindMany).not.toHaveBeenCalled()
  })

  it('revenue: order.findMany where vsebuje locationId seje', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    const res = await POST(makeReq('kakšen je bil promet danes'))

    expect(res.status).toBe(200)
    expect(mocks.orderFindMany).toHaveBeenCalledTimes(1)
    const where = mocks.orderFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A)
    expect(where.paymentStatus).toBe('paid')
  })

  it('top_items: orderItem.groupBy scope prek order.locationId + menuItem lookup scoped', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    await POST(makeReq('kateri je najbolj prodajan artikel'))

    // OrderItem NIMA locationId — filter gre v gnezdeni order objekt
    const groupWhere = mocks.orderItemGroupBy.mock.calls[0][0].where
    expect(groupWhere.order.locationId).toBe(LOC_A)
    expect(groupWhere.voided).toBe(false)
    // Imena artiklov: Menu pot prek category.menu.locationId
    const menuWhere = mocks.menuItemFindMany.mock.calls[0][0].where
    expect(menuWhere.category.menu.locationId).toBe(LOC_A)
  })

  it('peak_hour: order.findMany scoped', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    await POST(makeReq('kdaj je bil vrhunec prometa danes'))

    const where = mocks.orderFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A)
  })

  it('cancellations: order.count + orderItem.count (order.locationId) scoped', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    await POST(makeReq('koliko preklicov smo imeli danes'))

    expect(mocks.orderCount).toHaveBeenCalledTimes(1)
    expect(mocks.orderCount.mock.calls[0][0].where.locationId).toBe(LOC_A)

    expect(mocks.orderItemCount).toHaveBeenCalledTimes(1)
    const itemWhere = mocks.orderItemCount.mock.calls[0][0].where
    expect(itemWhere.order.locationId).toBe(LOC_A)
  })

  it('tips: order.findMany scoped', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    await POST(makeReq('koliko tips smo zbrali danes'))

    expect(mocks.orderFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.orderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('employee_perf: order.groupBy + employee.findMany scoped (imena zaposlenih ne fulajo čez tenant)', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    await POST(makeReq('performanse zaposlenih ta teden'))

    // order.groupBy ima lasten locationId (Order.locationId)
    expect(mocks.orderGroupBy).toHaveBeenCalledTimes(1)
    expect(mocks.orderGroupBy.mock.calls[0][0].where.locationId).toBe(LOC_A)

    // employee lookup ne razkrije tujih imen
    expect(mocks.employeeFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.employeeFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('?locationId bypass: regular useru je query parameter IGNORIRAN (session zmaguje)', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    const req = new Request(`http://localhost:3000/api/ai/nl-query?locationId=${LOC_B}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'kakšen je bil promet danes' }),
    })
    await POST(req)

    expect(mocks.orderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin (null scope): filter je OPUŠČEN — nikoli { locationId: null }', async () => {
    mockSession({ role: 'admin', locationId: null })

    await POST(makeReq('kakšen je bil promet danes'))
    expect(mocks.orderFindMany).toHaveBeenCalledTimes(1)
    const where = mocks.orderFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)

    await POST(makeReq('performanse zaposlenih ta teden'))
    const groupWhere = mocks.orderGroupBy.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(groupWhere, 'locationId')).toBe(false)
    const empWhere = mocks.employeeFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(empWhere, 'locationId')).toBe(false)

    await POST(makeReq('kateri je najbolj prodajan artikel'))
    const itemWhere = mocks.orderItemGroupBy.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(itemWhere.order, 'locationId')).toBe(false)
  })

  it('POST (brez searchParams): super-admin vedno globalni pogled — ?locationId v URL se ne konzultira', async () => {
    // NL query je POST z JSON bodyjem — route resolverju poda null searchParams,
    // zato cross-branch ?locationId mehanizem (GET rute) tukaj ne obstaja.
    mockSession({ role: 'super_admin', locationId: null })

    const req = new Request(`http://localhost:3000/api/ai/nl-query?locationId=${LOC_B}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'kakšen je bil promet danes' }),
    })
    await POST(req)

    const where = mocks.orderFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })
})
