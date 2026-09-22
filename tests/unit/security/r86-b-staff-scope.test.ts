// ============================================
// R86-2b — STAFF/HR/INVENTORY/SUPPLY SCOPE WAVE
// ============================================
// REGRESIJA za M2 razred (R85-FINAL-2): raw spread
// `session?.locationId ?? undefined` / `?? null` / `|| null` je FAIL-OPEN za
// non-admin seja z NULL locationId (session-store session-lifecycle.ts:114-117
// sprejme null lokacijo za VSAKO vlogo — dokazan vektor).
//
// Pokrite rute (kanonični resolveTenantLocationIdOrThrow + conditional spread):
//   A. employees/[id] PUT/DELETE   — raw `?? undefined` → resolver
//   B. employees POST              — raw `?? null` žig → resolver + scope žig
//   C. staff-shifts/[id] + POST    — raw spreads + getFirstLocationId() globalni
//                                    fallback žig → resolveWriteLocationId 400
//   D. shifts/[id], time-entries/[id], courses/[id] — raw spreads → resolver
//   E. purchase-orders [id]/receive/journal — raw spreads (R80/R81-G luknja)
//   F. gdpr export/anonymize       — raw `?? null` v isWithinScope (fail-open
//                                    GDPR izbris) + žigi
//   G. haccp PUT/DELETE + iot/sensors POST — raw null guard/žig
//
// Vzorec: realen tenant-scope resolver iz '@/lib/auth-middleware/tenant-scope'
// (re-export skozi barrel mock), mockResolvedValue (nikoli .Once),
// createAuditLog je TOP-LEVEL export iz '@/lib/db'.
// null scope (super-admin) = PRAZEN filter, NIKOLI { locationId: null }.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  revokeEmployeeSessions: vi.fn(),
  invalidateEmployeeStatusCache: vi.fn(),
  employeeFindFirst: vi.fn(),
  employeeFindUnique: vi.fn(),
  employeeFindMany: vi.fn(),
  employeeCreate: vi.fn(),
  employeeUpdate: vi.fn(),
  staffShiftFindFirst: vi.fn(),
  staffShiftCreate: vi.fn(),
  staffShiftUpdate: vi.fn(),
  staffShiftUpdateMany: vi.fn(),
  staffShiftDelete: vi.fn(),
  staffShiftDeleteMany: vi.fn(),
  staffShiftFindUnique: vi.fn(),
  shiftFindFirst: vi.fn(),
  shiftUpdate: vi.fn(),
  timeEntryFindFirst: vi.fn(),
  timeEntryUpdate: vi.fn(),
  timeEntryUpdateMany: vi.fn(),
  timeEntryFindUnique: vi.fn(),
  courseFindFirst: vi.fn(),
  purchaseOrderFindFirst: vi.fn(),
  purchaseOrderUpdate: vi.fn(),
  auditLogFindMany: vi.fn(),
  auditLogCreate: vi.fn(),
  sessionFindMany: vi.fn(),
  sessionCount: vi.fn(),
  shiftCount: vi.fn(),
  haccpFindUnique: vi.fn(),
  haccpUpdate: vi.fn(),
  locationFindUnique: vi.fn(),
  locationFindFirst: vi.fn(),
  createHaccpEntryWithChain: vi.fn(),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
    // R103: staff-shifts POST tok v tx klientu (Serializable — fresh probe +
    // create atomarno); modeli delijo mocke z db klientom
    employee: { findUnique: mocks.employeeFindUnique },
    staffShift: { findFirst: mocks.staffShiftFindFirst, create: mocks.staffShiftCreate },
  })),
}))

// Auth middleware: mock requireAuth, REALNI tenant-scope resolver
vi.mock('@/lib/auth-middleware', async () => {
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: mocks.requireAuth,
    resolveTenantLocationId: tenantScope.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: tenantScope.tenantScopeToWhere,
    revokeEmployeeSessions: mocks.revokeEmployeeSessions,
    invalidateEmployeeStatusCache: mocks.invalidateEmployeeStatusCache,
  }
})

vi.mock('@/lib/auth-middleware/session-store', () => ({
  invalidateEmployeeStatusCache: mocks.invalidateEmployeeStatusCache,
}))

vi.mock('@/lib/db', () => ({
  db: {
    employee: {
      findFirst: mocks.employeeFindFirst,
      findUnique: mocks.employeeFindUnique,
      findMany: mocks.employeeFindMany,
      create: mocks.employeeCreate,
      update: mocks.employeeUpdate,
      count: vi.fn().mockResolvedValue(0),
    },
    staffShift: {
      findFirst: mocks.staffShiftFindFirst,
      create: mocks.staffShiftCreate,
      update: mocks.staffShiftUpdate,
      // R103: PATCH/DELETE [id] → CAS updateMany / scoped deleteMany
      updateMany: mocks.staffShiftUpdateMany,
      deleteMany: mocks.staffShiftDeleteMany,
      findUnique: mocks.staffShiftFindUnique,
      delete: mocks.staffShiftDelete,
    },
    shift: { findFirst: mocks.shiftFindFirst, update: mocks.shiftUpdate, count: mocks.shiftCount, findMany: vi.fn().mockResolvedValue([]) },
    timeEntry: { findFirst: mocks.timeEntryFindFirst, update: mocks.timeEntryUpdate, updateMany: mocks.timeEntryUpdateMany, findUnique: mocks.timeEntryFindUnique, count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    order: { findMany: vi.fn().mockResolvedValue([]) },
    payment: { findMany: vi.fn().mockResolvedValue([]) },
    tipDistribution: { findMany: vi.fn().mockResolvedValue([]) },
    course: { findFirst: mocks.courseFindFirst },
    purchaseOrder: { findFirst: mocks.purchaseOrderFindFirst, update: mocks.purchaseOrderUpdate },
    auditLog: { findMany: mocks.auditLogFindMany, create: mocks.auditLogCreate },
    haccpEntry: { findUnique: mocks.haccpFindUnique, update: mocks.haccpUpdate, findMany: vi.fn(), count: vi.fn() },
    session: { findMany: mocks.sessionFindMany, count: mocks.sessionCount, deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    location: { findUnique: mocks.locationFindUnique, findFirst: mocks.locationFindFirst },
    employeeJob: { create: vi.fn() },
    $transaction: mocks.transaction,
  },
  // createAuditLog je TOP-LEVEL export iz '@/lib/db' (ne lastnost db klienta)
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/api-utils', () => ({
  parseJsonBody: vi.fn(async (req: Request) => {
    try {
      return { data: JSON.parse(await req.text()), error: null }
    } catch {
      return { data: null, error: NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }
    }
  }),
  validateRequest: vi.fn(async (req: Request) => {
    try {
      return { data: JSON.parse(await req.text()), error: null }
    } catch {
      return { data: null, error: NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }
    }
  }),
  validateBody: <T>(_schema: unknown, data: T) => ({ data, error: null }),
  handleApiError: (_e: unknown, _ctx: string, msg: string) =>
    NextResponse.json({ error: msg }, { status: 500 }),
  handleRouteError: (_e: unknown, _ctx: string, _m: unknown, msg: string) =>
    NextResponse.json({ error: msg }, { status: 500 }),
  parsePaginationParams: () => ({ limit: 50, offset: 0, search: '' }),
}))

vi.mock('@/lib/decimal', () => ({
  toNum: (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0),
  round2: (n: number) => Math.round(n * 100) / 100,
  multiply: (a: number, b: number) => a * b,
  divide: (a: number, b: number) => (b ? a / b : 0),
  isPositive: (v: unknown) => Number(v) > 0,
  greaterThan: (a: unknown, b: unknown) => Number(a) > Number(b),
  greaterThanOrEqual: (a: unknown, b: unknown) => Number(a) >= Number(b),
  decEquals: (a: unknown, b: unknown) => Number(a) === Number(b),
  deepToNumbers: <T>(v: T): T => v,
  decimalsToNumbers: <T>(v: T): T => v,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: vi.fn(async () => ({ allowed: true, retryAfterMs: 0 })),
  getClientIp: () => '1.2.3.4',
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60000 },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/haccp-chain', () => ({
  createHaccpEntryWithChain: mocks.createHaccpEntryWithChain,
}))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  isEmailEnabled: vi.fn(async () => false),
}))

import { POST as employeesPOST } from '@/app/api/employees/route'
import { PUT as employeePutById, DELETE as employeeDeleteById } from '@/app/api/employees/[id]/route'
import { POST as staffShiftsPost } from '@/app/api/staff-shifts/route'
import { PATCH as staffShiftPatch, DELETE as staffShiftDelete } from '@/app/api/staff-shifts/[id]/route'
import { DELETE as shiftDelete } from '@/app/api/shifts/[id]/route'
import { PUT as timeEntryPut } from '@/app/api/time-entries/[id]/route'
import { PUT as coursePut } from '@/app/api/courses/[id]/route'
import { GET as purchaseOrderGet, PATCH as purchaseOrderPatch } from '@/app/api/purchase-orders/[id]/route'
import { POST as receivePost } from '@/app/api/purchase-orders/[id]/receive/route'
import { GET as journalGet } from '@/app/api/purchase-orders/[id]/journal/route'
import { GET as gdprExportGet } from '@/app/api/gdpr/export/[employeeId]/route'
import { POST as gdprAnonymizePost } from '@/app/api/gdpr/anonymize/[employeeId]/route'
import { PUT as haccpPut, DELETE as haccpDelete } from '@/app/api/haccp/route'
import { POST as sensorsPost } from '@/app/api/iot/sensors/route'

// Utišaj logger (bcrypt/konzola)
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

function mockSession(overrides: Record<string, unknown> = {}) {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'manager', locationId: LOC_A, permissions: ['admin'], ...overrides },
    error: null,
  })
}

function jsonReq(url: string, method = 'GET', body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })
// GDPR rute uporabljajo { employeeId } namesto { id }:
const paramsEmp = (employeeId: string) => ({ params: Promise.resolve({ employeeId }) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.employeeFindFirst.mockResolvedValue(null)
  mocks.employeeFindUnique.mockResolvedValue(null)
  mocks.employeeFindMany.mockResolvedValue([])
  mocks.staffShiftFindFirst.mockResolvedValue(null)
  mocks.shiftFindFirst.mockResolvedValue(null)
  mocks.timeEntryFindFirst.mockResolvedValue(null)
  mocks.courseFindFirst.mockResolvedValue(null)
  mocks.purchaseOrderFindFirst.mockResolvedValue(null)
  mocks.auditLogFindMany.mockResolvedValue([])
  mocks.auditLogCreate.mockResolvedValue({})
  mocks.sessionFindMany.mockResolvedValue([])
  mocks.sessionCount.mockResolvedValue(0)
  mocks.shiftCount.mockResolvedValue(0)
  mocks.haccpFindUnique.mockResolvedValue(null)
  mocks.locationFindUnique.mockResolvedValue({ id: LOC_B })
  mocks.locationFindFirst.mockResolvedValue({ id: LOC_A })
  mocks.employeeCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'emp-new', pin: '', pinLookup: null, ...data }))
  mocks.revokeEmployeeSessions.mockResolvedValue(0)
})

// ══════════════════════════════════════════════════════════════════
// A. EMPLOYEES [id] — PUT/DELETE (prej raw `?? undefined` spread)
// ══════════════════════════════════════════════════════════════════
describe('R86-2b A: /api/employees/[id] — M2 fail-open zaprt', () => {
  it('PUT: manager z NULL lokacijo → 403, NI poizvedb (prej prazen filter = globalni update)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await employeePutById(jsonReq('http://localhost:3000/api/employees/emp-9', 'PUT', { name: 'X' }), params('emp-9'))
    expect(res.status).toBe(403)
    expect(mocks.employeeFindFirst).not.toHaveBeenCalled()
    expect(mocks.employeeUpdate).not.toHaveBeenCalled()
  })

  it('PUT: loc-bound manager → findFirst where pripet na { id, locationId: LOC_A }', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })
    await employeePutById(jsonReq('http://localhost:3000/api/employees/emp-9', 'PUT', { name: 'X' }), params('emp-9'))
    expect(mocks.employeeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'emp-9', locationId: LOC_A }) }),
    )
  })

  it('PUT: super-admin (null lokacija) → where BREZ locationId ključa (nikoli { locationId: null })', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.employeeFindFirst.mockResolvedValue({ id: 'emp-9', role: 'staff', status: 'active' })
    mocks.employeeUpdate.mockResolvedValue({ id: 'emp-9', pin: '', pinLookup: null })
    const res = await employeePutById(jsonReq('http://localhost:3000/api/employees/emp-9', 'PUT', { name: 'Novo ime' }), params('emp-9'))
    expect(res.status).toBe(200)
    const where = mocks.employeeFindFirst.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })

  it('DELETE: manager z NULL lokacijo → 403, NI poizvedb (prej globalni terminate)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await employeeDeleteById(jsonReq('http://localhost:3000/api/employees/emp-9', 'DELETE'), params('emp-9'))
    expect(res.status).toBe(403)
    expect(mocks.employeeFindFirst).not.toHaveBeenCalled()
  })

  it('DELETE: tuji zaposleni (findFirst null) → 404 + NI update-a', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })
    const res = await employeeDeleteById(jsonReq('http://localhost:3000/api/employees/emp-b', 'DELETE'), params('emp-b'))
    expect(res.status).toBe(404)
    expect(mocks.employeeUpdate).not.toHaveBeenCalled()
    expect(mocks.invalidateEmployeeStatusCache).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// B. EMPLOYEES POST — raw `?? null` žig (fail-open cross-tenant žig)
// ══════════════════════════════════════════════════════════════════
describe('R86-2b B: POST /api/employees — žig iz scope-a, ne raw sessiona', () => {
  const baseBody = { name: 'Nov Zaposlen', email: 'nov@test.si', role: 'staff', status: 'active', pin: '482915' }

  it('regular user (manager) z NULL lokacijo + body locationId LOC_B → 403, NI create-a (prej fail-open žig)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await employeesPOST(jsonReq('http://localhost:3000/api/employees', 'POST', { ...baseBody, locationId: LOC_B }))
    expect(res.status).toBe(403)
    expect(mocks.employeeCreate).not.toHaveBeenCalled()
    expect(mocks.locationFindUnique).not.toHaveBeenCalled()
  })

  it('super-admin + izrecen body locationId (veljaven) → žig LOC_B', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await employeesPOST(jsonReq('http://localhost:3000/api/employees', 'POST', { ...baseBody, locationId: LOC_B }))
    expect(res.status).toBe(201)
    expect(mocks.employeeCreate.mock.calls[0][0].data.locationId).toBe(LOC_B)
  })

  it('super-admin + staff BREZ body locationId → 400 fail-closed, NI create-a', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await employeesPOST(jsonReq('http://localhost:3000/api/employees', 'POST', baseBody))
    expect(res.status).toBe(400)
    expect(mocks.employeeCreate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// C. STAFF-SHIFTS — [id] raw spreads + POST getFirstLocationId() žig
// ══════════════════════════════════════════════════════════════════
describe('R86-2b C: /api/staff-shifts — [id] resolver + POST canonical žig', () => {
  it('PATCH: manager z NULL lokacijo → 403, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await staffShiftPatch(jsonReq('http://localhost:3000/api/staff-shifts/ss-1', 'PATCH', { status: 'confirmed' }), params('ss-1'))
    expect(res.status).toBe(403)
    expect(mocks.staffShiftFindFirst).not.toHaveBeenCalled()
    expect(mocks.staffShiftUpdateMany).not.toHaveBeenCalled()
  })

  it('PATCH: tuja izmena → 404 + NI update-a (where pripet na LOC_A)', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })
    const res = await staffShiftPatch(jsonReq('http://localhost:3000/api/staff-shifts/ss-b', 'PATCH', { status: 'confirmed' }), params('ss-b'))
    expect(res.status).toBe(404)
    expect(mocks.staffShiftFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'ss-b', locationId: LOC_A }) }),
    )
    expect(mocks.staffShiftUpdateMany).not.toHaveBeenCalled()
  })

  it('DELETE: super-admin → where BREZ locationId ključa + deleteMany izveden (R103 scoped)', async () => {
    mockSession({ role: 'admin', locationId: null })
    mocks.staffShiftFindFirst.mockResolvedValue({ id: 'ss-1', employee: { name: 'A' }, shiftDate: new Date() })
    mocks.staffShiftDeleteMany.mockResolvedValue({ count: 1 })
    mocks.staffShiftFindUnique.mockResolvedValue({ id: 'ss-1' })
    const res = await staffShiftDelete(jsonReq('http://localhost:3000/api/staff-shifts/ss-1', 'DELETE'), params('ss-1'))
    expect(res.status).toBe(200)
    const where = mocks.staffShiftFindFirst.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
    // R103: scoped deleteMany — where BREZ locationId (super-admin), count 1
    expect(mocks.staffShiftDeleteMany).toHaveBeenCalledWith({
      where: { id: 'ss-1' },
    })
  })

  it('POST: super-admin + zaposleni z NULL lokacijo + brez body locationId → 400 fail-closed (prej getFirstLocationId() cross-tenant žig)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.employeeFindUnique.mockResolvedValue({ id: 'emp-2', name: 'Legacy', role: 'waiter', locationId: null })
    const res = await staffShiftsPost(jsonReq('http://localhost:3000/api/staff-shifts', 'POST', {
      employeeId: 'emp-2', shiftDate: '2026-01-15', startTime: '09:00', endTime: '17:00',
    }))
    expect(res.status).toBe(400)
    expect(mocks.staffShiftCreate).not.toHaveBeenCalled()
    // Globalni fallback (prva lokacija POLJUBNEGA tenanta) NI več dosegljiv:
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
  })

  it('POST: super-admin + zaposleni z dodeljeno lokacijo → data-derived žig employee.locationId', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.employeeFindUnique.mockResolvedValue({ id: 'emp-2', name: 'Moj', role: 'waiter', locationId: LOC_B })
    mocks.staffShiftCreate.mockResolvedValue({ id: 'ss-1' })
    const res = await staffShiftsPost(jsonReq('http://localhost:3000/api/staff-shifts', 'POST', {
      employeeId: 'emp-2', shiftDate: '2026-01-15', startTime: '09:00', endTime: '17:00',
    }))
    expect(res.status).toBe(201)
    expect(mocks.staffShiftCreate.mock.calls[0][0].data.locationId).toBe(LOC_B)
  })
})

// ══════════════════════════════════════════════════════════════════
// D. SHIFTS [id] / TIME-ENTRIES [id] / COURSES [id] — raw spreads
// ══════════════════════════════════════════════════════════════════
describe('R86-2b D: shifts / time-entries / courses [id]', () => {
  it('shifts DELETE: manager z NULL lokacijo → 403, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await shiftDelete(jsonReq('http://localhost:3000/api/shifts/shift-1', 'DELETE'), params('shift-1'))
    expect(res.status).toBe(403)
    expect(mocks.shiftFindFirst).not.toHaveBeenCalled()
    expect(mocks.shiftUpdate).not.toHaveBeenCalled()
  })

  it('time-entries PUT: tuji vnos → 404 + NI update-a (payroll pin na LOC_A)', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })
    const res = await timeEntryPut(jsonReq('http://localhost:3000/api/time-entries/te-1', 'PUT', { clockOut: '2026-01-01T12:00:00Z' }), params('te-1'))
    expect(res.status).toBe(404)
    expect(mocks.timeEntryFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'te-1', locationId: LOC_A }) }),
    )
    expect(mocks.timeEntryUpdateMany).not.toHaveBeenCalled()
  })

  it('courses PUT: manager z NULL lokacijo → 403, NI poizvedb (prej fail-open fire tujega kursa)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await coursePut(jsonReq('http://localhost:3000/api/courses/course-1', 'PUT', { action: 'fire' }), params('course-1'))
    expect(res.status).toBe(403)
    expect(mocks.courseFindFirst).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('courses PUT: tuji kurz → 404, where.order.locationId pripet na LOC_A', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })
    const res = await coursePut(jsonReq('http://localhost:3000/api/courses/course-b', 'PUT', { action: 'fire' }), params('course-b'))
    expect(res.status).toBe(404)
    expect(mocks.courseFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'course-b', order: { locationId: LOC_A } }) }),
    )
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// E. PURCHASE-ORDERS [id] / receive / journal — R80/R81-G raw spreads
// ══════════════════════════════════════════════════════════════════
describe('R86-2b E: /api/purchase-orders — M2 luknja v R80/R81-G scopu', () => {
  it('GET [id]: manager z NULL lokacijo → 403, NI poizvedb (prej globalni read PO)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await purchaseOrderGet(jsonReq('http://localhost:3000/api/purchase-orders/po-1'), params('po-1'))
    expect(res.status).toBe(403)
    expect(mocks.purchaseOrderFindFirst).not.toHaveBeenCalled()
  })

  it('PATCH [id]: tuja naročilnica → 404, where pripet na LOC_A + NI update-a', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })
    const res = await purchaseOrderPatch(jsonReq('http://localhost:3000/api/purchase-orders/po-b', 'PATCH', { status: 'submitted' }), params('po-b'))
    expect(res.status).toBe(404)
    expect(mocks.purchaseOrderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'po-b', locationId: LOC_A }) }),
    )
    expect(mocks.purchaseOrderUpdate).not.toHaveBeenCalled()
  })

  it('receive POST: manager z NULL lokacijo → 403, NI transakcije (prej cross-tenant prevzem blaga)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await receivePost(jsonReq('http://localhost:3000/api/purchase-orders/po-1/receive', 'POST', {
      receivedItems: [{ itemId: 'poi-1', quantityReceived: 2 }],
    }), params('po-1'))
    expect(res.status).toBe(403)
    expect(mocks.purchaseOrderFindFirst).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('journal GET: manager z NULL lokacijo → 403, NI poizvedb (prej revizijski dnevnik tujega tenanta)', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await journalGet(jsonReq('http://localhost:3000/api/purchase-orders/po-1/journal'), params('po-1'))
    expect(res.status).toBe(403)
    expect(mocks.purchaseOrderFindFirst).not.toHaveBeenCalled()
    expect(mocks.auditLogFindMany).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// F. GDPR — export + anonymize (raw `?? null` v isWithinScope)
// ══════════════════════════════════════════════════════════════════
describe('R86-2b F: /api/gdpr — isWithinScope iz resolverja (nikoli raw session)', () => {
  it('anonymize: manager-permission seja z NULL lokacijo → 403, NI db klica (prej isWithinScope(null)=true = GLOBALNI GDPR izbris)', async () => {
    mockSession({ role: 'manager', locationId: null, permissions: ['admin'] })
    const res = await gdprAnonymizePost(jsonReq('http://localhost:3000/api/gdpr/anonymize/emp-2', 'POST'), paramsEmp('emp-2'))
    expect(res.status).toBe(403)
    expect(mocks.employeeFindUnique).not.toHaveBeenCalled()
    expect(mocks.employeeUpdate).not.toHaveBeenCalled()
    expect(mocks.auditLogCreate).not.toHaveBeenCalled()
  })

  it('anonymize: lokacijski admin + tuj zaposleni → 404 + NI uničenja PII in NI audita', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.employeeFindUnique.mockResolvedValue({ id: 'emp-2', name: 'Tuj', email: 't@b.si', phone: '', status: 'terminated', locationId: LOC_B })
    const res = await gdprAnonymizePost(jsonReq('http://localhost:3000/api/gdpr/anonymize/emp-2', 'POST'), paramsEmp('emp-2'))
    expect(res.status).toBe(404)
    expect(mocks.employeeUpdate).not.toHaveBeenCalled()
    expect(mocks.auditLogCreate).not.toHaveBeenCalled()
    expect(mocks.shiftCount).not.toHaveBeenCalled()
  })

  it('anonymize: super-admin → globalni nadzor (tuj zaposleni se anonimizira)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.employeeFindUnique.mockResolvedValue({ id: 'emp-2', name: 'Tuj', email: 't@b.si', phone: '', status: 'terminated', locationId: LOC_B })
    mocks.employeeUpdate.mockResolvedValue({ id: 'emp-2' })
    const res = await gdprAnonymizePost(jsonReq('http://localhost:3000/api/gdpr/anonymize/emp-2', 'POST'), paramsEmp('emp-2'))
    expect(res.status).toBe(200)
    expect(mocks.employeeUpdate).toHaveBeenCalled()
    expect(mocks.auditLogCreate).toHaveBeenCalled()
  })

  it('export: isSelf pot za regularnega uporabnika z NULL lokacijo ostane odprta (GDPR čl. 15) → 200', async () => {
    mockSession({ role: 'manager', locationId: null, employeeId: 'emp-9' })
    mocks.employeeFindUnique.mockResolvedValue({
      id: 'emp-9', name: 'Jaz', email: 'j@x.si', phone: '', role: 'manager', status: 'active',
      hireDate: new Date(), locationId: LOC_A, createdAt: new Date(), updatedAt: new Date(), jobs: [],
    })
    const res = await gdprExportGet(jsonReq('http://localhost:3000/api/gdpr/export/emp-9'), paramsEmp('emp-9'))
    expect(res.status).toBe(200)
    // Audit žig: employee.locationId (data-derived) pred scope-om
    expect(mocks.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ locationId: LOC_A }) }),
    )
  })

  it('export: lokacijski admin + tuj zaposleni → 404 + NI audit zapisa (scope PRED logiranjem)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.employeeFindUnique.mockResolvedValue({
      id: 'emp-2', name: 'Tuj', email: 't@b.si', phone: '', role: 'staff', status: 'active',
      hireDate: new Date(), locationId: LOC_B, createdAt: new Date(), updatedAt: new Date(), jobs: [],
    })
    const res = await gdprExportGet(jsonReq('http://localhost:3000/api/gdpr/export/emp-2'), paramsEmp('emp-2'))
    expect(res.status).toBe(404)
    expect(mocks.auditLogCreate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// G. HACCP + IOT SENSORS — raw null guard / žig
// ══════════════════════════════════════════════════════════════════
describe('R86-2b G: /api/haccp + /api/iot/sensors', () => {
  it('haccp PUT: lokacijski admin + tuj vnos → 404 + NI update-a', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.haccpFindUnique.mockResolvedValue({ id: 'h-1', locationId: LOC_B })
    const res = await haccpPut(jsonReq('http://localhost:3000/api/haccp', 'PUT', { id: 'h-1', title: 'X' }))
    expect(res.status).toBe(404)
    expect(mocks.haccpUpdate).not.toHaveBeenCalled()
  })

  it('haccp DELETE: manager-permission seja z NULL lokacijo → 403 (prej guard preskočen: `sessionLocId && ...` = false) + NI db klica', async () => {
    mockSession({ role: 'manager', locationId: null, permissions: ['admin'] })
    const res = await haccpDelete(jsonReq('http://localhost:3000/api/haccp?id=h-1', 'DELETE'))
    expect(res.status).toBe(403)
    expect(mocks.haccpFindUnique).not.toHaveBeenCalled()
    expect(mocks.haccpUpdate).not.toHaveBeenCalled()
  })

  it('iot/sensors POST: manager-permission seja z NULL lokacijo + body locationId LOC_B → 403 + NI lokacijske validacije (prej fail-open žig na tujo lokacijo)', async () => {
    mockSession({ role: 'manager', locationId: null, permissions: ['admin'] })
    const res = await sensorsPost(jsonReq('http://localhost:3000/api/iot/sensors', 'POST', {
      sensorId: 's-1', name: 'Temp', type: 'temperature', locationId: LOC_B,
    }))
    expect(res.status).toBe(403)
    expect(mocks.locationFindUnique).not.toHaveBeenCalled()
    expect(mocks.createHaccpEntryWithChain).not.toHaveBeenCalled()
  })

  it('iot/sensors POST: super-admin + veljaven body locationId → senzor na LOC_B', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.createHaccpEntryWithChain.mockResolvedValue({ id: 'he-1' })
    const res = await sensorsPost(jsonReq('http://localhost:3000/api/iot/sensors', 'POST', {
      sensorId: 's-1', name: 'Temp', type: 'temperature', locationId: LOC_B,
    }))
    expect(res.status).toBe(201)
    expect(mocks.createHaccpEntryWithChain).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: LOC_B }),
    )
  })

  it('iot/sensors POST: super-admin brez body locationId → 400 fail-closed (prej NULL žig → P2011)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    const res = await sensorsPost(jsonReq('http://localhost:3000/api/iot/sensors', 'POST', {
      sensorId: 's-1', name: 'Temp', type: 'temperature',
    }))
    expect(res.status).toBe(400)
    expect(mocks.createHaccpEntryWithChain).not.toHaveBeenCalled()
  })
})
