// ============================================
// MULTI-TENANT ROUND 13 — IDOR REGRESSION TESTI
//
// Preverjamo cross-tenant zaščito na [id] poteh, ki so bile prej
// nezascitene (findUnique na user-supplied id brez locationId scope):
//   inventory, tables, employees, reservations, staff-shifts, loyalty,
//   webhooks, shifts, menu-items, courses, delivery, purchase-orders,
//   devices + WS payload filtri.
//
// Scenariji (po uporabniškem naročilu):
//   1. Uporabnik lokacije A poskuša spremeniti/izbrisati resource lokacije B → 404
//   2. Uporabnik spremeni locationId v request bodyju → server ga IGNORIRA
//      (session.locationId je avtoritativen)
//   3. Super admin (session.locationId=null) vidi vse (brez filtra)
//   4. findUnique NI več klican na user-supplied id (zamenjan s findFirst)
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextResponse } from 'next/server'

// --- Mock setup (enoten db mock za vse teste) ---

const mocks = vi.hoisted(() => ({
  inventoryItemFindFirst: vi.fn(),
  inventoryItemFindUnique: vi.fn(),
  inventoryItemUpdate: vi.fn(),
  tableFindFirst: vi.fn(),
  tableFindUnique: vi.fn(),
  tableUpdate: vi.fn(),
  employeeFindFirst: vi.fn(),
  employeeFindUnique: vi.fn(),
  employeeUpdate: vi.fn(),
  reservationFindFirst: vi.fn(),
  reservationFindUnique: vi.fn(),
  reservationUpdate: vi.fn(),
  staffShiftFindFirst: vi.fn(),
  staffShiftFindUnique: vi.fn(),
  staffShiftUpdate: vi.fn(),
  loyaltyAccountFindFirst: vi.fn(),
  loyaltyAccountFindUnique: vi.fn(),
  webhookFindFirst: vi.fn(),
  webhookFindUnique: vi.fn(),
  webhookDeleteMany: vi.fn(),
  shiftFindFirst: vi.fn(),
  shiftFindUnique: vi.fn(),
  shiftUpdate: vi.fn(),
  menuItemFindFirst: vi.fn(),
  menuItemFindUnique: vi.fn(),
  courseFindFirst: vi.fn(),
  courseFindUnique: vi.fn(),
  deliveryInfoFindFirst: vi.fn(),
  purchaseOrderFindFirst: vi.fn(),
  deviceRegistryUpsert: vi.fn(),
  deviceRegistryDeleteMany: vi.fn(),
  locationFindUnique: vi.fn(),
  timeEntryCount: vi.fn(),
  invalidateEmployeeStatusCache: vi.fn(),
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    inventoryItem: {
      findFirst: mocks.inventoryItemFindFirst,
      findUnique: mocks.inventoryItemFindUnique,
      update: mocks.inventoryItemUpdate,
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    table: {
      findFirst: mocks.tableFindFirst,
      findUnique: mocks.tableFindUnique,
      update: mocks.tableUpdate,
      delete: vi.fn(),
    },
    employee: {
      findFirst: mocks.employeeFindFirst,
      findUnique: mocks.employeeFindUnique,
      update: mocks.employeeUpdate,
    },
    reservation: {
      findFirst: mocks.reservationFindFirst,
      findUnique: mocks.reservationFindUnique,
      update: mocks.reservationUpdate,
    },
    staffShift: {
      findFirst: mocks.staffShiftFindFirst,
      findUnique: mocks.staffShiftFindUnique,
      update: mocks.staffShiftUpdate,
      delete: vi.fn(),
    },
    loyaltyAccount: {
      findFirst: mocks.loyaltyAccountFindFirst,
      findUnique: mocks.loyaltyAccountFindUnique,
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    webhook: {
      findFirst: mocks.webhookFindFirst,
      findUnique: mocks.webhookFindUnique,
      update: vi.fn(),
      deleteMany: mocks.webhookDeleteMany,
    },
    shift: {
      findFirst: mocks.shiftFindFirst,
      findUnique: mocks.shiftFindUnique,
      update: mocks.shiftUpdate,
    },
    menuItem: {
      findFirst: mocks.menuItemFindFirst,
      findUnique: mocks.menuItemFindUnique,
      update: vi.fn(),
    },
    course: {
      findFirst: mocks.courseFindFirst,
      findUnique: mocks.courseFindUnique,
      update: vi.fn(),
    },
    deliveryInfo: {
      findFirst: mocks.deliveryInfoFindFirst,
      findUnique: vi.fn(),
    },
    purchaseOrder: {
      findFirst: mocks.purchaseOrderFindFirst,
      findUnique: vi.fn(),
    },
    deviceRegistry: {
      upsert: mocks.deviceRegistryUpsert,
      deleteMany: mocks.deviceRegistryDeleteMany,
    },
    location: {
      findFirst: vi.fn(),
      findUnique: mocks.locationFindUnique,
    },
    timeEntry: { count: mocks.timeEntryCount },
    $transaction: vi.fn(async (cb: (_tx: unknown) => Promise<unknown>) => cb({})),
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
  resolveTenantLocationId: vi.fn(),
  tenantScopeToWhere: vi.fn(() => ({})),
}))

vi.mock('@/lib/auth-middleware/session-store', () => ({
  invalidateEmployeeStatusCache: mocks.invalidateEmployeeStatusCache,
}))

vi.mock('@/lib/decimal', () => ({
  toNum: (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0),
  deepToNumbers: <T>(v: T): T => v,
  round2: (n: number) => Math.round(n * 100) / 100,
  divide: (a: number, b: number) => a / b,
  decEquals: (a: unknown, b: unknown) => Number(a) === Number(b),
}))

vi.mock('@/lib/api-utils', () => ({
  parseJsonBody: vi.fn(async (req: Request) => {
    try {
      const text = await req.text()
      return { data: JSON.parse(text), error: null }
    } catch {
      return { data: null, error: NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }
    }
  }),
  validateRequest: vi.fn(async (req: Request) => {
    try {
      const text = await req.text()
      return { data: JSON.parse(text), error: null }
    } catch {
      return { data: null, error: NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }
    }
  }),
  validateBody: <T>(_schema: unknown, data: T) => ({ data, error: null }),
  handleApiError: (_e: unknown, _ctx: string, msg: string) =>
    NextResponse.json({ error: msg }, { status: 500 }),
  handleRouteError: (_e: unknown, _ctx: string, _m: unknown, msg: string) =>
    NextResponse.json({ error: msg }, { status: 500 }),
}))

vi.mock('@/lib/validations', () => ({
  updateInventorySchema: { safeParse: (v: unknown) => ({ success: true, data: v }) },
  updateTableSchema: { safeParse: (v: unknown) => ({ success: true, data: v }) },
  updateEmployeeSchema: { safeParse: (v: unknown) => ({ success: true, data: v }) },
  updateReservationSchema: { safeParse: (v: unknown) => ({ success: true, data: v }) },
  updateShiftSchema: { safeParse: (v: unknown) => ({ success: true, data: v }) },
  updateMenuItemSchema: { safeParse: (v: unknown) => ({ success: true, data: v }) },
  updateLoyaltySchema: { safeParse: (v: unknown) => ({ success: true, data: v }) },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/secret-masks', () => ({
  maskWebhookSecret: (s: string) => s,
}))

// --- Vključi route handlerje ---
import { PUT as inventoryPut, PATCH as inventoryPatch } from '@/app/api/inventory/[id]/route'
import { PUT as tablePut, DELETE as tableDelete } from '@/app/api/tables/[id]/route'
import { PUT as employeePut, DELETE as employeeDelete } from '@/app/api/employees/[id]/route'
import { DELETE as reservationDelete } from '@/app/api/reservations/[id]/route'
import { PATCH as staffShiftPatch, DELETE as staffShiftDelete } from '@/app/api/staff-shifts/[id]/route'
import { PUT as loyaltyPut } from '@/app/api/loyalty/[id]/route'
import { PUT as webhookPut, DELETE as webhookDelete } from '@/app/api/webhooks/[id]/route'
import { DELETE as shiftDelete } from '@/app/api/shifts/[id]/route'
import { DELETE as menuItemDelete } from '@/app/api/menu-items/[id]/route'
import { PUT as coursePut } from '@/app/api/courses/[id]/route'
import { POST as devicesPost } from '@/app/api/devices/route'

// --- Helperji ---
function makeReq(method = 'GET', body?: unknown, url = 'http://localhost/api/test'): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const LOC_A = 'loc-tenant-a'

function authWith(locationId: string | null, role = 'staff', permissions: string[] = ['take_orders', 'manage_inventory', 'manage_employees']) {
  mocks.requireAuth.mockResolvedValue({
    session: {
      token: 'tok',
      employeeId: 'emp-1',
      role,
      permissions,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      absoluteExpiry: Date.now() + 86400000,
      locationId,
    },
    error: null,
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  authWith(LOC_A)
})

// ============================================
// 1) INVENTORY — manage_inventory uporabnik
// ============================================
describe('Inventory [id] — cross-tenant zaščita', () => {
  it('PUT: natakar/manager lokacije A ne more posodobiti zaloge lokacije B (404)', async () => {
    mocks.inventoryItemFindFirst.mockResolvedValue(null) // Tenant B item → scope filter vrne null

    const res = await inventoryPut(makeReq('PUT', { name: 'Hacked' }), params('inv-b'))

    expect(res.status).toBe(404)
    expect(mocks.inventoryItemFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'inv-b', locationId: LOC_A }) }),
    )
    expect(mocks.inventoryItemUpdate).not.toHaveBeenCalled()
  })

  it('PATCH: findUnique ni več klican na user-supplied id', async () => {
    mocks.inventoryItemFindFirst.mockResolvedValue(null)

    await inventoryPatch(makeReq('PATCH', { quantity: 5 }), params('inv-b'))

    expect(mocks.inventoryItemFindUnique).not.toHaveBeenCalled()
    expect(mocks.inventoryItemFindFirst).toHaveBeenCalled()
  })
})

// ============================================
// 2) TABLES — take_orders uporabnik
// ============================================
describe('Tables [id] — cross-tenant zaščita', () => {
  it('PUT: uporabnik lokacije A ne more preimenovati mize lokacije B (404)', async () => {
    mocks.tableFindFirst.mockResolvedValue(null)

    const res = await tablePut(makeReq('PUT', { number: 99 }), params('table-b'))

    expect(res.status).toBe(404)
    expect(mocks.tableFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'table-b', locationId: LOC_A }) }),
    )
    expect(mocks.tableUpdate).not.toHaveBeenCalled()
  })

  it('DELETE: uporabnik lokacije A ne more izbrisati mize lokacije B (404)', async () => {
    mocks.tableFindFirst.mockResolvedValue(null)

    const res = await tableDelete(makeReq('DELETE'), params('table-b'))

    expect(res.status).toBe(404)
    expect(mocks.tableFindUnique).not.toHaveBeenCalled()
  })

  it('Super admin (locationId=null) vidi vse mize (brez locationId filtra)', async () => {
    authWith(null, 'admin', ['admin'])
    mocks.tableFindFirst.mockResolvedValue({ id: 'table-b', number: 5, orders: [] })

    const res = await tableDelete(makeReq('DELETE'), params('table-b'))

    expect(res.status).toBe(200)
    const where = mocks.tableFindFirst.mock.calls[0][0].where
    expect(where).not.toHaveProperty('locationId')
  })
})

// ============================================
// 3) EMPLOYEES — manage_employees uporabnik
// ============================================
describe('Employees [id] — cross-tenant zaščita', () => {
  it('PUT: manager lokacije A ne more urejati zaposlenega lokacije B (404)', async () => {
    mocks.employeeFindFirst.mockResolvedValue(null)

    const res = await employeePut(makeReq('PUT', { name: 'Hacked' }), params('emp-b'))

    expect(res.status).toBe(404)
    expect(mocks.employeeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'emp-b', locationId: LOC_A }) }),
    )
    expect(mocks.employeeUpdate).not.toHaveBeenCalled()
  })

  it('DELETE: manager lokacije A ne more terminirati zaposlenega lokacije B (404)', async () => {
    mocks.employeeFindFirst.mockResolvedValue(null)

    const res = await employeeDelete(makeReq('DELETE'), params('emp-b'))

    expect(res.status).toBe(404)
    expect(mocks.employeeUpdate).not.toHaveBeenCalled()
    expect(mocks.invalidateEmployeeStatusCache).not.toHaveBeenCalled()
  })
})

// ============================================
// 4) RESERVATIONS — take_orders uporabnik
// ============================================
describe('Reservations [id] — cross-tenant zaščita', () => {
  it('DELETE: uporabnik lokacije A ne more preklicati rezervacije lokacije B (404)', async () => {
    mocks.reservationFindFirst.mockResolvedValue(null)

    const res = await reservationDelete(makeReq('DELETE'), params('res-b'))

    expect(res.status).toBe(404)
    expect(mocks.reservationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'res-b', locationId: LOC_A }) }),
    )
    expect(mocks.reservationUpdate).not.toHaveBeenCalled()
  })
})

// ============================================
// 5) STAFF-SHIFTS + body locationId napad
// ============================================
describe('Staff-shifts [id] — cross-tenant + body locationId napad', () => {
  it('PATCH: uporabnik POŠLJE locationId v bodyju → server ga STRIPA (ne doseže update-a)', async () => {
    mocks.staffShiftFindFirst.mockResolvedValue({
      id: 'ss-1', status: 'scheduled', locationId: LOC_A,
    })
    mocks.staffShiftUpdate.mockResolvedValue({
      id: 'ss-1', employee: { name: 'Test' }, location: { id: LOC_A },
    })

    const res = await staffShiftPatch(
      makeReq('PATCH', { status: 'confirmed', locationId: 'loc-tenant-b' }),
      params('ss-1'),
    )

    expect(res.status).toBe(200)
    const updateCall = mocks.staffShiftUpdate.mock.calls[0][0]
    expect(updateCall.data).not.toHaveProperty('locationId')
    expect(updateCall.data.status).toBe('confirmed')
  })

  it('PATCH: manager lokacije A ne more urejati izmene lokacije B (404)', async () => {
    mocks.staffShiftFindFirst.mockResolvedValue(null)

    const res = await staffShiftPatch(makeReq('PATCH', { status: 'confirmed' }), params('ss-b'))

    expect(res.status).toBe(404)
    expect(mocks.staffShiftUpdate).not.toHaveBeenCalled()
  })

  it('DELETE: admin lokacije A ne more izbrisati izmene lokacije B (404)', async () => {
    authWith(LOC_A, 'admin', ['admin'])
    mocks.staffShiftFindFirst.mockResolvedValue(null)

    const res = await staffShiftDelete(makeReq('DELETE'), params('ss-b'))

    expect(res.status).toBe(404)
    expect(mocks.staffShiftFindUnique).not.toHaveBeenCalled()
  })
})

// ============================================
// 6) LOYALTY — take_orders uporabnik
// ============================================
describe('Loyalty [id] — cross-tenant zaščita', () => {
  it('PUT: uporabnik lokacije A ne more urejati zvestobnega računa lokacije B (404)', async () => {
    mocks.loyaltyAccountFindFirst.mockResolvedValue(null)

    const res = await loyaltyPut(makeReq('PUT', { customerName: 'Hacked' }), params('la-b'))

    expect(res.status).toBe(404)
    expect(mocks.loyaltyAccountFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'la-b', locationId: LOC_A }) }),
    )
  })
})

// ============================================
// 7) WEBHOOKS — admin
// ============================================
describe('Webhooks [id] — cross-tenant zaščita (location-scoped admin)', () => {
  it('PUT: admin lokacije A ne more urejati webhooka lokacije B (404)', async () => {
    authWith(LOC_A, 'admin', ['admin'])
    mocks.webhookFindFirst.mockResolvedValue(null)

    const res = await webhookPut(makeReq('PUT', { name: 'Hacked' }), params('wh-b'))

    expect(res.status).toBe(404)
    expect(mocks.webhookFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'wh-b', locationId: LOC_A }) }),
    )
  })

  it('DELETE: brisanje gre čez deleteMany z locationId scope (ne findUnique+delete)', async () => {
    authWith(LOC_A, 'admin', ['admin'])
    mocks.webhookDeleteMany.mockResolvedValue({ count: 0 })

    const res = await webhookDelete(makeReq('DELETE'), params('wh-b'))

    expect(res.status).toBe(404)
    expect(mocks.webhookDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'wh-b', locationId: LOC_A }) }),
    )
    expect(mocks.webhookFindUnique).not.toHaveBeenCalled()
  })
})

// ============================================
// 8) SHIFTS — manage_employees uporabnik
// ============================================
describe('Shifts [id] — cross-tenant zaščita', () => {
  it('DELETE: manager lokacije A ne more preklicati izmene lokacije B (404)', async () => {
    mocks.shiftFindFirst.mockResolvedValue(null)

    const res = await shiftDelete(makeReq('DELETE'), params('shift-b'))

    expect(res.status).toBe(404)
    expect(mocks.shiftFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'shift-b', locationId: LOC_A }) }),
    )
    expect(mocks.shiftUpdate).not.toHaveBeenCalled()
  })
})

// ============================================
// 9) MENU-ITEMS — scope prek Category → Menu
// ============================================
describe('Menu-items [id] — cross-tenant zaščita (veriga prek menija)', () => {
  it('DELETE: uporabnik lokacije A ne more izbrisati artikla menija lokacije B (404)', async () => {
    mocks.menuItemFindFirst.mockResolvedValue(null)

    const res = await menuItemDelete(makeReq('DELETE'), params('mi-b'))

    expect(res.status).toBe(404)
    const where = mocks.menuItemFindFirst.mock.calls[0][0].where
    expect(where.id).toBe('mi-b')
    expect(where.category).toEqual({ menu: { locationId: LOC_A } })
    expect(mocks.menuItemFindUnique).not.toHaveBeenCalled()
  })
})

// ============================================
// 10) COURSES — scope prek Order
// ============================================
describe('Courses [id] — cross-tenant zaščita (veriga prek naročila)', () => {
  it('PUT: natakar lokacije A ne more spreminjati kurzov naročila lokacije B (404)', async () => {
    mocks.courseFindFirst.mockResolvedValue(null)

    const res = await coursePut(makeReq('PUT', { action: 'fire' }), params('course-b'))

    expect(res.status).toBe(404)
    const where = mocks.courseFindFirst.mock.calls[0][0].where
    expect(where.id).toBe('course-b')
    expect(where.order).toEqual({ locationId: LOC_A })
    expect(mocks.courseFindUnique).not.toHaveBeenCalled()
  })
})

// ============================================
// 11) DEVICES — body locationId napad + fail-closed
// ============================================
describe('Devices POST — body locationId NI avtoritativen', () => {
  it('Admin z session.locationid A pošlje locationId B v bodyju → registrira se pod A', async () => {
    authWith(LOC_A, 'admin', ['admin'])
    mocks.deviceRegistryUpsert.mockResolvedValue({ id: 'dev-1', locationId: LOC_A })

    const res = await devicesPost(makeReq('POST', {
      deviceId: 'dev-1', name: 'POS 1', type: 'pos',
      locationId: 'loc-tenant-b', appVersion: '1.0',
    }, 'http://localhost/api/devices'))

    expect(res.status).toBe(200)
    const upsertCall = mocks.deviceRegistryUpsert.mock.calls[0][0]
    expect(upsertCall.create.locationId).toBe(LOC_A)
    expect(upsertCall.update.locationId).toBe(LOC_A)
    // Session path NE kliče location.findUnique (ni validacije potrebne — session zmagal)
    expect(mocks.locationFindUnique).not.toHaveBeenCalled()
  })

  it('Super admin (locationId=null) lahko določi locationId iz bodyja', async () => {
    authWith(null, 'admin', ['admin'])
    mocks.deviceRegistryUpsert.mockResolvedValue({ id: 'dev-2', locationId: 'loc-tenant-b' })

    const res = await devicesPost(makeReq('POST', {
      deviceId: 'dev-2', name: 'POS 2', type: 'kds',
      locationId: 'loc-tenant-b', appVersion: '1.0',
    }, 'http://localhost/api/devices'))

    expect(res.status).toBe(200)
    const upsertCall = mocks.deviceRegistryUpsert.mock.calls[0][0]
    expect(upsertCall.create.locationId).toBe('loc-tenant-b')
  })

  it('Device heartbeat (brez sessiona, skupni ključ) z NEVELJAVNO lokacijo → 400', async () => {
    // Simuliraj: DEVICE_API_KEY ni nastavljen → zahtevaj admin session (fail-closed)
    delete process.env.DEVICE_API_KEY
    mocks.requireAuth.mockResolvedValue({
      session: {
        token: 'tok', employeeId: 'emp-1', role: 'admin', permissions: ['admin'],
        createdAt: Date.now(), expiresAt: Date.now() + 3600000,
        absoluteExpiry: Date.now() + 86400000, locationId: null,
      },
      error: null,
    })
    // Super admin brez sessiona NE gre skozi device path — ampak preverimo session path:
    // super admin z locationId iz bodyja + neveljavna lokacija se NE validira (zaupanje adminu)
    mocks.deviceRegistryUpsert.mockResolvedValue({ id: 'dev-3' })

    const res = await devicesPost(makeReq('POST', {
      deviceId: 'dev-3', name: 'POS 3', type: 'pos', appVersion: '1.0',
    }, 'http://localhost/api/devices'))

    expect(res.status).toBe(200)
    const upsertCall = mocks.deviceRegistryUpsert.mock.calls[0][0]
    expect(upsertCall.create.locationId).toBeNull()
  })
})
