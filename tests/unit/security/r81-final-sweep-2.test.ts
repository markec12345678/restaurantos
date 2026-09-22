// ============================================
// R81-G — FINAL SWEEP part 2 (BUGHUNT-RO-6, runda 81) — security tests
//
// Pokriva fixe iz R81-E2 sweep-a (findings 1-10):
// 1. tip-pool PUT (put-handler): tipPool.findUnique nescopecan → cross-tenant
//    prepis distribucij. Fix: isWithinScope(session, pool.locationId) → 404.
// 2. receipts/[id] POST (post-handler): order.findUnique nescopecan →
//    fiskalizacija tujega naročila. Fix: scoped findFirst → 404.
// 3. purchase-orders PUT/PATCH action=receive (helpers handleReceiveAction):
//    bare findUnique obvozi scoped pot → prevzem tujega blaga. Fix: scoped
//    findFirst → 404.
// 4. packaging/[id] GET/PUT/DELETE: PackagingConfig findUnique ×3 → cross-
//    tenant read/mutacija. Fix: resolveCatalogScope + scoped findFirst.
// 5. reservations PUT: data.tableId nevalidiran (cross-tenant table flip) +
//    409 razkritje tujega customerName. Fix: scoped table fetch + generičen 409.
// 6. staff-shifts POST: tuj zaposleni + body locationId. Fix: inline 403 gate,
//    isWithinScope guard, scoped conflict lookup, locationId strip.
// 7. suppliers/[id]/scorecard: PO findMany brez locationId → tuj totalValue.
//    Fix: inline 403 gate + scoped filter (super-admin globalno).
// 8. time-entries POST: tuj payroll vnos. Fix: inline 403 gate + isWithinScope.
// 9. tip-pool POST: body locationId strip + shift.findMany scope.
// 10. virtual-brands GET: lokacijski filter (view_reports).
//
// Mock pristop: r81-final-sweep.test.ts — vi.hoisted + vi.mock '@/lib/db' in
// '@/lib/auth-middleware'; zod + api-utils + tenant-scope REALNI (testira
// produkcijsko scope logiko); decimal lahkoten mock (brez @prisma/client
// transakcij); tip-distribution-chain mockan (hash veriga).
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocki (vi.hoisted zaradi vitest hoisting) ---
const {
  mockRequireAuth,
  mockPoolFindUnique,
  mockPoolFindFirst,
  mockPoolCreate,
  mockTipDistDeleteMany,
  mockTipPoolUpdate,
  mockShiftFindMany,
  mockPaymentFindMany,
  mockOrderFindFirst,
  mockPoFindFirst,
  mockPoFindMany,
  mockPackagingFindFirst,
  mockPackagingDelete,
  mockReservationFindFirst,
  mockReservationFindMany,
  mockReservationUpdate,
  mockTableFindFirst,
  mockEmployeeFindUnique,
  mockStaffShiftFindFirst,
  mockStaffShiftCreate,
  mockTimeEntryFindFirst,
  mockTimeEntryCreate,
  mockSupplierFindUnique,
  mockVirtualBrandFindMany,
  mockTransaction,
  mockTxReservationFindFirst,
  mockTxReservationFindMany,
  mockTxReservationUpdate,
  mockTxReservationUpdateMany,
  mockTxReservationCount,
  mockTxReservationFindUnique,
  mockTxTableUpdateMany,
  mockTxOrderFindFirst,
  mockCreateTipDistChain,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockPoolFindUnique: vi.fn(),
  mockPoolFindFirst: vi.fn(),
  mockPoolCreate: vi.fn(),
  mockTipDistDeleteMany: vi.fn(),
  mockTipPoolUpdate: vi.fn(),
  mockShiftFindMany: vi.fn(),
  mockPaymentFindMany: vi.fn(),
  mockOrderFindFirst: vi.fn(),
  mockPoFindFirst: vi.fn(),
  mockPoFindMany: vi.fn(),
  mockPackagingFindFirst: vi.fn(),
  mockPackagingDelete: vi.fn(),
  mockReservationFindFirst: vi.fn(),
  mockReservationFindMany: vi.fn(),
  mockReservationUpdate: vi.fn(),
  mockTableFindFirst: vi.fn(),
  mockEmployeeFindUnique: vi.fn(),
  mockStaffShiftFindFirst: vi.fn(),
  mockStaffShiftCreate: vi.fn(),
  mockTimeEntryFindFirst: vi.fn(),
  mockTimeEntryCreate: vi.fn(),
  mockSupplierFindUnique: vi.fn(),
  mockVirtualBrandFindMany: vi.fn(),
  mockTransaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn({
      tipPool: { findUnique: mockPoolFindUnique, update: mockTipPoolUpdate },
      tipDistribution: { deleteMany: mockTipDistDeleteMany },
      // R102: reservations PUT/DELETE [id] tok v tx klientu (state machine +
      // conflict + update + CAS + flip-i so atomarni)
      reservation: {
        findFirst: mockTxReservationFindFirst,
        findMany: mockTxReservationFindMany,
        update: mockTxReservationUpdate,
        updateMany: mockTxReservationUpdateMany,
        count: mockTxReservationCount,
        findUnique: mockTxReservationFindUnique,
      },
      table: { findFirst: mockTableFindFirst, updateMany: mockTxTableUpdateMany },
      order: { findFirst: mockTxOrderFindFirst },
    }),
  ),
  mockTxReservationFindFirst: vi.fn(),
  mockTxReservationFindMany: vi.fn(),
  mockTxReservationUpdate: vi.fn(),
  mockTxReservationUpdateMany: vi.fn(),
  mockTxReservationCount: vi.fn(),
  mockTxReservationFindUnique: vi.fn(),
  mockTxTableUpdateMany: vi.fn(),
  mockTxOrderFindFirst: vi.fn(),
  mockCreateTipDistChain: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', async () => {
  // R86-2b: purchase-orders/[id] PUT/PATCH zdaj kliče resolveTenantLocationIdOrThrow —
  // re-export REALNEGA resolverja (prej dead vi.fn() mock, ki bi vrnil undefined).
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: mockRequireAuth,
    optionalAuth: vi.fn(),
    resolveTenantLocationId: tenantScope.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: tenantScope.tenantScopeToWhere,
    invalidateEmployeeStatusCache: vi.fn(),
  }
})

// Eksplicitni db mock (overrides globalni Proxy mock iz tests/setup.ts) —
// da lahko trdimo KATERE poizvedbe so (ne) izvedene.
vi.mock('@/lib/db', () => ({
  db: {
    tipPool: {
      findUnique: mockPoolFindUnique,
      findFirst: mockPoolFindFirst,
      create: mockPoolCreate,
      update: mockTipPoolUpdate,
    },
    tipDistribution: { deleteMany: mockTipDistDeleteMany, create: vi.fn() },
    payment: { findMany: mockPaymentFindMany },
    shift: { findMany: mockShiftFindMany },
    order: { findFirst: mockOrderFindFirst, findUnique: vi.fn() },
    receipt: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    purchaseOrder: { findFirst: mockPoFindFirst, findMany: mockPoFindMany, findUnique: vi.fn(), update: vi.fn() },
    packagingConfig: { findFirst: mockPackagingFindFirst, findUnique: vi.fn(), update: vi.fn(), delete: mockPackagingDelete },
    reservation: { findFirst: mockReservationFindFirst, findMany: mockReservationFindMany, update: mockReservationUpdate },
    table: { findFirst: mockTableFindFirst, updateMany: vi.fn() },
    employee: { findUnique: mockEmployeeFindUnique },
    staffShift: { findFirst: mockStaffShiftFindFirst, create: mockStaffShiftCreate, findMany: vi.fn() },
    timeEntry: { findFirst: mockTimeEntryFindFirst, create: mockTimeEntryCreate },
    supplier: { findUnique: mockSupplierFindUnique },
    virtualBrand: { findMany: mockVirtualBrandFindMany, findUnique: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: mockTransaction,
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/tip-distribution-chain', () => ({
  createTipDistributionWithChain: mockCreateTipDistChain,
}))

// Lahkoten decimal mock (brez @prisma/client nalaganja)
vi.mock('@/lib/decimal', () => ({
  toNum: (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0),
  round2: (v: number) => Math.round(v * 100) / 100,
  multiply: (a: number, b: number) => a * b,
  divide: (a: number, b: number) => (b ? a / b : 0),
  isPositive: (v: unknown) => Number(v) > 0,
  greaterThan: (a: unknown, b: unknown) => Number(a) > Number(b),
  greaterThanOrEqual: (a: unknown, b: unknown) => Number(a) >= Number(b),
  sumBy: (arr: unknown[], fn: (x: unknown) => number) => arr.reduce((s: number, x) => s + fn(x), 0),
  deepToNumbers: <T>(v: T): T => v,
  decimalsToNumbers: <T>(v: T): T => v,
}))

import { PUT as putTipPool, POST as postTipPool } from '@/app/api/tip-pool/route'
import { handlePostReceipt } from '@/app/api/receipts/[id]/_helpers/post-handler'
import { PUT as putPurchaseOrder, PATCH as patchPurchaseOrder } from '@/app/api/purchase-orders/[id]/route'
import { GET as getPackaging, DELETE as deletePackaging } from '@/app/api/packaging/[id]/route'
import { PUT as putReservation } from '@/app/api/reservations/[id]/route'
import { POST as postStaffShift } from '@/app/api/staff-shifts/route'
import { POST as postTimeEntry } from '@/app/api/time-entries/route'
import { GET as getScorecard } from '@/app/api/suppliers/[id]/scorecard/route'
import { GET as getVirtualBrands } from '@/app/api/virtual-brands/route'

// --- Helperji ---
function makeSession(opts: {
  employeeId?: string
  role?: string
  locationId?: string | null
  permissions?: string[]
}) {
  return {
    employeeId: opts.employeeId ?? 'emp-1',
    role: opts.role ?? 'admin',
    locationId: opts.locationId ?? null,
    permissions: opts.permissions ?? ['admin'],
  }
}

function mockAuth(opts: Parameters<typeof makeSession>[0]) {
  mockRequireAuth.mockResolvedValue({ session: makeSession(opts), error: null })
}

function jsonReq(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const TIPPOOL_URL = 'http://localhost:3000/api/tip-pool'
const PO_URL = 'http://localhost:3000/api/purchase-orders'
const PACKAGING_URL = 'http://localhost:3000/api/packaging'
const RESERVATION_URL = 'http://localhost:3000/api/reservations'
const STAFF_SHIFTS_URL = 'http://localhost:3000/api/staff-shifts'
const TIME_ENTRIES_URL = 'http://localhost:3000/api/time-entries'
const SCORECARD_URL = 'http://localhost:3000/api/suppliers/sup-1/scorecard'
const VIRTUAL_BRANDS_URL = 'http://localhost:3000/api/virtual-brands'

const TIP_DISTRIBUTIONS = [
  { employeeId: 'emp-1', employeeName: 'Ana', hoursWorked: 8, points: 1, amount: 10 },
]

// ============================================
// 1) tip-pool PUT — cross-tenant prepis distribucij (LEAK-HIGH)
// ============================================
describe('R81-G: tip-pool PUT tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTipDistChain.mockResolvedValue(undefined)
  })

  it('tuj pool (loc-2) → 404 notInScope; distribucije se NE pišejo', async () => {
    mockAuth({ role: 'manager', locationId: 'loc-1', permissions: ['manage_employees'] })
    mockPoolFindUnique.mockResolvedValue({ id: 'tp-1', locationId: 'loc-2', status: 'pending', totalTips: 100 })

    const res = await putTipPool(jsonReq(TIPPOOL_URL, 'PUT', { tipPoolId: 'tp-1', distributions: TIP_DISTRIBUTIONS }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Tipski bazen ni najden')
    // Distribucijske mutacije se NE smejo zgoditi (prepis tujih napitnin):
    expect(mockTipDistDeleteMany).not.toHaveBeenCalled()
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockCreateTipDistChain).not.toHaveBeenCalled()
  })

  it('NULL-location pool + lokacijsko vezana seja → 404 (fail-closed)', async () => {
    mockAuth({ role: 'manager', locationId: 'loc-1', permissions: ['manage_employees'] })
    mockPoolFindUnique.mockResolvedValue({ id: 'tp-2', locationId: null, status: 'pending', totalTips: 50 })

    const res = await putTipPool(jsonReq(TIPPOOL_URL, 'PUT', { tipPoolId: 'tp-2', distributions: TIP_DISTRIBUTIONS }))

    expect(res.status).toBe(404)
    expect(mockTipDistDeleteMany).not.toHaveBeenCalled()
  })

  it('super-admin (brez lokacije) → 200, distribucije se zapišejo (globalni nadzor)', async () => {
    mockAuth({ role: 'super_admin', locationId: null, permissions: ['admin'] })
    mockPoolFindUnique
      .mockResolvedValueOnce({ id: 'tp-1', locationId: 'loc-2', status: 'pending', totalTips: 100 }) // fetch pred scope
      .mockResolvedValueOnce({ status: 'pending' }) // optimistic lock znotraj tx
      .mockResolvedValueOnce({ id: 'tp-1', locationId: 'loc-2', status: 'distributed', distributions: [] }) // re-fetch
    mockTipPoolUpdate.mockResolvedValue({ id: 'tp-1' })

    const res = await putTipPool(jsonReq(TIPPOOL_URL, 'PUT', { tipPoolId: 'tp-1', distributions: TIP_DISTRIBUTIONS }))

    expect(res.status).toBe(200)
    expect(mockTipDistDeleteMany).toHaveBeenCalledWith({ where: { tipPoolId: 'tp-1' } })
    expect(mockTipPoolUpdate).toHaveBeenCalledWith({ where: { id: 'tp-1' }, data: { status: 'distributed' } })
  })
})

// ============================================
// 2) receipts/[id] POST handler — fiskalizacija tujega naročila (LEAK-HIGH)
// ============================================
describe('R81-G: receipts post-handler tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tuj order (loc-2) → 404 notInScope; findFirst klican z locationId filtrom', async () => {
    mockOrderFindFirst.mockResolvedValue(null)

    const res = await handlePostReceipt(
      jsonReq('http://localhost:3000/api/receipts/order-2', 'POST', {}),
      'order-2',
      { session: { employeeId: 'emp-1', locationId: 'loc-1' } },
    )
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Naročilo ni najden')
    expect(mockOrderFindFirst).toHaveBeenCalledWith({
      where: { id: 'order-2', locationId: 'loc-1' },
      include: { orderItems: { include: { menuItem: true } } },
    })
  })

  it('super-admin (brez lokacije) → filter absent (nikoli { locationId: null })', async () => {
    mockOrderFindFirst.mockResolvedValue(null)

    // R86-2c1: mock mora vsebovati role — realni resolver (R86-2a fix v
    // post-handlerju) je role-aware; seja brez role = regular user brez
    // lokacije → 403. Test intent je super-admin → izrecno role: 'super_admin'.
    // (spremenljivka namesto literala — handlePostReceipt tip seje ne deklarira role)
    const superAdminSession = {
      employeeId: 'emp-9',
      role: 'super_admin' as string,
      locationId: null as string | null,
    }
    const res = await handlePostReceipt(
      jsonReq('http://localhost:3000/api/receipts/order-2', 'POST', {}),
      'order-2',
      { session: superAdminSession },
    )

    expect(res.status).toBe(404)
    expect(mockOrderFindFirst).toHaveBeenCalledWith({
      where: { id: 'order-2' },
      include: { orderItems: { include: { menuItem: true } } },
    })
  })
})

// ============================================
// 3) purchase-orders PUT/PATCH receive — prevzem tujega blaga (LEAK-HIGH)
// ============================================
describe('R81-G: purchase-orders receive tenant scope', () => {
  const receiveBody = { action: 'receive', receivedItems: [{ itemId: 'poi-1', quantityReceived: 2 }] }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PUT action=receive: tuja naročilnica (loc-2) → 404 notInScope; transakcija se NE izvede', async () => {
    mockAuth({ role: 'manager', locationId: 'loc-1', permissions: ['manage_inventory'] })
    mockPoFindFirst.mockResolvedValue(null)

    const res = await putPurchaseOrder(jsonReq(`${PO_URL}/po-9`, 'PUT', receiveBody), {
      params: Promise.resolve({ id: 'po-9' }),
    })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Naročilnica ni najden')
    expect(mockPoFindFirst).toHaveBeenCalledWith({
      where: { id: 'po-9', locationId: 'loc-1' },
      include: { items: true },
    })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('PATCH action=receive: isti scope check kot PUT', async () => {
    mockAuth({ role: 'manager', locationId: 'loc-1', permissions: ['manage_inventory'] })
    mockPoFindFirst.mockResolvedValue(null)

    const res = await patchPurchaseOrder(jsonReq(`${PO_URL}/po-9`, 'PATCH', receiveBody), {
      params: Promise.resolve({ id: 'po-9' }),
    })

    expect(res.status).toBe(404)
    expect(mockPoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'po-9', locationId: 'loc-1' } }),
    )
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})

// ============================================
// 4) packaging/[id] — MODEL A scope (LEAK-HIGH)
// ============================================
describe('R81-G: packaging/[id] MODEL A scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('DELETE: tuja embalaža (loc-2) → 404 notInScope; delete se NE izvede', async () => {
    mockAuth({ locationId: 'loc-1' })
    mockPackagingFindFirst.mockResolvedValue(null)

    const res = await deletePackaging(new Request(`${PACKAGING_URL}/pkg-1`, { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'pkg-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Embalaža ni najden')
    expect(mockPackagingFindFirst).toHaveBeenCalledWith({
      where: { id: 'pkg-1', locationId: 'loc-1' },
    })
    expect(mockPackagingDelete).not.toHaveBeenCalled()
  })

  it('GET: non-admin BREZ dodeljene lokacije → 403 (fail-closed MODEL A gate)', async () => {
    mockAuth({ role: 'waiter', locationId: null, permissions: [] })

    const res = await getPackaging(new Request(`${PACKAGING_URL}/pkg-1`), {
      params: Promise.resolve({ id: 'pkg-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toContain('nima dodeljene lokacije')
    expect(mockPackagingFindFirst).not.toHaveBeenCalled()
  })
})

// ============================================
// 5) reservations PUT — tuj tableId + 409 customerName leak (LEAK-MEDIUM)
// ============================================
describe('R81-G: reservations PUT tableId scope + 409 leak', () => {
  const RES_DATE = '2026-06-01T17:00:00.000Z'

  beforeEach(() => {
    vi.clearAllMocks()
    mockReservationFindFirst.mockResolvedValue({
      id: 'res-1',
      locationId: 'loc-1',
      tableId: null,
      status: 'confirmed',
      dateTime: new Date(RES_DATE),
      duration: 120,
    })
    // R102: tx-fresh re-read (isti zapis, tx klient)
    mockTxReservationFindFirst.mockResolvedValue({
      id: 'res-1',
      locationId: 'loc-1',
      tableId: null,
      status: 'confirmed',
      dateTime: new Date(RES_DATE),
      duration: 120,
    })
  })

  it('PUT s tujim tableId (loc-2) → 404 notInScope; update se NE izvede', async () => {
    mockAuth({ role: 'waiter', locationId: 'loc-1', permissions: ['take_orders'] })
    mockTableFindFirst.mockResolvedValue(null)

    const res = await putReservation(jsonReq(`${RESERVATION_URL}/res-1`, 'PUT', { tableId: 'table-9' }), {
      params: Promise.resolve({ id: 'res-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Miza ni najden')
    expect(mockTableFindFirst).toHaveBeenCalledWith({
      where: { id: 'table-9', locationId: 'loc-1' },
      select: { id: true },
    })
    expect(mockReservationUpdate).not.toHaveBeenCalled()
    // R102: update je zdaj v tx klientu — tudi tam se ne izvede
    expect(mockTxReservationUpdate).not.toHaveBeenCalled()
  })

  it('409 konflikt NE razkriva customerName (generično sporočilo, status 409)', async () => {
    mockAuth({ role: 'waiter', locationId: 'loc-1', permissions: ['take_orders'] })
    mockTableFindFirst.mockResolvedValue({ id: 'table-1' })
    // R102: conflict check je zdaj ZNOTRAJ Serializable tx → tx-level findMany
    mockTxReservationFindMany.mockResolvedValue([
      { id: 'r-2', customerName: 'Tuj Gost PII', dateTime: new Date(RES_DATE), duration: 120 },
    ])

    const res = await putReservation(jsonReq(`${RESERVATION_URL}/res-1`, 'PUT', { tableId: 'table-1' }), {
      params: Promise.resolve({ id: 'res-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain('že rezervirana')
    expect(body.error).not.toContain('Tuj Gost PII')
    expect(mockReservationUpdate).not.toHaveBeenCalled()
    expect(mockTxReservationUpdate).not.toHaveBeenCalled()
  })
})

// ============================================
// 6) staff-shifts POST — tuj zaposleni + body locationId strip (LEAK-MEDIUM)
// ============================================
describe('R81-G: staff-shifts POST tenant scope', () => {
  const shiftBody = { employeeId: 'emp-2', shiftDate: '2026-01-15', startTime: '09:00', endTime: '17:00' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockStaffShiftCreate.mockResolvedValue({ id: 'ss-1' })
  })

  it('tuj zaposleni (loc-2) → 404 notInScope; izmena se NE ustvari', async () => {
    mockAuth({ role: 'manager', locationId: 'loc-1', permissions: ['manage_employees'] })
    mockEmployeeFindUnique.mockResolvedValue({ id: 'emp-2', name: 'Tuj', role: 'waiter', locationId: 'loc-2' })

    const res = await postStaffShift(jsonReq(STAFF_SHIFTS_URL, 'POST', shiftBody))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Zaposleni ni najden')
    expect(mockStaffShiftFindFirst).not.toHaveBeenCalled()
    expect(mockStaffShiftCreate).not.toHaveBeenCalled()
  })

  it('non-admin BREZ lokacije → 403 fail-closed (gate PRED db)', async () => {
    mockAuth({ role: 'manager', locationId: null, permissions: ['manage_employees'] })

    const res = await postStaffShift(jsonReq(STAFF_SHIFTS_URL, 'POST', shiftBody))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toContain('nima dodeljene lokacije')
    expect(mockEmployeeFindUnique).not.toHaveBeenCalled()
  })

  it('lokacijsko vezan manager + body locationId=loc-9 → locationId STRIPPAN (create dobi loc-1)', async () => {
    mockAuth({ role: 'manager', locationId: 'loc-1', permissions: ['manage_employees'] })
    mockEmployeeFindUnique.mockResolvedValue({ id: 'emp-1', name: 'Moj', role: 'waiter', locationId: 'loc-1' })
    mockStaffShiftFindFirst.mockResolvedValue(null)

    const res = await postStaffShift(
      jsonReq(STAFF_SHIFTS_URL, 'POST', { ...shiftBody, employeeId: 'emp-1', locationId: 'loc-9' }),
    )

    expect(res.status).toBe(201)
    expect(mockStaffShiftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ locationId: 'loc-1' }),
      }),
    )
  })
})

// ============================================
// 7) time-entries POST — tuj payroll vnos (LEAK-MEDIUM)
// ============================================
describe('R81-G: time-entries POST tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tuj zaposleni (loc-2) → 404 notInScope; vnos se NE ustvari', async () => {
    mockAuth({ role: 'manager', locationId: 'loc-1', permissions: ['manage_employees'] })
    mockTimeEntryFindFirst.mockResolvedValue(null)
    mockEmployeeFindUnique.mockResolvedValue({ id: 'emp-2', name: 'Tuj', locationId: 'loc-2' })

    const res = await postTimeEntry(
      jsonReq(TIME_ENTRIES_URL, 'POST', { employeeId: 'emp-2', clockIn: '2026-01-01T08:00:00Z' }),
    )
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Zaposleni ni najden')
    expect(mockTimeEntryCreate).not.toHaveBeenCalled()
  })

  it('NULL-location zaposleni + lokacijsko vezan manager → 404 (fail-closed)', async () => {
    mockAuth({ role: 'manager', locationId: 'loc-1', permissions: ['manage_employees'] })
    mockTimeEntryFindFirst.mockResolvedValue(null)
    mockEmployeeFindUnique.mockResolvedValue({ id: 'emp-3', name: 'Legacy', locationId: null })

    const res = await postTimeEntry(
      jsonReq(TIME_ENTRIES_URL, 'POST', { employeeId: 'emp-3', clockIn: '2026-01-01T08:00:00Z' }),
    )

    expect(res.status).toBe(404)
    expect(mockTimeEntryCreate).not.toHaveBeenCalled()
  })
})

// ============================================
// 8) suppliers/[id]/scorecard — PO filter (LEAK-MEDIUM) + super-admin global
// ============================================
describe('R81-G: scorecard PO scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupplierFindUnique.mockResolvedValue({ id: 'sup-1', name: 'Dobavitelj A', rating: 4 })
    mockPoFindMany.mockResolvedValue([])
  })

  it('lokacijsko vezan manager → findMany klican z locationId filtrom', async () => {
    mockAuth({ role: 'manager', locationId: 'loc-1', permissions: ['manage_inventory'] })

    const res = await getScorecard(new Request(SCORECARD_URL), { params: Promise.resolve({ id: 'sup-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.stats.totalPOs).toBe(0)
    expect(mockPoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { supplierId: 'sup-1', locationId: 'loc-1' },
      }),
    )
  })

  it('super-admin (brez lokacije) → globalni pogled (where BREZ locationId, nikoli { locationId: null })', async () => {
    mockAuth({ role: 'super_admin', locationId: null, permissions: ['admin'] })

    const res = await getScorecard(new Request(SCORECARD_URL), { params: Promise.resolve({ id: 'sup-1' }) })

    expect(res.status).toBe(200)
    expect(mockPoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { supplierId: 'sup-1' } }),
    )
  })
})

// ============================================
// 9) tip-pool POST — body locationId strip + shift.findMany scope (LEAK-MEDIUM)
// ============================================
describe('R81-G: tip-pool POST tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTipDistChain.mockResolvedValue(undefined)
    mockPaymentFindMany.mockResolvedValue([]) // fetchDayPayments → brez napitnin
  })

  it('non-admin BREZ lokacije → 403 fail-closed (gate PRED db)', async () => {
    mockAuth({ role: 'manager', locationId: null, permissions: ['manage_employees'] })

    const res = await postTipPool(jsonReq(TIPPOOL_URL, 'POST', { date: '2026-01-15' }))

    expect(res.status).toBe(403)
    expect(mockPoolFindFirst).not.toHaveBeenCalled()
    expect(mockShiftFindMany).not.toHaveBeenCalled()
    expect(mockPoolCreate).not.toHaveBeenCalled()
  })

  it('lokacijsko vezan manager + body locationId=loc-9 → strip na session lokacijo + scoped shifts', async () => {
    mockAuth({ role: 'manager', locationId: 'loc-1', permissions: ['manage_employees'] })
    mockShiftFindMany.mockResolvedValue([
      { employeeId: 'emp-1', employee: { name: 'Ana' }, startTime: '09:00', endTime: '17:00' },
    ])
    mockPoolCreate.mockResolvedValue({ id: 'pool-1' })
    // persistTipPoolWithDistributions → db.$transaction z tx (create pot, existing=null):
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) =>
      fn({
        tipPool: { findUnique: mockPoolFindUnique, update: mockTipPoolUpdate, create: mockPoolCreate },
        tipDistribution: { deleteMany: mockTipDistDeleteMany },
      }),
    )
    mockPoolFindUnique.mockResolvedValue({ id: 'pool-1', distributions: [] }) // re-fetch po persistu

    const res = await postTipPool(jsonReq(TIPPOOL_URL, 'POST', { date: '2026-01-15', locationId: 'loc-9' }))

    // existing=null → create pot → 201
    expect(res.status).toBe(201)
    // shift.findMany mora biti scopcan na session lokacijo (NE body loc-9):
    expect(mockShiftFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ locationId: 'loc-1' }),
      }),
    )
    // persist dobi session lokacijo (body loc-9 STRIPPAN):
    expect(mockPoolCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ locationId: 'loc-1' }),
    })
    // duplicate check nosi session lokacijo:
    expect(mockPoolFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ locationId: 'loc-1' }),
    })
  })
})

// ============================================
// 10) virtual-brands GET — lokacijski filter (LEAK-LOW)
// ============================================
describe('R81-G: virtual-brands GET tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVirtualBrandFindMany.mockResolvedValue([])
  })

  it('lokacijsko vezan manager → findMany klican z locationId filtrom', async () => {
    mockAuth({ role: 'manager', locationId: 'loc-1', permissions: ['view_reports'] })

    const res = await getVirtualBrands(new Request(VIRTUAL_BRANDS_URL))

    expect(res.status).toBe(200)
    expect(mockVirtualBrandFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, locationId: 'loc-1' },
      }),
    )
  })

  it('super-admin (brez lokacije) → globalni pogled (where = { isActive: true } brez locationId)', async () => {
    mockAuth({ role: 'super_admin', locationId: null, permissions: ['admin'] })

    const res = await getVirtualBrands(new Request(VIRTUAL_BRANDS_URL))

    expect(res.status).toBe(200)
    expect(mockVirtualBrandFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    )
  })
})
