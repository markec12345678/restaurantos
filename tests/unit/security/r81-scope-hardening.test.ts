// ============================================
// R81 — SCOPE HARDENING (BUGHUNT-RO-6, runda 81) — regression tests
//
// Pokriva 3 fiksne iz R81-B:
// 1. HACCP PUT/DELETE by-ID tenant guard (runda 80 leftover): `findUnique
//    ({ where: { id } })` je bil brez lokacijskega checka — lokacijsko vezan
//    admin je lahko spreminjal/arhiviral HACCP (food-safety, EU 852/2004)
//    vnose TUJIH tenantov. Fix: session.locationId vs existing.locationId,
//    izven scope-a → 404 notInScopeResponse('HACCP vnos'); legacy NULL
//    locationId vrstice fail-closed (404); super-admin (null) unrestricted.
// 2. setup/status enumeration: javni endpoint je razkrival točne
//    counts.{employees,locations,settings} anonimnim klicateljem — po
//    inicializaciji je counts=null (first-run ostane resničen).
// 3. Subscription platform-admin gate: subscriptionInvoice.aggregate
//    (totalRevenue čez VSE tenante) + subscription.findFirst (tuji
//    email/taxId) sta bila dosegljiva vsakemu 'admin' — zdaj samo
//    admin/super_admin BREZ locationId (role gate, brez tenant-scope).
//
// Mock pristop: kot r80-aggregate-scope-c.test.ts — vi.hoisted + vi.mock
// '@/lib/db' in '@/lib/auth-middleware', direkten klic route handlerjev.
// requireAuth je popolnoma mockan (session nadziramo brez HTTP tokena);
// zod validacija + api-utils ostanejo REALNI (testira produkcijsko pot).
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocki (vi.hoisted zaradi vitest hoisting) ---
const {
  mockRequireAuth,
  mockHaccpFindUnique,
  mockHaccpUpdate,
  mockSubscriptionFindFirst,
  mockSubscriptionCreate,
  mockInvoiceCount,
  mockInvoiceAggregate,
  mockTransaction,
  mockLocationCount,
  mockEmployeeCount,
  mockSettingsCount,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockHaccpFindUnique: vi.fn(),
  mockHaccpUpdate: vi.fn(),
  mockSubscriptionFindFirst: vi.fn(),
  mockSubscriptionCreate: vi.fn(),
  mockInvoiceCount: vi.fn(),
  mockInvoiceAggregate: vi.fn(),
  mockTransaction: vi.fn(),
  mockLocationCount: vi.fn(),
  mockEmployeeCount: vi.fn(),
  mockSettingsCount: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', async () => {
  // R86-2b: haccp PUT/DELETE zdaj kliče resolveTenantLocationIdOrThrow —
  // re-export REALNEGA resolverja (isti vzorec kot r84/r85 security testi).
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: mockRequireAuth,
    resolveTenantLocationId: tenantScope.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: tenantScope.tenantScopeToWhere,
  }
})

// Eksplicitni db mock (overrides globalni Proxy mock iz tests/setup.ts) —
// da lahko trdimo KATERE poizvedbe so (ne) izvedene.
vi.mock('@/lib/db', () => ({
  db: {
    haccpEntry: {
      findUnique: mockHaccpFindUnique,
      update: mockHaccpUpdate,
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    subscription: {
      findFirst: mockSubscriptionFindFirst,
      create: mockSubscriptionCreate,
      update: vi.fn(),
    },
    subscriptionInvoice: {
      count: mockInvoiceCount,
      aggregate: mockInvoiceAggregate,
    },
    $transaction: mockTransaction,
    location: { count: mockLocationCount },
    employee: { count: mockEmployeeCount },
    restaurantSettings: { count: mockSettingsCount },
  },
}))

import { PUT as putHaccp, DELETE as deleteHaccp } from '@/app/api/haccp/route'
import { GET as getSubscription, POST as postSubscription, PATCH as patchSubscription } from '@/app/api/subscription/route'
import { GET as getSetupStatus } from '@/app/api/setup/status/route'

// --- Helperji ---
function makeSession(locationId: string | null, role = 'admin') {
  return { employeeId: 'emp-1', role, locationId, permissions: ['admin'] }
}

function mockAuth(locationId: string | null, role = 'admin') {
  mockRequireAuth.mockResolvedValue({ session: makeSession(locationId, role), error: null })
}

function makePutReq(body: unknown): Request {
  return new Request('http://localhost:3000/api/haccp', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteReq(id: string): Request {
  return new Request(`http://localhost:3000/api/haccp?id=${id}`, { method: 'DELETE' })
}

const BASE = 'http://localhost:3000/api/subscription'

// ============================================
// 1) HACCP PUT/DELETE by-ID tenant scope guard
// ============================================
describe('R81: HACCP PUT/DELETE by-ID scope guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PUT: lokacijski admin + tuj vnos (loc-2) → 404 notInScope, update se NE izvede', async () => {
    mockAuth('loc-1')
    mockHaccpFindUnique.mockResolvedValue({ id: 'h-1', locationId: 'loc-2', title: 'Tuj vnos' })

    const res = await putHaccp(makePutReq({ id: 'h-1', title: 'Sprememba' }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toContain('HACCP vnos')
    // Guard mora blokirati ŠELE po fetch-u existing, ampak PRED update-om:
    expect(mockHaccpFindUnique).toHaveBeenCalledWith({ where: { id: 'h-1' } })
    expect(mockHaccpUpdate).not.toHaveBeenCalled()
  })

  it('PUT: lastna lokacija (loc-1) → update se izvede (200)', async () => {
    mockAuth('loc-1')
    mockHaccpFindUnique.mockResolvedValue({ id: 'h-1', locationId: 'loc-1', title: 'Star' })
    mockHaccpUpdate.mockResolvedValue({ id: 'h-1', locationId: 'loc-1', title: 'Nov' })

    const res = await putHaccp(makePutReq({ id: 'h-1', title: 'Nov' }))

    expect(res.status).toBe(200)
    expect(mockHaccpUpdate).toHaveBeenCalledTimes(1)
    expect(mockHaccpUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'h-1' } }),
    )
  })

  it('PUT: super-admin (locationId=null) → tudi tuj vnos (loc-2) je dosegljiv', async () => {
    mockAuth(null)
    mockHaccpFindUnique.mockResolvedValue({ id: 'h-1', locationId: 'loc-2', title: 'Tuj' })
    mockHaccpUpdate.mockResolvedValue({ id: 'h-1', locationId: 'loc-2', title: 'Nov' })

    const res = await putHaccp(makePutReq({ id: 'h-1', title: 'Nov' }))

    expect(res.status).toBe(200)
    expect(mockHaccpUpdate).toHaveBeenCalledTimes(1)
  })

  it('PUT: legacy NULL locationId vrstica + lokacijska seja → 404 (fail-closed)', async () => {
    mockAuth('loc-1')
    mockHaccpFindUnique.mockResolvedValue({ id: 'h-1', locationId: null, title: 'Legacy' })

    const res = await putHaccp(makePutReq({ id: 'h-1', title: 'Nov' }))

    expect(res.status).toBe(404)
    expect(mockHaccpUpdate).not.toHaveBeenCalled()
  })

  it('PUT: vnos ne obstaja → 404 not-found (obstoječe vedenje), update se NE izvede', async () => {
    mockAuth('loc-1')
    mockHaccpFindUnique.mockResolvedValue(null)

    const res = await putHaccp(makePutReq({ id: 'h-404', title: 'X' }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('HACCP vnos ni najden')
    expect(mockHaccpUpdate).not.toHaveBeenCalled()
  })

  it('DELETE: lokacijski admin + tuj vnos → 404, soft-archive se NE izvede', async () => {
    mockAuth('loc-1')
    mockHaccpFindUnique.mockResolvedValue({ id: 'h-1', locationId: 'loc-2', status: 'ok' })

    const res = await deleteHaccp(makeDeleteReq('h-1'))

    expect(res.status).toBe(404)
    // Cross-tenant WRITE: arhiviranje (skrivanje) tujega inšpekcijskega
    // zapisa se NE sme izvesti:
    expect(mockHaccpUpdate).not.toHaveBeenCalled()
  })

  it('DELETE: lastna lokacija → soft-archive status=archived', async () => {
    mockAuth('loc-1')
    mockHaccpFindUnique.mockResolvedValue({ id: 'h-1', locationId: 'loc-1', status: 'ok' })
    mockHaccpUpdate.mockResolvedValue({ id: 'h-1', locationId: 'loc-1', status: 'archived' })

    const res = await deleteHaccp(makeDeleteReq('h-1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockHaccpUpdate).toHaveBeenCalledWith({
      where: { id: 'h-1' },
      data: { status: 'archived' },
    })
  })

  it('DELETE: super-admin (locationId=null) → tuj vnos je arhiviran', async () => {
    mockAuth(null)
    mockHaccpFindUnique.mockResolvedValue({ id: 'h-1', locationId: 'loc-2', status: 'ok' })
    mockHaccpUpdate.mockResolvedValue({ id: 'h-1', status: 'archived' })

    const res = await deleteHaccp(makeDeleteReq('h-1'))

    expect(res.status).toBe(200)
    expect(mockHaccpUpdate).toHaveBeenCalledTimes(1)
  })

  it('DELETE: legacy NULL locationId vrstica + lokacijska seja → 404 (fail-closed)', async () => {
    mockAuth('loc-1')
    mockHaccpFindUnique.mockResolvedValue({ id: 'h-1', locationId: null, status: 'ok' })

    const res = await deleteHaccp(makeDeleteReq('h-1'))

    expect(res.status).toBe(404)
    expect(mockHaccpUpdate).not.toHaveBeenCalled()
  })
})

// ============================================
// 2) Subscription platform-admin gate (role gate, ne lokacijski resolver)
// ============================================
describe('R81: subscription platform-admin gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET: lokacijsko vezan admin (locationId=loc-1) → 403, brez db klicev', async () => {
    mockAuth('loc-1')

    const res = await getSubscription(new Request(BASE))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Dostop do naročniških podatkov ima samo platformni administrator.')
    // Cross-tenant SaaS podatki se ne smejo niti začeti pridobivati:
    expect(mockSubscriptionFindFirst).not.toHaveBeenCalled()
    expect(mockInvoiceCount).not.toHaveBeenCalled()
    expect(mockInvoiceAggregate).not.toHaveBeenCalled()
  })

  it('GET: platform admin (role admin, locationId null) → 200, db poizvedbe tečejo', async () => {
    mockAuth(null, 'admin')
    mockSubscriptionFindFirst.mockResolvedValue({ id: 'sub-1', status: 'trial', email: 'x@y.si' })
    mockInvoiceCount.mockResolvedValue(2)
    mockInvoiceAggregate.mockResolvedValue({ _sum: { totalAmount: 98 } })

    const res = await getSubscription(new Request(BASE))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockSubscriptionFindFirst).toHaveBeenCalledTimes(1)
    expect(mockInvoiceCount).toHaveBeenCalledTimes(2)
    expect(mockInvoiceAggregate).toHaveBeenCalledTimes(1)
    expect(body.stats.totalRevenue).toBe(98)
  })

  it('GET: super_admin brez lokacije → prav tako platform admin (200)', async () => {
    mockAuth(null, 'super_admin')
    mockSubscriptionFindFirst.mockResolvedValue(null)
    mockInvoiceCount.mockResolvedValue(0)
    mockInvoiceAggregate.mockResolvedValue({ _sum: { totalAmount: null } })

    const res = await getSubscription(new Request(BASE))

    expect(res.status).toBe(200)
    expect(mockSubscriptionFindFirst).toHaveBeenCalledTimes(1)
  })

  it('POST: lokacijsko vezan admin → 403, create/findFirst se NE izvedeta', async () => {
    mockAuth('loc-1')

    const res = await postSubscription(new Request(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toContain('platformni administrator')
    // Gate mora firati PRED validacijo/db — 403, ne 400:
    expect(mockSubscriptionFindFirst).not.toHaveBeenCalled()
    expect(mockSubscriptionCreate).not.toHaveBeenCalled()
  })

  it('PATCH: lokacijsko vezan admin → 403, transakcija se NE odpre', async () => {
    mockAuth('loc-1')

    const res = await patchSubscription(new Request(BASE, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'sub-1', status: 'active' }),
    }))

    expect(res.status).toBe(403)
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})

// ============================================
// 3) setup/status — counts skriti po inicializaciji (enumeration fix)
// ============================================
describe('R81: setup/status counts enumeration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('po inicializaciji (counts obstajajo) → counts=null, booleans ostanejo', async () => {
    mockLocationCount.mockResolvedValue(1)
    mockEmployeeCount.mockResolvedValue(3)
    mockSettingsCount.mockResolvedValue(1)

    const res = await getSetupStatus()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isInitialized).toBe(true)
    expect(body.counts).toBeNull()
    // Redirect UX flagi ostanejo:
    expect(body.hasEmployees).toBe(true)
    expect(body.hasLocations).toBe(true)
    expect(body.hasSettings).toBe(true)
    expect(body.mode).toBe('multi')
  })

  it('first-run (0 zaposlenih) → counts ostanejo resnični { 0, 0, 0 }', async () => {
    mockLocationCount.mockResolvedValue(0)
    mockEmployeeCount.mockResolvedValue(0)
    mockSettingsCount.mockResolvedValue(0)

    const res = await getSetupStatus()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isInitialized).toBe(false)
    expect(body.counts).toEqual({ employees: 0, locations: 0, settings: 0 })
    expect(body.hasEmployees).toBe(false)
    expect(body.hasLocations).toBe(false)
  })
})
