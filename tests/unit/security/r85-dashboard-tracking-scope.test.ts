// ============================================
// R85 — H1 DASHBOARD + H2 DELIVERY-TRACKING TENANT SCOPE
// ============================================
// REGRESIJA za 2 POTRJENA HIGH (R84-FINAL-2, file:line dokazano):
//
//   H1 dashboard — VSI helperji (fetchTodayAggregation, fetchTablesStockRecent,
//      computeWeeklyRevenue, computeAvgWaitTime, computeWowComparison,
//      computeHeatmapData, fetchGuestAnalytics, fetchAnalyticsBreakdowns 7×)
//      so poizvedbo izvedli GLOBALNO: lokacijski admin je v enem klicu videl
//      prihodke, naročila, mize, nizke zaloge, zadnja naročila in goste VSEH
//      lokacij. fetchFursShiftCogs je za stockTransaction (COGS) uporabljal
//      globalni where (receipt/shift že scopeani prej).
//
//   H2 delivery-tracking — GET je vračal GPS sledenja, naslove in vozniške
//      kontakte VSEH lokacij; POST (GPS/status/assign) je omogočal
//      CROSS-TENANT WRITE na dostavi po znanem deliveryInfoId.
//      DeliveryTracking.locationId stolpec obstaja (indeksiran), ampak ni
//      bil nikoli žigosan → write poti zdaj žigosajo (self-heal), legacy
//      NULL je fail-closed (viden samo super-adminu).
//
// Vzorec: realen tenant-scope resolver (kakor R80 A2 / R84) + pinanje
// where-clavzov. null scope (super-admin) = PRAZEN filter, NIKOLI
// { locationId: null }.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  orderAggregate: vi.fn(),
  orderGroupBy: vi.fn(),
  orderFindMany: vi.fn(),
  orderItemGroupBy: vi.fn(),
  tableCount: vi.fn(),
  queryRaw: vi.fn(),
  menuItemFindMany: vi.fn(),
  guestCount: vi.fn(),
  receiptCount: vi.fn(),
  shiftFindFirst: vi.fn(),
  stockTransactionFindMany: vi.fn(),
  locationFindUnique: vi.fn(),
  // delivery-tracking
  trackingFindMany: vi.fn(),
  trackingFindUnique: vi.fn(),
  trackingUpdate: vi.fn(),
  trackingCreate: vi.fn(),
  infoFindMany: vi.fn(),
  infoFindUnique: vi.fn(),
  infoUpdate: vi.fn(),
  emitEvent: vi.fn(),
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

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimit,
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: { points: 100, duration: 60 },
}))

vi.mock('@/lib/event-emitter', () => ({
  emitEvent: mocks.emitEvent,
}))

function makeTx() {
  return {
    deliveryTracking: { update: mocks.trackingUpdate, create: mocks.trackingCreate, findUnique: mocks.trackingFindUnique },
    deliveryInfo: { update: mocks.infoUpdate },
  }
}

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      aggregate: mocks.orderAggregate,
      groupBy: mocks.orderGroupBy,
      findMany: mocks.orderFindMany,
    },
    orderItem: { groupBy: mocks.orderItemGroupBy },
    table: { count: mocks.tableCount },
    $queryRaw: mocks.queryRaw,
    menuItem: { findMany: mocks.menuItemFindMany },
    guest: { count: mocks.guestCount },
    receipt: { count: mocks.receiptCount },
    cashRegisterShift: { findFirst: mocks.shiftFindFirst },
    stockTransaction: { findMany: mocks.stockTransactionFindMany },
    location: { findUnique: mocks.locationFindUnique },
    deliveryTracking: {
      findMany: mocks.trackingFindMany,
      findUnique: mocks.trackingFindUnique,
      update: mocks.trackingUpdate,
      create: mocks.trackingCreate,
    },
    deliveryInfo: {
      findMany: mocks.infoFindMany,
      findUnique: mocks.infoFindUnique,
      update: mocks.infoUpdate,
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx())),
  },
  // createAuditLog je TOP-LEVEL export iz '@/lib/db' (ne lastnost db klienta)
  createAuditLog: vi.fn().mockResolvedValue({}),
}))

import { GET as dashboardGET } from '@/app/api/dashboard/route'
import { GET as trackingGET, POST as trackingPOST } from '@/app/api/delivery-tracking/route'

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

function mockSession(overrides: Record<string, unknown> = {}) {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A, ...overrides },
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
  mocks.orderAggregate.mockResolvedValue({ _sum: { total: 0, tip: 0, tax: 0, discount: 0 }, _count: 0, _avg: { total: 0 } })
  mocks.orderGroupBy.mockResolvedValue([])
  mocks.orderFindMany.mockResolvedValue([])
  mocks.orderItemGroupBy.mockResolvedValue([])
  mocks.tableCount.mockResolvedValue(0)
  mocks.queryRaw.mockResolvedValue([])
  mocks.menuItemFindMany.mockResolvedValue([])
  mocks.guestCount.mockResolvedValue(0)
  mocks.receiptCount.mockResolvedValue(0)
  mocks.shiftFindFirst.mockResolvedValue(null)
  mocks.stockTransactionFindMany.mockResolvedValue([])
  mocks.locationFindUnique.mockResolvedValue(null)
  mocks.trackingFindMany.mockResolvedValue([])
  mocks.trackingUpdate.mockResolvedValue({ id: 'tr-1' })
  mocks.trackingCreate.mockResolvedValue({ id: 'tr-new' })
  mocks.infoFindMany.mockResolvedValue([])
  mocks.infoUpdate.mockResolvedValue({})
  mocks.emitEvent.mockResolvedValue(undefined)
})

// ══════════════════════════════════════════════════════════════════
// A. H1 — DASHBOARD
// ══════════════════════════════════════════════════════════════════
describe('R85-A: GET /api/dashboard — H1 tenant scope', () => {
  it('regular user brez locationId → 403 fail-closed, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await dashboardGET(new Request('http://localhost:3000/api/dashboard'))
    expect(res.status).toBe(403)
    expect(mocks.orderAggregate).not.toHaveBeenCalled()
    expect(mocks.trackingFindMany).not.toHaveBeenCalled()
  })

  it('loc-bound admin: aggregate + groupBy + findMany + table.count vsebujejo locationId', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await dashboardGET(new Request('http://localhost:3000/api/dashboard'))
    expect(res.status).toBe(200)

    const aggWhere = mocks.orderAggregate.mock.calls[0][0].where
    expect(aggWhere.locationId).toBe(LOC_A)
    expect(aggWhere.paymentStatus).toBe('paid')

    // VSI groupBy klici (status + 4 analitika + heatmap + weekly) scoped
    for (const call of mocks.orderGroupBy.mock.calls) {
      expect(call[0].where.locationId).toBe(LOC_A)
    }
    // orderItem groupBy (kategorije/DDV/top) scope prek order.locationId
    for (const call of mocks.orderItemGroupBy.mock.calls) {
      expect(call[0].where.order.locationId).toBe(LOC_A)
    }
    expect(mocks.orderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.tableCount.mock.calls.every((c) => c[0].where.locationId === LOC_A)).toBe(true)
  })

  it('loc-bound admin: lowStock raw SQL vsebuje lokacijo kot bind param', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await dashboardGET(new Request('http://localhost:3000/api/dashboard'))
    expect(mocks.queryRaw).toHaveBeenCalled()
    // fragment Prisma.sql/Prisma.empty je objekt — preveri vsebino celotnega klica
    expect(JSON.stringify(mocks.queryRaw.mock.calls[0])).toContain(LOC_A)
  })

  it('loc-bound admin: guest.count scope prek orders.some.locationId (Guest nima lastnega locationId)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await dashboardGET(new Request('http://localhost:3000/api/dashboard'))
    expect(mocks.guestCount).toHaveBeenCalled()
    for (const call of mocks.guestCount.mock.calls) {
      expect(call[0].where.orders.some.locationId).toBe(LOC_A)
    }
  })

  it('loc-bound admin: fetchFursShiftCogs stockTransaction scope prek inventoryItem.locationId', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.locationFindUnique.mockResolvedValue({ fursCertPath: '/cert', fursEnvironment: 'test' })
    await dashboardGET(new Request('http://localhost:3000/api/dashboard'))
    expect(mocks.stockTransactionFindMany).toHaveBeenCalled()
    const where = mocks.stockTransactionFindMany.mock.calls[0][0].where
    expect(where.inventoryItem.locationId).toBe(LOC_A)
    // tudi receipt.count scoped
    for (const call of mocks.receiptCount.mock.calls) {
      expect(call[0].where.locationId).toBe(LOC_A)
    }
  })

  it('?locationId bypass je ignoriran za lokacijskega admina', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await dashboardGET(new Request(`http://localhost:3000/api/dashboard?locationId=${LOC_B}`))
    expect(mocks.orderAggregate.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin: filteri OPUŠČENI — nikoli { locationId: null }', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await dashboardGET(new Request('http://localhost:3000/api/dashboard'))
    expect(res.status).toBe(200)
    expect(Object.prototype.hasOwnProperty.call(mocks.orderAggregate.mock.calls[0][0].where, 'locationId')).toBe(false)
    for (const call of mocks.orderGroupBy.mock.calls) {
      expect(Object.prototype.hasOwnProperty.call(call[0].where, 'locationId')).toBe(false)
    }
    expect(mocks.tableCount.mock.calls.every((c) => !Object.prototype.hasOwnProperty.call(c[0].where, 'locationId'))).toBe(true)
    // raw SQL brez bind parametra lokacije (Prisma.empty)
    expect(JSON.stringify(mocks.queryRaw.mock.calls[0])).not.toContain(LOC_A)
    // guest.count brez orders.some filtra
    for (const call of mocks.guestCount.mock.calls) {
      expect(Object.prototype.hasOwnProperty.call(call[0].where, 'orders')).toBe(false)
    }
    // stockTransaction brez inventoryItem filtra
    expect(Object.prototype.hasOwnProperty.call(mocks.stockTransactionFindMany.mock.calls[0][0].where, 'inventoryItem')).toBe(false)
  })

  it('super-admin: ?locationId cross-branch filter je uporabljen (auditirano)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await dashboardGET(new Request(`http://localhost:3000/api/dashboard?locationId=${LOC_B}`))
    expect(mocks.orderAggregate.mock.calls[0][0].where.locationId).toBe(LOC_B)
  })
})

// ══════════════════════════════════════════════════════════════════
// B. H2 — DELIVERY-TRACKING GET
// ══════════════════════════════════════════════════════════════════
describe('R85-B: GET /api/delivery-tracking — H2 tenant scope', () => {
  it('regular user brez locationId → 403 fail-closed, NI poizvedb', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await trackingGET(new Request('http://localhost:3000/api/delivery-tracking'))
    expect(res.status).toBe(403)
    expect(mocks.trackingFindMany).not.toHaveBeenCalled()
  })

  it('loc-bound admin: findMany where.locationId', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await trackingGET(new Request('http://localhost:3000/api/delivery-tracking'))
    expect(res.status).toBe(200)
    expect(mocks.trackingFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('status/driverName filter se spošuje poleg scope-a', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await trackingGET(new Request(`http://localhost:3000/api/delivery-tracking?status=on_the_way&driverName=Marko`))
    const where = mocks.trackingFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A)
    expect(where.status).toBe('on_the_way')
    expect(where.driverName).toEqual({ contains: 'Marko' })
  })

  it('?locationId bypass je ignoriran za lokacijskega admina', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await trackingGET(new Request(`http://localhost:3000/api/delivery-tracking?locationId=${LOC_B}`))
    expect(mocks.trackingFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin: filter OPUŠČEN — legacy NULL vrstice vidne globalno', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await trackingGET(new Request('http://localhost:3000/api/delivery-tracking'))
    expect(Object.prototype.hasOwnProperty.call(mocks.trackingFindMany.mock.calls[0][0].where, 'locationId')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// C. H2 — DELIVERY-TRACKING POST (GPS / STATUS / ASSIGN)
// ══════════════════════════════════════════════════════════════════
describe('R85-C: POST /api/delivery-tracking — H2 cross-tenant WRITE guardi', () => {
  it('GPS: tuja lokacija (tracking.locationId=LOC_B) → 404, NI update-a', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.trackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', locationId: LOC_B })
    const res = await trackingPOST(new Request('http://localhost:3000/api/delivery-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryInfoId: 'di-1', latitude: 46.05, longitude: 14.5 }),
    }))
    expect(res.status).toBe(404)
    expect(mocks.trackingUpdate).not.toHaveBeenCalled()
  })

  it('GPS: legacy NULL + order na LOC_A → update z self-heal žigom', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.trackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', locationId: null })
    mocks.infoFindUnique.mockResolvedValue({ id: 'di-1', order: { locationId: LOC_A } })
    const res = await trackingPOST(new Request('http://localhost:3000/api/delivery-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryInfoId: 'di-1', latitude: 46.05, longitude: 14.5 }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.trackingUpdate).toHaveBeenCalledTimes(1)
    const data = mocks.trackingUpdate.mock.calls[0][0].data
    expect(data.locationId).toBe(LOC_A)
    expect(data.currentLat).toBe(46.05)
  })

  it('GPS: legacy NULL + neizpeljiva lokacija (order brez lokacije) → 404 fail-closed', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.trackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', locationId: null })
    mocks.infoFindUnique.mockResolvedValue({ id: 'di-1', order: { locationId: null } })
    const res = await trackingPOST(new Request('http://localhost:3000/api/delivery-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryInfoId: 'di-1', latitude: 46.05, longitude: 14.5 }),
    }))
    expect(res.status).toBe(404)
    expect(mocks.trackingUpdate).not.toHaveBeenCalled()
  })

  it('GPS: super-admin + NULL zapis → dovoljen, brez žiga (brez dokaza o lokaciji)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.trackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', locationId: null })
    const res = await trackingPOST(new Request('http://localhost:3000/api/delivery-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryInfoId: 'di-1', latitude: 46.05, longitude: 14.5 }),
    }))
    expect(res.status).toBe(200)
    const data = mocks.trackingUpdate.mock.calls[0][0].data
    expect(Object.prototype.hasOwnProperty.call(data, 'locationId')).toBe(false)
  })

  it('STATUS: tuja lokacija → 404, NI transakcije', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.trackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', locationId: LOC_B })
    const res = await trackingPOST(new Request('http://localhost:3000/api/delivery-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryInfoId: 'di-1', status: 'delivered' }),
    }))
    expect(res.status).toBe(404)
    expect(mocks.trackingUpdate).not.toHaveBeenCalled()
    expect(mocks.infoUpdate).not.toHaveBeenCalled()
  })

  it('STATUS: lastna lokacija (tracking.locationId=LOC_A) → transakcija OK', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    // handleStatusUpdate kliče findUnique točno ENKRAT (guard); tx uporablja update
    mocks.trackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', locationId: LOC_A, driverName: 'Marko' })
    mocks.trackingUpdate.mockResolvedValue({ id: 'tr-1', estimatedArrival: null })
    mocks.infoFindUnique.mockResolvedValue({ id: 'di-1', order: { id: 'o-1', orderNumber: 7, locationId: LOC_A } })
    const res = await trackingPOST(new Request('http://localhost:3000/api/delivery-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryInfoId: 'di-1', status: 'delivered', customerRating: 5 }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.trackingUpdate).toHaveBeenCalled()
    expect(mocks.infoUpdate).toHaveBeenCalled()
  })

  it('ASSIGN: dostava na tuji lokaciji (order.locationId=LOC_B) → 404, NI transakcije', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.infoFindUnique.mockResolvedValue({ id: 'di-1', order: { locationId: LOC_B } })
    const res = await trackingPOST(new Request('http://localhost:3000/api/delivery-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryInfoId: 'di-1', driverName: 'Marko', driverPhone: '040123456' }),
    }))
    expect(res.status).toBe(404)
    expect(mocks.trackingCreate).not.toHaveBeenCalled()
    expect(mocks.trackingUpdate).not.toHaveBeenCalled()
  })

  it('ASSIGN: standalone dostava (brez ordera) za lokacijskega admina → 404 fail-closed', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.infoFindUnique.mockResolvedValue({ id: 'di-1', order: null })
    const res = await trackingPOST(new Request('http://localhost:3000/api/delivery-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryInfoId: 'di-1', driverName: 'Marko', driverPhone: '040123456' }),
    }))
    expect(res.status).toBe(404)
    expect(mocks.trackingCreate).not.toHaveBeenCalled()
  })

  it('ASSIGN: dostava na lastni lokaciji → create z žigom locationId (201)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.infoFindUnique.mockResolvedValue({ id: 'di-1', order: { locationId: LOC_A } })
    mocks.trackingFindUnique.mockResolvedValue(null)
    const res = await trackingPOST(new Request('http://localhost:3000/api/delivery-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryInfoId: 'di-1', driverName: 'Marko', driverPhone: '040123456' }),
    }))
    expect(res.status).toBe(201)
    expect(mocks.trackingCreate).toHaveBeenCalledTimes(1)
    expect(mocks.trackingCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('ASSIGN: super-admin + standalone dostava → create z NULL locationId (legacy kompatibilen)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.infoFindUnique.mockResolvedValue({ id: 'di-1', order: null })
    mocks.trackingFindUnique.mockResolvedValue(null)
    const res = await trackingPOST(new Request('http://localhost:3000/api/delivery-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryInfoId: 'di-1', driverName: 'Marko', driverPhone: '040123456' }),
    }))
    expect(res.status).toBe(201)
    expect(mocks.trackingCreate.mock.calls[0][0].data.locationId).toBeNull()
  })

  it('ASSIGN: DRIVER_ALREADY_ASSIGNED regresa ostane (409)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.infoFindUnique.mockResolvedValue({ id: 'di-1', order: { locationId: LOC_A } })
    mocks.trackingFindUnique.mockResolvedValue({ id: 'tr-1', deliveryInfoId: 'di-1', locationId: LOC_A, driverName: 'Drugi voznik' })
    const res = await trackingPOST(new Request('http://localhost:3000/api/delivery-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryInfoId: 'di-1', driverName: 'Marko', driverPhone: '040123456' }),
    }))
    expect(res.status).toBe(409)
  })

  it('regular user brez locationId → 403 fail-closed, NI pisnih operacij', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await trackingPOST(new Request('http://localhost:3000/api/delivery-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryInfoId: 'di-1', latitude: 46.05, longitude: 14.5 }),
    }))
    expect(res.status).toBe(403)
    expect(mocks.trackingUpdate).not.toHaveBeenCalled()
    expect(mocks.trackingCreate).not.toHaveBeenCalled()
    expect(mocks.infoFindUnique).not.toHaveBeenCalled()
  })
})
