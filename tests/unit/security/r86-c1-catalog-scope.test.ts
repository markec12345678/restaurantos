// ============================================
// R86-2c1 — CATALOG/CONFIG SCOPE WAVE (M2 raw-spread fail-open razred)
// ============================================
// Regresija za val popravkov katalog/konfiguracija domen (tabele, menu-items,
// opening-hours, locations, guests/[id]). Vzorec napaka (R85-FINAL-2 M2):
// raw spread `session?.locationId ?? undefined` / `?? null` / `|| null` je
// FAIL-OPEN za non-admin sejo z NULL lokacijo (session-store/session-lifecycle
// :114-170 sprejme null locationId za VSE role; hasPermission :48 spusti
// non-admin rolo z 'admin' permissionom iz Job-a).
//
// FIX vzorec: centralni resolver resolveTenantLocationIdOrThrow (REALNI modul
// '@/lib/tenant-scope' — NI mockan) + pogojni spread / isWithinScope.
// null scope (super-admin) = PRAZEN filter, NIKOLI { locationId: null }.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  tableFindFirst: vi.fn(),
  tableFindMany: vi.fn(),
  tableUpdate: vi.fn(),
  tableDelete: vi.fn(),
  orderFindMany: vi.fn(),
  orderGroupBy: vi.fn(),
  menuItemFindFirst: vi.fn(),
  menuItemUpdate: vi.fn(),
  categoryFindUnique: vi.fn(),
  guestFindUnique: vi.fn(),
  openingHoursFindUnique: vi.fn(),
  openingHoursUpdate: vi.fn(),
  openingHoursDelete: vi.fn(),
  openingHoursDeleteMany: vi.fn(),
  openingHoursCreateMany: vi.fn(),
  openingHoursCreate: vi.fn(),
  locationFindUnique: vi.fn(),
  locationFindMany: vi.fn(),
  locationCreate: vi.fn(),
  locationCount: vi.fn(),
  resolveLocationId: vi.fn(),
  fetchSourceMenus: vi.fn(),
  syncMenusToTargets: vi.fn(),
  transaction: vi.fn(),
}))

// Auth middleware: mock requireAuth — REALNI tenant-scope resolver iz
// '@/lib/tenant-scope' ni mockan (route-ji ga uvažajo kanonsko).
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/db', () => ({
  db: {
    table: {
      findFirst: mocks.tableFindFirst,
      findMany: mocks.tableFindMany,
      update: mocks.tableUpdate,
      delete: mocks.tableDelete,
    },
    order: { findMany: mocks.orderFindMany, groupBy: mocks.orderGroupBy },
    menuItem: { findFirst: mocks.menuItemFindFirst, update: mocks.menuItemUpdate },
    category: { findUnique: mocks.categoryFindUnique },
    guest: { findUnique: mocks.guestFindUnique, update: vi.fn() },
    openingHours: {
      findUnique: mocks.openingHoursFindUnique,
      update: mocks.openingHoursUpdate,
      delete: mocks.openingHoursDelete,
      deleteMany: mocks.openingHoursDeleteMany,
      createMany: mocks.openingHoursCreateMany,
      create: mocks.openingHoursCreate,
    },
    location: {
      findUnique: mocks.locationFindUnique,
      findMany: mocks.locationFindMany,
      create: mocks.locationCreate,
      count: mocks.locationCount,
    },
    $transaction: mocks.transaction,
  },
  // createAuditLog je TOP-LEVEL export iz '@/lib/db'
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/api-utils', () => ({
  parseJsonBody: vi.fn(async (req: Request) => {
    try {
      const text = await req.text()
      return { data: text ? JSON.parse(text) : {}, error: null }
    } catch {
      return { data: null, error: new Response(JSON.stringify({ error: 'Bad JSON' }), { status: 400 }) }
    }
  }),
  validateRequest: vi.fn(async (req: Request) => {
    try {
      const text = await req.text()
      return { data: text ? JSON.parse(text) : {}, error: null }
    } catch {
      return { data: null, error: new Response(JSON.stringify({ error: 'Bad JSON' }), { status: 400 }) }
    }
  }),
  validateBody: <T>(_schema: unknown, data: T) => ({ data, error: null }),
  handleApiError: (_e: unknown, _ctx: string, msg: string) =>
    new Response(JSON.stringify({ error: msg }), { status: 500 }),
}))

vi.mock('@/lib/location-fallback', () => ({
  resolveLocationId: mocks.resolveLocationId,
  getFirstLocationId: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/secret-masks', () => ({
  maskLocationSecrets: <T>(v: T): T => v,
}))

vi.mock('@/app/api/locations/sync/_helpers', () => ({
  locationSyncSchema: {},
  fetchSourceMenus: mocks.fetchSourceMenus,
  syncMenusToTargets: mocks.syncMenusToTargets,
  fetchMenuComparison: vi.fn().mockResolvedValue({}),
  buildMenuComparison: vi.fn(() => []),
}))

import { PUT as tablePUT, DELETE as tableDELETE } from '@/app/api/tables/[id]/route'
import { GET as tableQrGET } from '@/app/api/tables/[id]/qr/route'
import { POST as tableMergePOST } from '@/app/api/tables/merge/route'
import { GET as qrBatchGET } from '@/app/api/tables/qr-batch/route'
import { PUT as menuItemPUT, DELETE as menuItemDELETE } from '@/app/api/menu-items/[id]/route'
import { POST as openingHoursPOST } from '@/app/api/opening-hours/route'
import { PATCH as openingHoursPATCH } from '@/app/api/opening-hours/[id]/route'
import { GET as locationsGET, POST as locationsPOST } from '@/app/api/locations/route'
import { GET as locationByIdGET, PUT as locationByIdPUT } from '@/app/api/locations/[id]/route'
import { POST as syncPOST, GET as syncGET } from '@/app/api/locations/sync/route'
import { GET as guestGET } from '@/app/api/guests/[id]/route'

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

type SessionOverride = { role?: string; locationId?: string | null; permissions?: string[] }

/** M2 vektor: non-admin vloga z 'admin' permissionom (prek Job-a) + NULL lokacija. */
function mockSession(overrides: SessionOverride = {}) {
  const { role = 'staff', locationId = LOC_A, permissions } = overrides
  mocks.requireAuth.mockResolvedValue({
    session: {
      employeeId: 'emp-1',
      role,
      locationId,
      permissions: permissions ?? (role === 'admin' || role === 'super_admin' ? ['admin'] : ['take_orders', 'manage_inventory']),
      error: null,
    },
    error: null,
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.tableFindFirst.mockResolvedValue(null)
  mocks.tableFindMany.mockResolvedValue([])
  mocks.tableUpdate.mockResolvedValue({ id: 't-1', number: 5 })
  mocks.tableDelete.mockResolvedValue({ id: 't-1' })
  mocks.orderFindMany.mockResolvedValue([])
  mocks.orderGroupBy.mockResolvedValue([])
  mocks.menuItemFindFirst.mockResolvedValue(null)
  mocks.menuItemUpdate.mockResolvedValue({ id: 'mi-1' })
  mocks.categoryFindUnique.mockResolvedValue(null)
  mocks.guestFindUnique.mockResolvedValue(null)
  mocks.openingHoursFindUnique.mockResolvedValue(null)
  mocks.openingHoursUpdate.mockResolvedValue({ id: 'oh-1' })
  mocks.openingHoursDelete.mockResolvedValue({ id: 'oh-1' })
  mocks.openingHoursDeleteMany.mockResolvedValue({ count: 0 })
  mocks.openingHoursCreateMany.mockResolvedValue({ count: 7 })
  mocks.openingHoursCreate.mockResolvedValue({ id: 'oh-1' })
  mocks.locationFindUnique.mockResolvedValue(null)
  mocks.locationFindMany.mockResolvedValue([])
  mocks.locationCreate.mockResolvedValue({ id: 'loc-new' })
  mocks.locationCount.mockResolvedValue(0)
  mocks.resolveLocationId.mockResolvedValue(null)
  mocks.fetchSourceMenus.mockResolvedValue([])
  mocks.syncMenusToTargets.mockResolvedValue([])
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}))
})

// ══════════════════════════════════════════════════════════════════
// A. TABLES [id] — PUT/DELETE (M2 raw spread)
// ══════════════════════════════════════════════════════════════════
describe('R86-2c1 A: /api/tables/[id] — M2 fail-open → resolver', () => {
  it('PUT: staff z NULL lokacijo → 403, NIČ db klicev (prej globalni findFirst + update)', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await tablePUT(jsonReq('http://localhost:3000/api/tables/t-1', 'PUT', { number: 99 }), params('t-1'))
    expect(res.status).toBe(403)
    expect(mocks.tableFindFirst).not.toHaveBeenCalled()
    expect(mocks.tableUpdate).not.toHaveBeenCalled()
  })

  it('PUT: staff lokacije A + tuja miza → 404, where pripet na LOC_A, update NI klican', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    const res = await tablePUT(jsonReq('http://localhost:3000/api/tables/t-foreign', 'PUT', { number: 99 }), params('t-foreign'))
    expect(res.status).toBe(404)
    expect(mocks.tableFindFirst.mock.calls[0][0].where).toEqual({ id: 't-foreign', locationId: LOC_A })
    expect(mocks.tableUpdate).not.toHaveBeenCalled()
  })

  it('PUT: super-admin (null) → brez locationId ključa, update teče', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.tableFindFirst.mockResolvedValue({ id: 't-1', number: 5 })
    const res = await tablePUT(jsonReq('http://localhost:3000/api/tables/t-1', 'PUT', { number: 99 }), params('t-1'))
    expect(res.status).toBe(200)
    const where = mocks.tableFindFirst.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
    expect(mocks.tableUpdate).toHaveBeenCalled()
  })

  it('DELETE: staff z NULL lokacijo → 403, NIČ db klicev (prej cross-tenant hard delete)', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await tableDELETE(jsonReq('http://localhost:3000/api/tables/t-1', 'DELETE'), params('t-1'))
    expect(res.status).toBe(403)
    expect(mocks.tableFindFirst).not.toHaveBeenCalled()
    expect(mocks.tableDelete).not.toHaveBeenCalled()
  })

  it('DELETE: staff lokacije A + tuja miza → 404, delete NI klican', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    const res = await tableDELETE(jsonReq('http://localhost:3000/api/tables/t-foreign', 'DELETE'), params('t-foreign'))
    expect(res.status).toBe(404)
    expect(mocks.tableFindFirst.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.tableDelete).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// B. TABLES [id]/qr + qr-batch
// ══════════════════════════════════════════════════════════════════
describe('R86-2c1 B: /api/tables/[id]/qr in qr-batch', () => {
  it('qr: staff z NULL lokacijo → 403, findFirst NI klican (prej QR tuje mize)', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await tableQrGET(jsonReq('http://localhost:3000/api/tables/t-1/qr', 'GET'), params('t-1'))
    expect(res.status).toBe(403)
    expect(mocks.tableFindFirst).not.toHaveBeenCalled()
  })

  it('qr: staff lokacije A + tuja miza → 404, where pripet', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    const res = await tableQrGET(jsonReq('http://localhost:3000/api/tables/t-foreign/qr', 'GET'), params('t-foreign'))
    expect(res.status).toBe(404)
    expect(mocks.tableFindFirst.mock.calls[0][0].where).toEqual({ id: 't-foreign', locationId: LOC_A })
  })

  it('qr-batch: staff z NULL lokacijo → 403, findMany NI klican', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await qrBatchGET(jsonReq('http://localhost:3000/api/tables/qr-batch', 'GET'))
    expect(res.status).toBe(403)
    expect(mocks.tableFindMany).not.toHaveBeenCalled()
  })

  it('qr-batch: staff lokacije A → findMany pripet na LOC_A', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    await qrBatchGET(jsonReq('http://localhost:3000/api/tables/qr-batch', 'GET'))
    expect(mocks.tableFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('qr-batch: super-admin → brez locationId ključa (nikoli { locationId: null })', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await qrBatchGET(jsonReq('http://localhost:3000/api/tables/qr-batch', 'GET'))
    const where = mocks.tableFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// C. TABLES MERGE — cross-tenant PAR guard (obe mizi v scope-u)
// ══════════════════════════════════════════════════════════════════
describe('R86-2c1 C: /api/tables/merge — cross-tenant par', () => {
  it('staff z NULL lokacijo → 403, NIČ db klicev, NI transakcije', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await tableMergePOST(jsonReq('http://localhost:3000/api/tables/merge', 'POST', {
      sourceTableId: 'ts-1', targetTableId: 'tt-1',
    }))
    expect(res.status).toBe(403)
    expect(mocks.tableFindFirst).not.toHaveBeenCalled()
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('staff lokacije A: target miza tuja (B) → 404, merge NE teče (ni order poizvedbe)', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.tableFindFirst
      .mockResolvedValueOnce({ id: 'ts-1', number: 1, locationId: LOC_A })
      .mockResolvedValueOnce(null) // target je na LOC_B → scoped findFirst = null
    const res = await tableMergePOST(jsonReq('http://localhost:3000/api/tables/merge', 'POST', {
      sourceTableId: 'ts-1', targetTableId: 'tt-foreign',
    }))
    expect(res.status).toBe(404)
    expect(mocks.orderFindMany).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('staff lokacije A: OBE findFirst poizvedbi pripeti na LOC_A (par guard)', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.tableFindFirst
      .mockResolvedValueOnce({ id: 'ts-1', number: 1, locationId: LOC_A })
      .mockResolvedValueOnce({ id: 'tt-1', number: 2, locationId: LOC_A })
    await tableMergePOST(jsonReq('http://localhost:3000/api/tables/merge', 'POST', {
      sourceTableId: 'ts-1', targetTableId: 'tt-1',
    }))
    expect(mocks.tableFindFirst.mock.calls[0][0].where).toEqual({ id: 'ts-1', locationId: LOC_A })
    expect(mocks.tableFindFirst.mock.calls[1][0].where).toEqual({ id: 'tt-1', locationId: LOC_A })
  })

  it('super-admin (null) → findFirst brez locationId ključa (isti-location check ostane)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.tableFindFirst
      .mockResolvedValueOnce({ id: 'ts-1', number: 1, locationId: LOC_B })
      .mockResolvedValueOnce({ id: 'tt-1', number: 2, locationId: LOC_B })
    await tableMergePOST(jsonReq('http://localhost:3000/api/tables/merge', 'POST', {
      sourceTableId: 'ts-1', targetTableId: 'tt-1',
    }))
    expect(Object.prototype.hasOwnProperty.call(mocks.tableFindFirst.mock.calls[0][0].where, 'locationId')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(mocks.tableFindFirst.mock.calls[1][0].where, 'locationId')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// D. MENU-ITEMS [id] — M2 + permission pariteta (POST ima manage_inventory)
// ══════════════════════════════════════════════════════════════════
describe('R86-2c1 D: /api/menu-items/[id] — M2 + gate pariteta', () => {
  it('PUT: staff z NULL lokacijo → 403, NIČ db klicev (prej cross-tenant update cene)', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await menuItemPUT(jsonReq('http://localhost:3000/api/menu-items/mi-1', 'PUT', { price: 1 }), params('mi-1'))
    expect(res.status).toBe(403)
    expect(mocks.menuItemFindFirst).not.toHaveBeenCalled()
    expect(mocks.menuItemUpdate).not.toHaveBeenCalled()
  })

  it('PUT: staff lokacije A + tuj artikel → 404, where.category.menu pripet, update NI klican', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    const res = await menuItemPUT(jsonReq('http://localhost:3000/api/menu-items/mi-foreign', 'PUT', { price: 1 }), params('mi-foreign'))
    expect(res.status).toBe(404)
    expect(mocks.menuItemFindFirst.mock.calls[0][0].where.category).toEqual({ menu: { locationId: LOC_A } })
    expect(mocks.menuItemUpdate).not.toHaveBeenCalled()
  })

  it('DELETE: staff z NULL lokacijo → 403, NIČ db klicev (prej cross-tenant soft-delete)', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await menuItemDELETE(jsonReq('http://localhost:3000/api/menu-items/mi-1', 'DELETE'), params('mi-1'))
    expect(res.status).toBe(403)
    expect(mocks.menuItemFindFirst).not.toHaveBeenCalled()
    expect(mocks.menuItemUpdate).not.toHaveBeenCalled()
  })

  it('DELETE: staff lokacije A + tuj artikel → 404, soft-delete NI izveden', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    const res = await menuItemDELETE(jsonReq('http://localhost:3000/api/menu-items/mi-foreign', 'DELETE'), params('mi-foreign'))
    expect(res.status).toBe(404)
    expect(mocks.menuItemFindFirst.mock.calls[0][0].where.category).toEqual({ menu: { locationId: LOC_A } })
    expect(mocks.menuItemUpdate).not.toHaveBeenCalled()
  })

  it('gate pariteta: PUT in DELETE zahtevata manage_inventory (isti gate kot POST)', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.menuItemFindFirst.mockResolvedValue({ id: 'mi-1', categoryId: 'c-1', category: { menu: { locationId: LOC_A } } })
    await menuItemPUT(jsonReq('http://localhost:3000/api/menu-items/mi-1', 'PUT', { price: 1 }), params('mi-1'))
    await menuItemDELETE(jsonReq('http://localhost:3000/api/menu-items/mi-1', 'DELETE'), params('mi-1'))
    const putCall = mocks.requireAuth.mock.calls.find((c: unknown[]) => (c[1] as { permission?: string })?.permission !== undefined && (c[1] as { permission?: string }).permission === 'manage_inventory')
    expect(putCall).toBeDefined()
    expect(mocks.requireAuth.mock.calls[0][1]).toEqual({ permission: 'manage_inventory' })
    expect(mocks.requireAuth.mock.calls[1][1]).toEqual({ permission: 'manage_inventory' })
  })
})

// ══════════════════════════════════════════════════════════════════
// E. OPENING-HOURS — POST raw `|| null` + [id] isWithinScope fail-open
// ══════════════════════════════════════════════════════════════════
describe('R86-2c1 E: /api/opening-hours — batch POST + [id] PATCH', () => {
  it('batch POST: staff z admin-permissonom + NULL lokacijo → 403, NIČ pisnih klicev', async () => {
    mockSession({ role: 'staff', locationId: null, permissions: ['admin'] })
    const res = await openingHoursPOST(jsonReq('http://localhost:3000/api/opening-hours', 'POST', {
      locationId: LOC_B,
      hours: [{ dayOfWeek: 1 }],
    }))
    expect(res.status).toBe(403)
    expect(mocks.openingHoursDeleteMany).not.toHaveBeenCalled()
    expect(mocks.openingHoursCreateMany).not.toHaveBeenCalled()
  })

  it('batch POST: lokacijski admin + tuji body.locationId → deleteMany na SESSION lokaciji (strip)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await openingHoursPOST(jsonReq('http://localhost:3000/api/opening-hours', 'POST', {
      locationId: LOC_B,
      hours: [{ dayOfWeek: 1 }],
    }))
    expect(res.status).toBe(201)
    expect(mocks.openingHoursDeleteMany).toHaveBeenCalledWith({ where: { locationId: LOC_A } })
  })

  it('single POST: staff z NULL lokacijo → 403, create NI klican (prej poljuben body.locationId)', async () => {
    mockSession({ role: 'staff', locationId: null, permissions: ['admin'] })
    const res = await openingHoursPOST(jsonReq('http://localhost:3000/api/opening-hours', 'POST', {
      dayOfWeek: 2, locationId: LOC_B,
    }))
    expect(res.status).toBe(403)
    expect(mocks.openingHoursCreate).not.toHaveBeenCalled()
  })

  it('PATCH [id]: staff z admin-permissonom + NULL lokacijo → 403 PRED db (prej isWithinScope(null) bypass)', async () => {
    mockSession({ role: 'staff', locationId: null, permissions: ['admin'] })
    const res = await openingHoursPATCH(jsonReq('http://localhost:3000/api/opening-hours/oh-1', 'PATCH', { openTime: '09:00' }), params('oh-1'))
    expect(res.status).toBe(403)
    expect(mocks.openingHoursFindUnique).not.toHaveBeenCalled()
    expect(mocks.openingHoursUpdate).not.toHaveBeenCalled()
  })

  it('PATCH [id]: super-admin (null) → globalni dostop, update teče', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.openingHoursFindUnique.mockResolvedValue({ id: 'oh-1', locationId: LOC_B })
    const res = await openingHoursPATCH(jsonReq('http://localhost:3000/api/opening-hours/oh-1', 'PATCH', { openTime: '09:00' }), params('oh-1'))
    expect(res.status).toBe(200)
    expect(mocks.openingHoursUpdate).toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// F. LOCATIONS — GET (seznam + stats), [id] guard, POST subscriptionId
// ══════════════════════════════════════════════════════════════════
describe('R86-2c1 F: /api/locations — tenant-root scope', () => {
  it('GET: staff z admin-permissonom + NULL lokacijo → 403, NIČ db klicev (prej VSE lokacije + globalni counts)', async () => {
    mockSession({ role: 'staff', locationId: null, permissions: ['admin'] })
    const res = await locationsGET(jsonReq('http://localhost:3000/api/locations', 'GET'))
    expect(res.status).toBe(403)
    expect(mocks.locationFindMany).not.toHaveBeenCalled()
    expect(mocks.locationCount).not.toHaveBeenCalled()
  })

  it('GET: lokacijski admin → findMany where.id = LOC_A, stats counts scoped', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.locationFindMany.mockResolvedValue([{ id: LOC_A }])
    const res = await locationsGET(jsonReq('http://localhost:3000/api/locations', 'GET'))
    expect(res.status).toBe(200)
    expect(mocks.locationFindMany.mock.calls[0][0].where.id).toBe(LOC_A)
    // stats: total count mora biti scoped (prej globalni platform counts)
    expect(mocks.locationCount.mock.calls[0][0].where).toEqual({ id: LOC_A })
  })

  it('[id] GET: lokacijski admin + tuja lokacija → 404, findUnique NI klican', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await locationByIdGET(jsonReq(`http://localhost:3000/api/locations/${LOC_B}`, 'GET'), params(LOC_B))
    expect(res.status).toBe(404)
    expect(mocks.locationFindUnique).not.toHaveBeenCalled()
  })

  it('[id] PUT: staff z admin-permissonom + NULL lokacijo → 403 PRED db (prej pisanje po poljubni lokaciji)', async () => {
    mockSession({ role: 'staff', locationId: null, permissions: ['admin'] })
    const res = await locationByIdPUT(jsonReq(`http://localhost:3000/api/locations/${LOC_B}`, 'PUT', { name: 'Hacked' }), params(LOC_B))
    expect(res.status).toBe(403)
    expect(mocks.locationFindUnique).not.toHaveBeenCalled()
  })

  it('POST: lokacijski admin → subscriptionId IZPELJAN iz lastne lokacije (body sub-B STRIPAN)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.locationFindUnique
      .mockResolvedValueOnce(null) // code-uniqueness check
      .mockResolvedValueOnce({ subscriptionId: 'sub-A' }) // own location lookup
    const res = await locationsPOST(jsonReq('http://localhost:3000/api/locations', 'POST', {
      name: 'Nova', code: 'NOVA1', subscriptionId: 'sub-B',
    }))
    expect(res.status).toBe(201)
    expect(mocks.locationCreate.mock.calls[0][0].data.subscriptionId).toBe('sub-A')
  })

  it('POST: super-admin (null) → izrecen body.subscriptionId sprejet (provisioning)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.locationFindUnique.mockResolvedValue(null)
    const res = await locationsPOST(jsonReq('http://localhost:3000/api/locations', 'POST', {
      name: 'Nova B', code: 'NOVA2', subscriptionId: 'sub-B',
    }))
    expect(res.status).toBe(201)
    expect(mocks.locationCreate.mock.calls[0][0].data.subscriptionId).toBe('sub-B')
  })
})

// ══════════════════════════════════════════════════════════════════
// G. LOCATIONS SYNC — POST guard + GET globalni prihodki
// ══════════════════════════════════════════════════════════════════
describe('R86-2c1 G: /api/locations/sync — cross-location operacija', () => {
  it('POST: staff z admin-permissonom + NULL lokacijo → 403, NIČ db klicev (prej sync poljubnega para)', async () => {
    mockSession({ role: 'staff', locationId: null, permissions: ['admin'] })
    const res = await syncPOST(jsonReq('http://localhost:3000/api/locations/sync', 'POST', {
      sourceLocationId: LOC_B, targetLocationIds: [LOC_B],
    }))
    expect(res.status).toBe(403)
    expect(mocks.locationFindUnique).not.toHaveBeenCalled()
    expect(mocks.fetchSourceMenus).not.toHaveBeenCalled()
  })

  it('GET: staff z admin-permissonom + NULL lokacijo → 403, NIČ db klicev (prej globalni prihodki groupBy)', async () => {
    mockSession({ role: 'staff', locationId: null, permissions: ['admin'] })
    const res = await syncGET(jsonReq('http://localhost:3000/api/locations/sync', 'GET'))
    expect(res.status).toBe(403)
    expect(mocks.locationFindMany).not.toHaveBeenCalled()
    expect(mocks.orderGroupBy).not.toHaveBeenCalled()
  })

  it('GET: lokacijski admin → findMany pripet na svojo lokacijo, groupBy.locationId pripet', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.locationFindMany.mockResolvedValue([{ id: LOC_A, name: 'A', code: 'A', _count: {} }])
    const res = await syncGET(jsonReq('http://localhost:3000/api/locations/sync', 'GET'))
    expect(res.status).toBe(200)
    expect(mocks.locationFindMany.mock.calls[0][0].where.id).toBe(LOC_A)
    expect(mocks.orderGroupBy.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.orderGroupBy.mock.calls[1][0].where.locationId).toBe(LOC_A)
  })
})

// ══════════════════════════════════════════════════════════════════
// H. GUESTS [id] — orders include fail-open (Guest zapis ostane globalen
//    BY DESIGN, ampak cross-tenant naročila v include so bila prej vidna)
// ══════════════════════════════════════════════════════════════════
describe('R86-2c1 H: /api/guests/[id] — orders include scope', () => {
  it('GET: staff z NULL lokacijo → 403, findUnique NI klican (prej orders iz VSEH tenantov)', async () => {
    mockSession({ role: 'staff', locationId: null })
    const res = await guestGET(jsonReq('http://localhost:3000/api/guests/g-1', 'GET'), params('g-1'))
    expect(res.status).toBe(403)
    expect(mocks.guestFindUnique).not.toHaveBeenCalled()
  })

  it('GET: staff lokacije A → orders include pripet na LOC_A', async () => {
    mockSession({ role: 'staff', locationId: LOC_A })
    mocks.guestFindUnique.mockResolvedValue({ id: 'g-1', firstName: 'A', lastName: 'B', orders: [] })
    const res = await guestGET(jsonReq('http://localhost:3000/api/guests/g-1', 'GET'), params('g-1'))
    expect(res.status).toBe(200)
    expect(mocks.guestFindUnique.mock.calls[0][0].include.orders.where.locationId).toBe(LOC_A)
  })

  it('GET: super-admin (null) → orders include brez locationId ključa (vidi vse)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.guestFindUnique.mockResolvedValue({ id: 'g-1', firstName: 'A', lastName: 'B', orders: [] })
    const res = await guestGET(jsonReq('http://localhost:3000/api/guests/g-1', 'GET'), params('g-1'))
    expect(res.status).toBe(200)
    const where = mocks.guestFindUnique.mock.calls[0][0].include.orders.where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })
})
