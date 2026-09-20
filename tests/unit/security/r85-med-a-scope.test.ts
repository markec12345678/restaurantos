// ============================================
// R85-4a — MEDIUM WAVE A: KITCHEN / RESERVATIONS / WAITLIST TENANT SCOPE
// ============================================
// REGRESIJA za R84-FINAL-2 MEDIUM najdbe (M1–M3), dokazane s file:line:
//
//   M1 kitchen      GET /api/kitchen        — 2× order.findMany GLOBALNO
//                     (route.ts:24-27 + :90-91 prej brez locationId;
//                      kuhinja lokacije A je videla naročila vseh tenantov)
//                   GET /api/kitchen/matrix — order.findMany GLOBALNO
//                     (matrix/route.ts:20-21 prej brez locationId)
//   M2 reservations GET /api/reservations   — findMany + count + groupBy +
//                     aggregate GLOBALNO (get-handler.ts:16 where={}; PII)
//                   POST /api/reservations  — data.tableId nevalidiran proti
//                     scopu (create-handler.ts:46 findUnique brez locationId)
//                     + resolveLocationId fallback žig PRVE lokacije v DB
//                     (create-handler.ts:97 prej — možen tuji-tenant žig)
//                   PUT/DELETE /api/reservations/[id] — ročni spread
//                     `session?.locationId ?? undefined` je bil FAIL-OPEN za
//                     regularnega uporabnika brez lokacije (globalni
//                     findFirst + update). Zdaj resolver → 403 fail-closed.
//   M3 waitlist     GET /api/waitlist       — findMany GLOBALNO (PII: imena,
//                     telefoni gostov vseh tenantov) (route.ts:21-24 prej)
//                   POST /api/waitlist      — raw session.locationId žig
//                     (regularni uporabnik brez lokacije = NULL žig globalni
//                      vnos); PUT/DELETE [id] fail-open spread; PUT 'seat'
//                     je dodelil body.tableId BREZ validacije mize
//                     (cross-tenant FK referenca, prej route.ts:75)
//
// Vzorec (r84-reports-scope.test.ts): realen tenant-scope resolver + pinanje
// where-clavzov. null scope (super-admin) = PRAZEN filter, NIKOLI
// { locationId: null } (hasOwnProperty preverba). Lekcije R85:
// createAuditLog je TOP-LEVEL export '@/lib/db' (ne lastnost db klienta);
// mockResolvedValue namesto mockResolvedValueOnce (Once preživi clearAllMocks).
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  // db models
  orderFindMany: vi.fn(),
  resFindMany: vi.fn(),
  resCount: vi.fn(),
  resGroupBy: vi.fn(),
  resAggregate: vi.fn(),
  resFindFirst: vi.fn(),
  resUpdate: vi.fn(),
  tableFindUnique: vi.fn(),
  tableFindFirst: vi.fn(),
  tableUpdateMany: vi.fn(),
  waitlistFindMany: vi.fn(),
  waitlistCreate: vi.fn(),
  waitlistFindFirst: vi.fn(),
  waitlistUpdate: vi.fn(),
  waitlistDelete: vi.fn(),
  // $transaction tx-client (ločeni moki od db-level, da se call-counti ne mešajo)
  transaction: vi.fn(),
  txTableFindUnique: vi.fn(),
  txResFindMany: vi.fn(),
  txResCreate: vi.fn(),
  // TOP-LEVEL export '@/lib/db' (LEKCIJA R85: ne gnezdi v db!)
  createAuditLog: vi.fn(),
  // ostalo
  emitEvent: vi.fn(),
}))

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
    order: { findMany: mocks.orderFindMany },
    reservation: {
      findMany: mocks.resFindMany,
      count: mocks.resCount,
      groupBy: mocks.resGroupBy,
      aggregate: mocks.resAggregate,
      findFirst: mocks.resFindFirst,
      update: mocks.resUpdate,
    },
    table: {
      findUnique: mocks.tableFindUnique,
      findFirst: mocks.tableFindFirst,
      updateMany: mocks.tableUpdateMany,
    },
    waitlistEntry: {
      findMany: mocks.waitlistFindMany,
      create: mocks.waitlistCreate,
      findFirst: mocks.waitlistFindFirst,
      update: mocks.waitlistUpdate,
      delete: mocks.waitlistDelete,
    },
    $transaction: mocks.transaction,
  },
  createAuditLog: mocks.createAuditLog,
}))

vi.mock('@/lib/event-emitter', () => ({ emitEvent: mocks.emitEvent }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET as kitchenGET } from '@/app/api/kitchen/route'
import { GET as kitchenMatrixGET } from '@/app/api/kitchen/matrix/route'
import { GET as reservationsGET, POST as reservationsPOST } from '@/app/api/reservations/route'
import { PUT as reservationsPUT, DELETE as reservationsDELETE } from '@/app/api/reservations/[id]/route'
import { GET as waitlistGET, POST as waitlistPOST } from '@/app/api/waitlist/route'
import { PUT as waitlistPUT, DELETE as waitlistDELETE } from '@/app/api/waitlist/[id]/route'

// Utišaj morebiten realen output (api-utils handleApiError itd.)
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

const kitchenOrderRow = {
  id: 'order-1',
  orderNumber: 1,
  status: 'pending',
  createdAt: new Date('2026-01-01T11:00:00Z'),
  table: null,
  orderItems: [],
}

const tableA = { id: 'table-a', number: 5, capacity: 6, status: 'available', locationId: LOC_A }
const tableB = { id: 'table-b', number: 7, capacity: 6, status: 'available', locationId: LOC_B }

const resExisting = {
  id: 'res-1',
  customerName: 'Ana',
  status: 'confirmed',
  tableId: null,
  dateTime: new Date('2026-06-01T18:00:00Z'),
  duration: 120,
  partySize: 4,
  locationId: LOC_A,
}

const resCreated = { id: 'res-new', locationId: LOC_A, customerName: 'Ana' }

const waitlistRow = {
  id: 'wl-1',
  guestName: 'Marko',
  status: 'waiting',
  checkedInAt: new Date('2026-06-01T18:00:00Z'),
  tableId: null,
  locationId: LOC_A,
}

beforeEach(() => {
  vi.clearAllMocks()
  // LEKCIJA R85: samo mockResolvedValue (Once preživi clearAllMocks)
  mocks.orderFindMany.mockResolvedValue([kitchenOrderRow])
  mocks.resFindMany.mockResolvedValue([])
  mocks.resCount.mockResolvedValue(0)
  mocks.resGroupBy.mockResolvedValue([])
  mocks.resAggregate.mockResolvedValue({ _sum: { partySize: null } })
  mocks.resFindFirst.mockResolvedValue(resExisting)
  mocks.resUpdate.mockResolvedValue(resExisting)
  mocks.tableFindUnique.mockResolvedValue(tableA)
  mocks.tableFindFirst.mockResolvedValue({ id: 'table-a' })
  mocks.tableUpdateMany.mockResolvedValue({ count: 1 })
  mocks.waitlistFindMany.mockResolvedValue([waitlistRow])
  mocks.waitlistCreate.mockResolvedValue(waitlistRow)
  mocks.waitlistFindFirst.mockResolvedValue(waitlistRow)
  mocks.waitlistUpdate.mockResolvedValue(waitlistRow)
  mocks.waitlistDelete.mockResolvedValue(waitlistRow)
  mocks.txTableFindUnique.mockResolvedValue(tableA)
  mocks.txResFindMany.mockResolvedValue([])
  mocks.txResCreate.mockResolvedValue(resCreated)
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      table: { findUnique: mocks.txTableFindUnique },
      reservation: { findMany: mocks.txResFindMany, create: mocks.txResCreate },
    }),
  )
  mocks.createAuditLog.mockResolvedValue(undefined)
  mocks.emitEvent.mockResolvedValue(undefined)
})

const jsonReq = (url: string, body: unknown, method = 'POST') =>
  new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const RES_POST_BODY = {
  customerName: 'Ana',
  dateTime: '2026-06-01T18:00:00Z',
  partySize: 4,
  duration: 120,
}

// ══════════════════════════════════════════════════════════════════
// M1 — KITCHEN
// ══════════════════════════════════════════════════════════════════
describe('R85-4a M1: GET /api/kitchen — tenant scope', () => {
  it('regular user brez locationId → 403 fail-closed, NI poizvedb', async () => {
    mockSession({ role: 'waiter', locationId: null })
    const res = await kitchenGET(new Request('http://localhost:3000/api/kitchen'))
    expect(res.status).toBe(403)
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
  })

  it('loc-bound admin: OBE findMany where.locationId === LOC_A', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await kitchenGET(new Request('http://localhost:3000/api/kitchen'))
    expect(res.status).toBe(200)
    expect(mocks.orderFindMany).toHaveBeenCalledTimes(2)
    expect(mocks.orderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.orderFindMany.mock.calls[0][0].where.status).toEqual({ in: ['pending', 'in-progress'] })
    // ready "pick-up shelf" poizvedba prav tako scoped
    expect(mocks.orderFindMany.mock.calls[1][0].where.locationId).toBe(LOC_A)
    expect(mocks.orderFindMany.mock.calls[1][0].where.status).toBe('ready')
  })

  it('?locationId bypass je ignoriran za lokacijskega admina', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await kitchenGET(new Request(`http://localhost:3000/api/kitchen?locationId=${LOC_B}`))
    expect(mocks.orderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.orderFindMany.mock.calls[1][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin: brez locationId ključa (nikoli { locationId: null })', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await kitchenGET(new Request('http://localhost:3000/api/kitchen'))
    expect(res.status).toBe(200)
    for (const call of mocks.orderFindMany.mock.calls) {
      expect(Object.prototype.hasOwnProperty.call(call[0].where, 'locationId')).toBe(false)
    }
  })
})

describe('R85-4a M1: GET /api/kitchen/matrix — tenant scope', () => {
  it('regular user brez locationId → 403 fail-closed, NI poizvedb', async () => {
    mockSession({ role: 'waiter', locationId: null })
    const res = await kitchenMatrixGET(new Request('http://localhost:3000/api/kitchen/matrix'))
    expect(res.status).toBe(403)
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
  })

  it('loc-bound admin: where.locationId === LOC_A', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await kitchenMatrixGET(new Request('http://localhost:3000/api/kitchen/matrix'))
    expect(res.status).toBe(200)
    const where = mocks.orderFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A)
    expect(where.status).toEqual({ in: ['pending', 'in-progress', 'ready'] })
  })

  it('?locationId bypass je ignoriran', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await kitchenMatrixGET(new Request(`http://localhost:3000/api/kitchen/matrix?locationId=${LOC_B}`))
    expect(mocks.orderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin: brez locationId ključa', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await kitchenMatrixGET(new Request('http://localhost:3000/api/kitchen/matrix'))
    const where = mocks.orderFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// M2 — RESERVATIONS
// ══════════════════════════════════════════════════════════════════
describe('R85-4a M2: GET /api/reservations — tenant scope', () => {
  it('regular user brez locationId → 403, vseh 4 poizvedb = 0', async () => {
    mockSession({ role: 'waiter', locationId: null })
    const res = await reservationsGET(new Request('http://localhost:3000/api/reservations'))
    expect(res.status).toBe(403)
    expect(mocks.resFindMany).not.toHaveBeenCalled()
    expect(mocks.resCount).not.toHaveBeenCalled()
    expect(mocks.resGroupBy).not.toHaveBeenCalled()
    expect(mocks.resAggregate).not.toHaveBeenCalled()
  })

  it('loc-bound admin: findMany + count + groupBy + aggregate vse locationId', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await reservationsGET(new Request('http://localhost:3000/api/reservations'))
    expect(res.status).toBe(200)
    expect(mocks.resFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.resCount.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.resGroupBy.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.resAggregate.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('?locationId bypass je ignoriran (PII)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await reservationsGET(new Request(`http://localhost:3000/api/reservations?locationId=${LOC_B}`))
    expect(mocks.resFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.resAggregate.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin: brez locationId ključa v vseh where-clavzih', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await reservationsGET(new Request('http://localhost:3000/api/reservations'))
    expect(res.status).toBe(200)
    for (const m of [mocks.resFindMany, mocks.resCount, mocks.resGroupBy, mocks.resAggregate]) {
      expect(Object.prototype.hasOwnProperty.call(m.mock.calls[0][0].where, 'locationId')).toBe(false)
    }
  })
})

describe('R85-4a M2: POST /api/reservations — cross-tenant tableId guard + locationId žig', () => {
  it('cross-tenant tableId (tuja miza) → 404, BREZ transakcije/create', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.tableFindUnique.mockResolvedValue(tableB) // miza lokacije B
    const res = await reservationsPOST(
      jsonReq('http://localhost:3000/api/reservations', { ...RES_POST_BODY, tableId: 'table-b' }),
    )
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Miza ni najden')
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.txResCreate).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('?locationId bypass ne premaga table guard (404 kljub tuji mizi)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.tableFindUnique.mockResolvedValue(tableB)
    const res = await reservationsPOST(
      jsonReq(`http://localhost:3000/api/reservations?locationId=${LOC_B}`, { ...RES_POST_BODY, tableId: 'table-b' }),
    )
    expect(res.status).toBe(404)
    expect(mocks.txResCreate).not.toHaveBeenCalled()
  })

  it('lastna miza: create žig locationId === LOC_A', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await reservationsPOST(
      jsonReq('http://localhost:3000/api/reservations', { ...RES_POST_BODY, tableId: 'table-a' }),
    )
    expect(res.status).toBe(201)
    expect(mocks.txResCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
    expect(mocks.txResCreate.mock.calls[0][0].data.tableId).toBe('table-a')
  })

  it('brez mize (walk-in): create žig scope.locationId', async () => {
    mockSession({ role: 'waiter', locationId: LOC_A })
    const res = await reservationsPOST(jsonReq('http://localhost:3000/api/reservations', RES_POST_BODY))
    expect(res.status).toBe(201)
    expect(mocks.txResCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('super-admin s tujo mizo: data-derived žig table.locationId (LOC_B)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.tableFindUnique.mockResolvedValue(tableB)
    const res = await reservationsPOST(
      jsonReq('http://localhost:3000/api/reservations', { ...RES_POST_BODY, tableId: 'table-b' }),
    )
    expect(res.status).toBe(201)
    expect(mocks.txResCreate.mock.calls[0][0].data.locationId).toBe(LOC_B)
  })

  it('super-admin brez lokacije IN brez mize → 400 fail-closed (prej žig PRVE lokacije v DB)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await reservationsPOST(jsonReq('http://localhost:3000/api/reservations', RES_POST_BODY))
    expect(res.status).toBe(400)
    expect(mocks.txResCreate).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('regular user brez locationId → 403, NI poizvedb', async () => {
    mockSession({ role: 'waiter', locationId: null })
    const res = await reservationsPOST(jsonReq('http://localhost:3000/api/reservations', RES_POST_BODY))
    expect(res.status).toBe(403)
    expect(mocks.tableFindUnique).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})

describe('R85-4a M2: PUT/DELETE /api/reservations/[id] — fail-closed resolver', () => {
  it('regular user brez locationId → 403 + NI findFirst (prej fail-open globalni update)', async () => {
    mockSession({ role: 'waiter', locationId: null })
    const res = await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { notes: 'x' }, 'PUT'),
      { params: Promise.resolve({ id: 'res-1' }) },
    )
    expect(res.status).toBe(403)
    expect(mocks.resFindFirst).not.toHaveBeenCalled()
    expect(mocks.resUpdate).not.toHaveBeenCalled()
  })

  it('loc-bound admin: findFirst where = { id, locationId: LOC_A }', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { notes: 'x' }, 'PUT'),
      { params: Promise.resolve({ id: 'res-1' }) },
    )
    expect(res.status).toBe(200)
    const where = mocks.resFindFirst.mock.calls[0][0].where
    expect(where.id).toBe('res-1')
    expect(where.locationId).toBe(LOC_A)
  })

  it('PUT s tujim tableId → 404 notInScopeResponse + NI update', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.tableFindFirst.mockResolvedValue(null) // miza izven scopa
    const res = await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { tableId: 'table-b' }, 'PUT'),
      { params: Promise.resolve({ id: 'res-1' }) },
    )
    expect(res.status).toBe(404)
    expect(mocks.resUpdate).not.toHaveBeenCalled()
  })

  it('super-admin: findFirst where brez locationId ključa', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await reservationsPUT(
      jsonReq('http://localhost:3000/api/reservations/res-1', { notes: 'x' }, 'PUT'),
      { params: Promise.resolve({ id: 'res-1' }) },
    )
    const where = mocks.resFindFirst.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })

  it('DELETE: regular brez locationId → 403 + NI update; loc-bound: where.locationId pin', async () => {
    mockSession({ role: 'waiter', locationId: null })
    const denied = await reservationsDELETE(
      new Request('http://localhost:3000/api/reservations/res-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'res-1' }) },
    )
    expect(denied.status).toBe(403)
    expect(mocks.resFindFirst).not.toHaveBeenCalled()
    expect(mocks.resUpdate).not.toHaveBeenCalled()

    mockSession({ role: 'admin', locationId: LOC_A })
    const ok = await reservationsDELETE(
      new Request('http://localhost:3000/api/reservations/res-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'res-1' }) },
    )
    expect(ok.status).toBe(200)
    expect(mocks.resFindFirst.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// M3 — WAITLIST
// ══════════════════════════════════════════════════════════════════
describe('R85-4a M3: GET /api/waitlist — tenant scope (PII)', () => {
  it('regular user brez locationId → 403 fail-closed, NI poizvedb', async () => {
    mockSession({ role: 'waiter', locationId: null })
    const res = await waitlistGET(new Request('http://localhost:3000/api/waitlist'))
    expect(res.status).toBe(403)
    expect(mocks.waitlistFindMany).not.toHaveBeenCalled()
  })

  it('loc-bound admin: where.locationId === LOC_A + status filter ohranjen', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await waitlistGET(new Request('http://localhost:3000/api/waitlist'))
    expect(res.status).toBe(200)
    const where = mocks.waitlistFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A)
    expect(where.status).toEqual({ in: ['waiting', 'notified'] })
  })

  it('?locationId bypass je ignoriran', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await waitlistGET(new Request(`http://localhost:3000/api/waitlist?locationId=${LOC_B}`))
    expect(mocks.waitlistFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin: brez locationId ključa (vidi tudi legacy NULL)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await waitlistGET(new Request('http://localhost:3000/api/waitlist'))
    const where = mocks.waitlistFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })
})

describe('R85-4a M3: POST /api/waitlist — locationId žig', () => {
  const BODY = { guestName: 'Marko', partySize: 2 }

  it('regular user brez locationId → 403, create NI klican (prej NULL žig globalnega vnosa)', async () => {
    mockSession({ role: 'waiter', locationId: null })
    const res = await waitlistPOST(jsonReq('http://localhost:3000/api/waitlist', BODY))
    expect(res.status).toBe(403)
    expect(mocks.waitlistCreate).not.toHaveBeenCalled()
  })

  it('loc-bound uporabnik: create data.locationId === LOC_A', async () => {
    mockSession({ role: 'waiter', locationId: LOC_A })
    const res = await waitlistPOST(jsonReq('http://localhost:3000/api/waitlist', BODY))
    expect(res.status).toBe(201)
    expect(mocks.waitlistCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
    expect(mocks.waitlistCreate.mock.calls[0][0].data.guestName).toBe('Marko')
  })

  it('super-admin: NULL žig (legacy, viden samo globalnemu pogledu)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await waitlistPOST(jsonReq('http://localhost:3000/api/waitlist', BODY))
    expect(res.status).toBe(201)
    expect(mocks.waitlistCreate.mock.calls[0][0].data.locationId).toBeNull()
  })
})

describe('R85-4a M3: PUT/DELETE /api/waitlist/[id] — fail-closed + seat tableId guard', () => {
  it('PUT: regular user brez locationId → 403 + NI findFirst (prej fail-open)', async () => {
    mockSession({ role: 'waiter', locationId: null })
    const res = await waitlistPUT(
      jsonReq('http://localhost:3000/api/waitlist/wl-1', { notes: 'x' }, 'PUT'),
      { params: Promise.resolve({ id: 'wl-1' }) },
    )
    expect(res.status).toBe(403)
    expect(mocks.waitlistFindFirst).not.toHaveBeenCalled()
    expect(mocks.waitlistUpdate).not.toHaveBeenCalled()
  })

  it("PUT 'seat' s TUJO mizo → 404 notInScopeResponse + NI update", async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.tableFindFirst.mockResolvedValue(null)
    const res = await waitlistPUT(
      jsonReq('http://localhost:3000/api/waitlist/wl-1', { action: 'seat', tableId: 'table-b' }, 'PUT'),
      { params: Promise.resolve({ id: 'wl-1' }) },
    )
    expect(res.status).toBe(404)
    expect(mocks.waitlistUpdate).not.toHaveBeenCalled()
  })

  it("PUT 'seat' z lastno mizo: table guard where.locationId pin + update izveden", async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await waitlistPUT(
      jsonReq('http://localhost:3000/api/waitlist/wl-1', { action: 'seat', tableId: 'table-a' }, 'PUT'),
      { params: Promise.resolve({ id: 'wl-1' }) },
    )
    expect(res.status).toBe(200)
    const tableWhere = mocks.tableFindFirst.mock.calls[0][0].where
    expect(tableWhere.id).toBe('table-a')
    expect(tableWhere.locationId).toBe(LOC_A)
    const updateData = mocks.waitlistUpdate.mock.calls[0][0].data
    expect(updateData.status).toBe('seated')
    expect(updateData.tableId).toBe('table-a')
  })

  it("PUT 'seat' BREZ tableId: table guard se ne sproži (ni where.locationId filtra na mizi)", async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await waitlistPUT(
      jsonReq('http://localhost:3000/api/waitlist/wl-1', { action: 'seat' }, 'PUT'),
      { params: Promise.resolve({ id: 'wl-1' }) },
    )
    expect(res.status).toBe(200)
    expect(mocks.tableFindFirst).not.toHaveBeenCalled()
    expect(mocks.waitlistUpdate.mock.calls[0][0].data.status).toBe('seated')
  })

  it('loc-bound admin: findFirst where = { id, locationId: LOC_A }; super-admin: brez ključa', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await waitlistPUT(
      jsonReq('http://localhost:3000/api/waitlist/wl-1', { notes: 'x' }, 'PUT'),
      { params: Promise.resolve({ id: 'wl-1' }) },
    )
    const where = mocks.waitlistFindFirst.mock.calls[0][0].where
    expect(where.id).toBe('wl-1')
    expect(where.locationId).toBe(LOC_A)

    mockSession({ role: 'super_admin', locationId: null })
    await waitlistPUT(
      jsonReq('http://localhost:3000/api/waitlist/wl-1', { notes: 'x' }, 'PUT'),
      { params: Promise.resolve({ id: 'wl-1' }) },
    )
    const whereSuper = mocks.waitlistFindFirst.mock.calls[1][0].where
    expect(Object.prototype.hasOwnProperty.call(whereSuper, 'locationId')).toBe(false)
  })

  it('DELETE: regular brez locationId → 403 + NI delete; loc-bound: where.locationId pin', async () => {
    mockSession({ role: 'waiter', locationId: null })
    const denied = await waitlistDELETE(
      new Request('http://localhost:3000/api/waitlist/wl-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'wl-1' }) },
    )
    expect(denied.status).toBe(403)
    expect(mocks.waitlistFindFirst).not.toHaveBeenCalled()
    expect(mocks.waitlistDelete).not.toHaveBeenCalled()

    mockSession({ role: 'admin', locationId: LOC_A })
    const ok = await waitlistDELETE(
      new Request('http://localhost:3000/api/waitlist/wl-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'wl-1' }) },
    )
    expect(ok.status).toBe(200)
    expect(mocks.waitlistFindFirst.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.waitlistDelete).toHaveBeenCalled()
  })
})
