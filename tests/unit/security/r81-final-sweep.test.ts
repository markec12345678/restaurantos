// ============================================
// R81-F — FINAL SWEEP (BUGHUNT-RO-6, runda 81) — security tests
//
// Pokriva 6 fiksne iz R81-E1 final sweep-a (12 fajlov, tu je jedro):
// 1. auth/webauthn/register GET+POST: admin path je sme registrirati
//    WebAuthn poverilnico za POLJUBEN employeeId brez owner-location
//    checka = cross-tenant ACCOUNT TAKEOVER (prijava kot žrtev prek
//    /api/auth/webauthn). Fix: owner-location matrika kot
//    credentials/[id] R79 + 'super_admin' v role checku.
// 2. delivery-zones/[id] DELETE: findUnique brez scopea → brisanje tujih
//    con (DeliveryZone.locationId nullable, NULL = fail-closed).
// 3. inventory/adjust POST: findUnique po raw ID → odpis tujih zalog.
//    Fix: findFirst z locationId filterom + inline 403 za non-admin brez
//    lokacije (mirror resolveCatalogScope, brez tenant-scope importov).
// 4. kot POST: order.findUnique raw → KOT za TUJE naročilo. Fix: findFirst
//    scoped (Order.locationId NOT NULL).
// 5. gdpr/anonymize/[employeeId]: GDPR erasure tujega zaposlenega mora
//    odpasti (findUnique nescopecan). Fix: isWithinScope → 404.
// 6. happy-hour/[id] DELETE: urnik tujega tenanta (prek priceGroup.locationId
//    NOT NULL) je bil brisljiv. Fix: include starša + isWithinScope.
//
// Mock pristop: kot r81-scope-hardening.test.ts — vi.hoisted + vi.mock
// '@/lib/db' in '@/lib/auth-middleware', direkten klic route handlerjev.
// requireAuth je popolnoma mockan; zod validacija + api-utils ostanejo
// REALNI (testira produkcijsko pot); decimal je lahkoten mock (brez
// @prisma/client loadanja).
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocki (vi.hoisted zaradi vitest hoisting) ---
const {
  mockRequireAuth,
  mockEmployeeFindUnique,
  mockEmployeeUpdate,
  mockZoneFindUnique,
  mockZoneDelete,
  mockItemFindFirst,
  mockOrderFindFirst,
  mockKotCreate,
  mockHhFindUnique,
  mockHhDelete,
  mockShiftCount,
  mockSessionCount,
  mockAuditCreate,
  mockListCredentials,
  mockBuildRegistrationOptions,
  mockSaveChallenge,
  mockTakeChallenge,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockEmployeeFindUnique: vi.fn(),
  mockEmployeeUpdate: vi.fn(),
  mockZoneFindUnique: vi.fn(),
  mockZoneDelete: vi.fn(),
  mockItemFindFirst: vi.fn(),
  mockOrderFindFirst: vi.fn(),
  mockKotCreate: vi.fn(),
  mockHhFindUnique: vi.fn(),
  mockHhDelete: vi.fn(),
  mockShiftCount: vi.fn(),
  mockSessionCount: vi.fn(),
  mockAuditCreate: vi.fn(),
  mockListCredentials: vi.fn(),
  mockBuildRegistrationOptions: vi.fn(),
  mockSaveChallenge: vi.fn(),
  mockTakeChallenge: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', async () => {
  // R86-2b: delivery-zones/[id] PATCH/DELETE + gdpr/anonymize zdaj kličejo
  // resolveTenantLocationIdOrThrow — re-export REALNEGA resolverja
  // (isti vzorec kot r84/r85 security testi).
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: mockRequireAuth,
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
    employee: { findUnique: mockEmployeeFindUnique, update: mockEmployeeUpdate },
    deliveryZone: { findUnique: mockZoneFindUnique, update: vi.fn(), delete: mockZoneDelete },
    inventoryItem: { findFirst: mockItemFindFirst, findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    stockTransaction: { create: vi.fn() },
    order: { findFirst: mockOrderFindFirst, findUnique: vi.fn() },
    kotDocument: { findMany: vi.fn(), create: mockKotCreate },
    happyHourSchedule: { findUnique: mockHhFindUnique, findMany: vi.fn(), update: vi.fn(), delete: mockHhDelete },
    priceGroup: { findFirst: vi.fn(), findUnique: vi.fn() },
    shift: { count: mockShiftCount },
    session: { count: mockSessionCount, deleteMany: vi.fn() },
    auditLog: { create: mockAuditCreate, findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/webauthn', () => ({
  isWebAuthnEnable: vi.fn(() => true),
  buildRegistrationOptions: mockBuildRegistrationOptions,
  verifyRegistration: vi.fn(),
  getWebAuthnConfig: vi.fn(() => ({ rpID: 'localhost' })),
}))

vi.mock('@/lib/webauthn/challenge-store', () => ({
  saveChallenge: mockSaveChallenge,
  takeChallenge: mockTakeChallenge,
}))

vi.mock('@/lib/webauthn/db-helpers', () => ({
  storeCredential: vi.fn(),
  listEmployeeCredentials: mockListCredentials,
}))

// Lahkoten decimal mock (brez @prisma/client nalaganja)
vi.mock('@/lib/decimal', () => ({
  toNum: (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0),
  round2: (v: number) => Math.round(v * 100) / 100,
  multiply: (a: number, b: number) => a * b,
  divide: (a: number, b: number) => (b ? a / b : 0),
  isPositive: (v: unknown) => Number(v) > 0,
  greaterThan: (a: unknown, b: unknown) => Number(a) > Number(b),
  deepToNumbers: <T>(v: T): T => v,
  decimalsToNumbers: <T>(v: T): T => v,
}))

import { GET as getWebauthnRegister, POST as postWebauthnRegister } from '@/app/api/auth/webauthn/register/route'
import { PATCH as patchDeliveryZone, DELETE as deleteDeliveryZone } from '@/app/api/delivery-zones/[id]/route'
import { POST as postInventoryAdjust } from '@/app/api/inventory/adjust/route'
import { POST as postKot } from '@/app/api/kot/route'
import { POST as postGdprAnonymize } from '@/app/api/gdpr/anonymize/[employeeId]/route'
import { DELETE as deleteHappyHour } from '@/app/api/happy-hour/[id]/route'

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

const REGISTER_URL = 'http://localhost:3000/api/auth/webauthn/register'
const ADJUST_URL = 'http://localhost:3000/api/inventory/adjust'
const KOT_URL = 'http://localhost:3000/api/kot'
const HH_URL = 'http://localhost:3000/api/happy-hour'

// ============================================
// 1) webauthn/register — owner-location matrika (cross-tenant ATO)
// ============================================
describe('R81-F: webauthn/register owner-location matrika', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListCredentials.mockResolvedValue([])
    mockBuildRegistrationOptions.mockResolvedValue({ challenge: 'chal-1', timeout: 60000 })
    mockSaveChallenge.mockResolvedValue(undefined)
  })

  it('GET: lokacijsko vezan admin + TUJ zaposleni (loc-2) → 403, brez listinga/options', async () => {
    mockAuth({ employeeId: 'emp-1', role: 'admin', locationId: 'loc-1', permissions: ['admin', 'manage_employees'] })
    mockEmployeeFindUnique.mockResolvedValue({ name: 'Tuj Zaposleni', status: 'active', locationId: 'loc-2' })

    const res = await getWebauthnRegister(new Request(`${REGISTER_URL}?employeeId=emp-2`))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toContain('Nimate dovoljenja')
    // Napad mora biti ustavljen PRED kakršno koli pripravo poverilnice:
    expect(mockListCredentials).not.toHaveBeenCalled()
    expect(mockBuildRegistrationOptions).not.toHaveBeenCalled()
    expect(mockSaveChallenge).not.toHaveBeenCalled()
  })

  it('GET: super-admin (role super_admin, locationId null) → 200 options za tujega zaposlenega', async () => {
    mockAuth({ employeeId: 'emp-9', role: 'super_admin', locationId: null, permissions: ['admin'] })
    mockEmployeeFindUnique.mockResolvedValue({ name: 'Tuj Zaposleni', status: 'active', locationId: 'loc-2' })

    const res = await getWebauthnRegister(new Request(`${REGISTER_URL}?employeeId=emp-2`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.employeeId).toBe('emp-2')
    expect(body.rpID).toBe('localhost')
    expect(mockBuildRegistrationOptions).toHaveBeenCalledWith('emp-2', 'Tuj Zaposleni', [])
  })

  it('GET: manager z manage_employees BREZ lokacije → 403 (fail-closed data integrity)', async () => {
    mockAuth({ employeeId: 'emp-1', role: 'manager', locationId: null, permissions: ['manage_employees'] })
    mockEmployeeFindUnique.mockResolvedValue({ name: 'Kdorkoli', status: 'active', locationId: 'loc-2' })

    const res = await getWebauthnRegister(new Request(`${REGISTER_URL}?employeeId=emp-2`))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toContain('nima dodeljene lokacije')
    expect(mockBuildRegistrationOptions).not.toHaveBeenCalled()
  })

  it('GET: ciljni zaposleni z NULL lokacijo + lokacijski admin → 403 (fail-closed)', async () => {
    mockAuth({ employeeId: 'emp-1', role: 'admin', locationId: 'loc-1' })
    mockEmployeeFindUnique.mockResolvedValue({ name: 'Brez Lokacije', status: 'active', locationId: null })

    const res = await getWebauthnRegister(new Request(`${REGISTER_URL}?employeeId=emp-2`))

    expect(res.status).toBe(403)
    expect(mockBuildRegistrationOptions).not.toHaveBeenCalled()
  })

  it('POST: lokacijsko vezan admin + tuj employeeId → 403, challenge NI potrošen', async () => {
    mockAuth({ employeeId: 'emp-1', role: 'admin', locationId: 'loc-1' })
    mockEmployeeFindUnique.mockResolvedValue({ locationId: 'loc-2' })

    const res = await postWebauthnRegister(
      jsonReq(REGISTER_URL, 'POST', { credential: { id: 'cred-1', type: 'public-key' }, employeeId: 'emp-2' }),
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toContain('Nimate dovoljenja')
    // Owner-location check teče PRED takeChallenge/verify — nič se ne zgodi:
    expect(mockTakeChallenge).not.toHaveBeenCalled()
  })
})

// ============================================
// 2) delivery-zones/[id] DELETE/PATCH — cross-tenant cona
// ============================================
describe('R81-F: delivery-zones/[id] tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('DELETE: lokacijski admin + tuja cona (loc-2) → 404 notInScope, delete se NE izvede', async () => {
    mockAuth({ locationId: 'loc-1' })
    mockZoneFindUnique.mockResolvedValue({ id: 'zone-1', name: 'Tuja cona', locationId: 'loc-2' })

    const res = await deleteDeliveryZone(new Request('http://localhost:3000/api/delivery-zones/zone-1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'zone-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Dostavna cona ni najden')
    expect(mockZoneDelete).not.toHaveBeenCalled()
  })

  it('DELETE: lastna cona (loc-1) → 200, delete se izvede', async () => {
    mockAuth({ locationId: 'loc-1' })
    mockZoneFindUnique.mockResolvedValue({ id: 'zone-1', name: 'Moja cona', locationId: 'loc-1' })
    mockZoneDelete.mockResolvedValue({ id: 'zone-1' })

    const res = await deleteDeliveryZone(new Request('http://localhost:3000/api/delivery-zones/zone-1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'zone-1' }),
    })

    expect(res.status).toBe(200)
    expect(mockZoneDelete).toHaveBeenCalledWith({ where: { id: 'zone-1' } })
  })

  it('PATCH: lokacijsko vezan admin ne sme REASSIGNATI locationId (strip iz update data)', async () => {
    mockAuth({ locationId: 'loc-1' })
    mockZoneFindUnique.mockResolvedValue({ id: 'zone-1', name: 'Moja cona', locationId: 'loc-1' })
    const { db } = await import('@/lib/db')
    ;(db.deliveryZone.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'zone-1', name: 'Nova', locationId: 'loc-1' })

    const res = await patchDeliveryZone(
      jsonReq('http://localhost:3000/api/delivery-zones/zone-1', 'PATCH', { name: 'Nova', locationId: 'loc-9' }),
      { params: Promise.resolve({ id: 'zone-1' }) },
    )

    expect(res.status).toBe(200)
    // locationId=loc-9 iz bodyja MORA biti odstranjen (nikoli reassign):
    expect(db.deliveryZone.update).toHaveBeenCalledWith({
      where: { id: 'zone-1' },
      data: { name: 'Nova' },
    })
  })
})

// ============================================
// 3) inventory/adjust POST — scoped findFirst + inline 403
// ============================================
describe('R81-F: inventory/adjust POST tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tuj artikel (loc-2) → 404 notInScope; findFirst je klican z locationId filtrom', async () => {
    mockAuth({ locationId: 'loc-1' })
    mockItemFindFirst.mockResolvedValue(null)

    const res = await postInventoryAdjust(
      jsonReq(ADJUST_URL, 'POST', { inventoryItemId: 'inv-2', type: 'write-off', quantity: 2, reason: 'test' }),
    )
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Zalogov artikel ni najden')
    // Ključna asercija: findFirst (ne findUnique) z locationId scope filtrom:
    expect(mockItemFindFirst).toHaveBeenCalledWith({
      where: { id: 'inv-2', locationId: 'loc-1' },
    })
  })

  it('non-admin BREZ dodeljene lokacije → 403 (fail-closed), db NI dosežen', async () => {
    mockAuth({ role: 'waiter', locationId: null, permissions: ['manage_inventory'] })

    const res = await postInventoryAdjust(
      jsonReq(ADJUST_URL, 'POST', { inventoryItemId: 'inv-1', type: 'write-off', quantity: 1, reason: 'x' }),
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toContain('nima dodeljene lokacije')
    expect(mockItemFindFirst).not.toHaveBeenCalled()
  })
})

// ============================================
// 4) kot POST — scoped order fetch (KOT za tuj naročilo)
// ============================================
describe('R81-F: kot POST tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tuj order (loc-2) → 404 notInScope; findFirst klican z locationId filtrom, KOT se NE ustvari', async () => {
    mockAuth({ role: 'waiter', locationId: 'loc-1', permissions: ['take_orders'] })
    mockOrderFindFirst.mockResolvedValue(null)

    const res = await postKot(jsonReq(KOT_URL, 'POST', { orderId: 'order-2' }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Naročilo ni najden')
    expect(mockOrderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-2', locationId: 'loc-1' },
      }),
    )
    expect(mockKotCreate).not.toHaveBeenCalled()
  })
})

// ============================================
// 5) gdpr/anonymize/[employeeId] — GDPR erasure tujega zaposlenega
// ============================================
describe('R81-F: gdpr/anonymize tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lokacijski admin + tuj zaposleni (loc-2) → 404 notInScope; anonimizacija in audit se NE izvedeta', async () => {
    mockAuth({ locationId: 'loc-1' })
    mockEmployeeFindUnique.mockResolvedValue({
      id: 'emp-2',
      name: 'Tuj Zaposleni',
      email: 'tuj@tenant-b.si',
      phone: '+386400000',
      status: 'terminated',
      locationId: 'loc-2',
    })

    const res = await postGdprAnonymize(new Request('http://localhost:3000/api/gdpr/anonymize/emp-2', { method: 'POST' }), {
      params: Promise.resolve({ employeeId: 'emp-2' }),
    })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Zaposleni ni najden')
    // Uničenje PII tuje osebe se NE sme zgoditi (niti audit zapis zraven):
    expect(mockEmployeeUpdate).not.toHaveBeenCalled()
    expect(mockAuditCreate).not.toHaveBeenCalled()
    expect(mockShiftCount).not.toHaveBeenCalled()
  })

  it('NULL-location zaposleni + lokacijski admin → 404 (fail-closed)', async () => {
    mockAuth({ locationId: 'loc-1' })
    mockEmployeeFindUnique.mockResolvedValue({
      id: 'emp-3',
      name: 'Legacy',
      email: 'l@x.si',
      phone: '',
      status: 'terminated',
      locationId: null,
    })

    const res = await postGdprAnonymize(new Request('http://localhost:3000/api/gdpr/anonymize/emp-3', { method: 'POST' }), {
      params: Promise.resolve({ employeeId: 'emp-3' }),
    })

    expect(res.status).toBe(404)
    expect(mockEmployeeUpdate).not.toHaveBeenCalled()
  })
})

// ============================================
// 6) happy-hour/[id] DELETE — scope prek priceGroup.locationId
// ============================================
describe('R81-F: happy-hour/[id] DELETE tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lokacijski admin + tuj urnik (priceGroup loc-2) → 404 notInScope, delete se NE izvede', async () => {
    mockAuth({ locationId: 'loc-1' })
    mockHhFindUnique.mockResolvedValue({ id: 'hh-1', name: 'Tuj urnik', priceGroup: { locationId: 'loc-2' } })

    const res = await deleteHappyHour(jsonReq(`${HH_URL}/hh-1`, 'DELETE', { isActive: true }), {
      params: Promise.resolve({ id: 'hh-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Happy ura ni najden')
    expect(mockHhDelete).not.toHaveBeenCalled()
  })

  it('lastni urnik (priceGroup loc-1) → 200 ok, delete se izvede', async () => {
    mockAuth({ locationId: 'loc-1' })
    mockHhFindUnique.mockResolvedValue({ id: 'hh-1', name: 'Moj urnik', priceGroup: { locationId: 'loc-1' } })
    mockHhDelete.mockResolvedValue({ id: 'hh-1' })

    const res = await deleteHappyHour(jsonReq(`${HH_URL}/hh-1`, 'DELETE', { isActive: true }), {
      params: Promise.resolve({ id: 'hh-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockHhDelete).toHaveBeenCalledWith({ where: { id: 'hh-1' } })
  })
})
