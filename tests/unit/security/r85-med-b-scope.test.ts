// ============================================
// R85-4b — TIME-OFF / STAFF-AVAILABILITY / LABOR-REPORTS TENANT SCOPE
// ============================================
// REGRESIJA za 3 MEDIUM (R84-FINAL-2 / R85-4 M-val, file:line dokazano):
//
//   M4 time-off — GET/POST /api/time-off + POST /[id]/approve|reject so
//      delali GLOBALNO: TimeOffRequest NIMA locationId stolpca
//      (schema.prisma:1659), scope se izpelje prek employee.locationId.
//      Prej: GET vrnil prošnje vseh tenantov, POST sprejel tuj employeeId,
//      approve/reject pa update({ where: { id } }) čez tenant-e.
//
//   M5 staff-availability — GET/POST/DELETE /api/staff-availability so
//      delali GLOBALNO (StaffAvailability NIMA locationId, schema:1636):
//      GET seznam vseh tenantov, POST upsert na tujega zaposlenega,
//      DELETE tujega vnosa po ugibanju id-ja.
//
//   M6 labor-reports — GET /api/labor-reports je klical helperje v
//      '@/lib/labor-reports' brez locationId → staffShift.findMany +
//      timeEntry.findMany GLOBALNO (plače, urni postavki, PII zaposlenih
//      vseh tenantov). StaffShift in TimeEntry imata LASTEN locationId
//      stolpec (schema:1602/906) → direkt filter (R84 financial vzorec).
//
// Vzorec: realen tenant-scope resolver (kakor R84 reports / R85-1..3) +
// pinanje where-clavzov. null scope (super-admin) = PRAZEN filter, NIKOLI
// { locationId: null } oz. { employee: { locationId: null } }.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  // time-off
  timeOffFindMany: vi.fn(),
  timeOffCreate: vi.fn(),
  timeOffFindUnique: vi.fn(),
  timeOffUpdate: vi.fn(),
  // staff-availability
  availabilityFindMany: vi.fn(),
  availabilityUpsert: vi.fn(),
  availabilityFindUnique: vi.fn(),
  availabilityDelete: vi.fn(),
  // employee (izpeljani scope prek Employee.locationId)
  employeeFindUnique: vi.fn(),
  employeeFindMany: vi.fn(),
  // labor-reports
  staffShiftFindMany: vi.fn(),
  timeEntryFindMany: vi.fn(),
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
    timeOffRequest: {
      findMany: mocks.timeOffFindMany,
      create: mocks.timeOffCreate,
      findUnique: mocks.timeOffFindUnique,
      update: mocks.timeOffUpdate,
    },
    staffAvailability: {
      findMany: mocks.availabilityFindMany,
      upsert: mocks.availabilityUpsert,
      findUnique: mocks.availabilityFindUnique,
      delete: mocks.availabilityDelete,
    },
    employee: {
      findUnique: mocks.employeeFindUnique,
      findMany: mocks.employeeFindMany,
    },
    staffShift: { findMany: mocks.staffShiftFindMany },
    timeEntry: { findMany: mocks.timeEntryFindMany },
  },
}))

import { GET as timeOffGET, POST as timeOffPOST } from '@/app/api/time-off/route'
import { POST as approvePOST } from '@/app/api/time-off/[id]/approve/route'
import { POST as rejectPOST } from '@/app/api/time-off/[id]/reject/route'
import {
  GET as availabilityGET,
  POST as availabilityPOST,
  DELETE as availabilityDELETE,
} from '@/app/api/staff-availability/route'
import { GET as laborReportsGET } from '@/app/api/labor-reports/route'
import {
  getScheduledVsActualReport,
  getOvertimeReport,
  getAttendanceReport,
} from '@/lib/labor-reports'

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'
const EMP_A = 'emp-loc-a'
const EMP_B = 'emp-loc-b'

function mockSession(overrides: Record<string, unknown> = {}) {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A, ...overrides },
    error: null,
  })
}

function makePostReq(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const TIME_OFF_BODY = {
  employeeId: EMP_A,
  type: 'vacation',
  startDate: '2026-03-01T00:00:00Z',
  endDate: '2026-03-05T00:00:00Z',
  reason: 'dopust',
}

const AVAILABILITY_BODY = {
  employeeId: EMP_A,
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '17:00',
}

const DATE_FROM = new Date('2026-01-01T00:00:00Z')
const DATE_TO = new Date('2026-01-31T23:59:59Z')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.timeOffFindMany.mockResolvedValue([])
  mocks.timeOffCreate.mockResolvedValue({ id: 'tor-new' })
  mocks.timeOffUpdate.mockResolvedValue({ id: 'tor-1', status: 'approved' })
  mocks.availabilityFindMany.mockResolvedValue([])
  mocks.availabilityUpsert.mockResolvedValue({ id: 'av-1' })
  mocks.availabilityDelete.mockResolvedValue({})
  mocks.employeeFindUnique.mockResolvedValue({ id: EMP_A, locationId: LOC_A })
  mocks.employeeFindMany.mockResolvedValue([{ id: EMP_A }])
  mocks.staffShiftFindMany.mockResolvedValue([])
  mocks.timeEntryFindMany.mockResolvedValue([])
})

// ══════════════════════════════════════════════════════════════════
// A. TIME-OFF GET
// ══════════════════════════════════════════════════════════════════
describe('R85-4b A: GET /api/time-off — izpeljani scope prek Employee.locationId', () => {
  it('regular user brez locationId → 403 fail-closed, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await timeOffGET(new Request('http://localhost:3000/api/time-off'))
    expect(res.status).toBe(403)
    expect(mocks.timeOffFindMany).not.toHaveBeenCalled()
    expect(mocks.employeeFindMany).not.toHaveBeenCalled()
  })

  it('loc-bound admin: where.employee.locationId pripet + ostali filtri ohranjeni', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await timeOffGET(
      new Request(`http://localhost:3000/api/time-off?employeeId=${EMP_A}&status=pending&upcoming=1`),
    )
    expect(res.status).toBe(200)
    const where = mocks.timeOffFindMany.mock.calls[0][0].where
    expect(where.employee).toEqual({ locationId: LOC_A })
    expect(where.employeeId).toBe(EMP_A)
    expect(where.status).toBe('pending')
    expect(where.endDate).toBeDefined()
  })

  it('?locationId bypass je ignoriran za lokacijskega admina', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await timeOffGET(new Request(`http://localhost:3000/api/time-off?locationId=${LOC_B}`))
    expect(mocks.timeOffFindMany.mock.calls[0][0].where.employee).toEqual({ locationId: LOC_A })
  })

  it('super-admin: brez employee filtra — nikoli { employee: { locationId: null } }', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await timeOffGET(new Request('http://localhost:3000/api/time-off'))
    const where = mocks.timeOffFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'employee')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// B. TIME-OFF POST (create + lastniški guard nad employeeId)
// ══════════════════════════════════════════════════════════════════
describe('R85-4b B: POST /api/time-off — employeeId ownership guard', () => {
  it('regular user brez locationId → 403, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await timeOffPOST(makePostReq('http://localhost:3000/api/time-off', TIME_OFF_BODY))
    expect(res.status).toBe(403)
    expect(mocks.employeeFindUnique).not.toHaveBeenCalled()
    expect(mocks.timeOffCreate).not.toHaveBeenCalled()
  })

  it('loc-bound admin + lastni zaposleni → create klican', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await timeOffPOST(makePostReq('http://localhost:3000/api/time-off', TIME_OFF_BODY))
    expect(res.status).toBe(200)
    expect(mocks.employeeFindUnique).toHaveBeenCalledTimes(1)
    expect(mocks.timeOffCreate).toHaveBeenCalledTimes(1)
    expect(mocks.timeOffCreate.mock.calls[0][0].data.employeeId).toBe(EMP_A)
  })

  it('loc-bound admin + TUJ zaposleni (loc B) → 404 + create NI klican', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.employeeFindUnique.mockResolvedValue({ id: EMP_B, locationId: LOC_B })
    const res = await timeOffPOST(
      makePostReq('http://localhost:3000/api/time-off', { ...TIME_OFF_BODY, employeeId: EMP_B }),
    )
    expect(res.status).toBe(404)
    expect(mocks.timeOffCreate).not.toHaveBeenCalled()
  })

  it('loc-bound admin + legacy NULL lokacija zaposlenega → 404 fail-closed', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.employeeFindUnique.mockResolvedValue({ id: EMP_A, locationId: null })
    const res = await timeOffPOST(makePostReq('http://localhost:3000/api/time-off', TIME_OFF_BODY))
    expect(res.status).toBe(404)
    expect(mocks.timeOffCreate).not.toHaveBeenCalled()
  })

  it('super-admin sme ustvariti prošnjo na kateri koli lokaciji', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.employeeFindUnique.mockResolvedValue({ id: EMP_B, locationId: LOC_B })
    const res = await timeOffPOST(
      makePostReq('http://localhost:3000/api/time-off', { ...TIME_OFF_BODY, employeeId: EMP_B }),
    )
    expect(res.status).toBe(200)
    expect(mocks.timeOffCreate).toHaveBeenCalledTimes(1)
  })
})

// ══════════════════════════════════════════════════════════════════
// C. TIME-OFF approve/reject (cross-tenant WRITE po id)
// ══════════════════════════════════════════════════════════════════
describe('R85-4b C: POST /api/time-off/[id]/approve|reject — ownership guard', () => {
  const OWN = { id: 'tor-1', employee: { locationId: LOC_A } }
  const FOREIGN = { id: 'tor-2', employee: { locationId: LOC_B } }
  const LEGACY_NULL = { id: 'tor-3', employee: { locationId: null } }

  it('regular user brez locationId → 403, update NI klican', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await approvePOST(
      new Request('http://localhost:3000/api/time-off/tor-1/approve', { method: 'POST' }),
      { params: Promise.resolve({ id: 'tor-1' }) },
    )
    expect(res.status).toBe(403)
    expect(mocks.timeOffUpdate).not.toHaveBeenCalled()
  })

  it('approve: lastna prošnja → update klican z statusom approved', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.timeOffFindUnique.mockResolvedValue(OWN)
    const res = await approvePOST(
      new Request('http://localhost:3000/api/time-off/tor-1/approve', { method: 'POST' }),
      { params: Promise.resolve({ id: 'tor-1' }) },
    )
    expect(res.status).toBe(200)
    expect(mocks.timeOffUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.timeOffUpdate.mock.calls[0][0].data.status).toBe('approved')
  })

  it('approve: TUJA prošnja → 404 + update NI klican', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.timeOffFindUnique.mockResolvedValue(FOREIGN)
    const res = await approvePOST(
      new Request('http://localhost:3000/api/time-off/tor-2/approve', { method: 'POST' }),
      { params: Promise.resolve({ id: 'tor-2' }) },
    )
    expect(res.status).toBe(404)
    expect(mocks.timeOffUpdate).not.toHaveBeenCalled()
  })

  it('approve: legacy NULL prošnja + loc-bound admin → 404 fail-closed', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.timeOffFindUnique.mockResolvedValue(LEGACY_NULL)
    const res = await approvePOST(
      new Request('http://localhost:3000/api/time-off/tor-3/approve', { method: 'POST' }),
      { params: Promise.resolve({ id: 'tor-3' }) },
    )
    expect(res.status).toBe(404)
    expect(mocks.timeOffUpdate).not.toHaveBeenCalled()
  })

  it('approve: neznani id → 404 + update NI klican', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.timeOffFindUnique.mockResolvedValue(null)
    const res = await approvePOST(
      new Request('http://localhost:3000/api/time-off/tor-x/approve', { method: 'POST' }),
      { params: Promise.resolve({ id: 'tor-x' }) },
    )
    expect(res.status).toBe(404)
    expect(mocks.timeOffUpdate).not.toHaveBeenCalled()
  })

  it('approve: super-admin sme odobriti tujo (NULL scope = globalni nadzor)', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.timeOffFindUnique.mockResolvedValue(FOREIGN)
    const res = await approvePOST(
      new Request('http://localhost:3000/api/time-off/tor-2/approve', { method: 'POST' }),
      { params: Promise.resolve({ id: 'tor-2' }) },
    )
    expect(res.status).toBe(200)
    expect(mocks.timeOffUpdate).toHaveBeenCalledTimes(1)
  })

  it('reject: TUJA prošnja → 404 + update NI klican (pariteta)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.timeOffFindUnique.mockResolvedValue(FOREIGN)
    const res = await rejectPOST(
      new Request('http://localhost:3000/api/time-off/tor-2/reject', { method: 'POST' }),
      { params: Promise.resolve({ id: 'tor-2' }) },
    )
    expect(res.status).toBe(404)
    expect(mocks.timeOffUpdate).not.toHaveBeenCalled()
  })

  it('reject: lastna prošnja → update klican z statusom rejected', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.timeOffFindUnique.mockResolvedValue(OWN)
    const res = await rejectPOST(
      new Request('http://localhost:3000/api/time-off/tor-1/reject', { method: 'POST' }),
      { params: Promise.resolve({ id: 'tor-1' }) },
    )
    expect(res.status).toBe(200)
    expect(mocks.timeOffUpdate.mock.calls[0][0].data.status).toBe('rejected')
  })
})

// ══════════════════════════════════════════════════════════════════
// D. STAFF-AVAILABILITY GET
// ══════════════════════════════════════════════════════════════════
describe('R85-4b D: GET /api/staff-availability — izpeljani scope prek Employee.locationId', () => {
  it('regular user brez locationId → 403 fail-closed, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await availabilityGET(new Request('http://localhost:3000/api/staff-availability'))
    expect(res.status).toBe(403)
    expect(mocks.availabilityFindMany).not.toHaveBeenCalled()
  })

  it('loc-bound admin: where.employee.locationId pripet + employeeId ohranjen', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await availabilityGET(
      new Request(`http://localhost:3000/api/staff-availability?employeeId=${EMP_A}`),
    )
    expect(res.status).toBe(200)
    const where = mocks.availabilityFindMany.mock.calls[0][0].where
    expect(where.employee).toEqual({ locationId: LOC_A })
    expect(where.employeeId).toBe(EMP_A)
  })

  it('?locationId bypass je ignoriran', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await availabilityGET(new Request(`http://localhost:3000/api/staff-availability?locationId=${LOC_B}`))
    expect(mocks.availabilityFindMany.mock.calls[0][0].where.employee).toEqual({ locationId: LOC_A })
  })

  it('super-admin: brez employee filtra — nikoli { employee: { locationId: null } }', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await availabilityGET(new Request('http://localhost:3000/api/staff-availability'))
    const where = mocks.availabilityFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'employee')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// E. STAFF-AVAILABILITY POST (batch upsert + ownership guard)
// ══════════════════════════════════════════════════════════════════
describe('R85-4b E: POST /api/staff-availability — employeeId ownership guard', () => {
  it('regular user brez locationId → 403, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await availabilityPOST(
      makePostReq('http://localhost:3000/api/staff-availability', AVAILABILITY_BODY),
    )
    expect(res.status).toBe(403)
    expect(mocks.employeeFindMany).not.toHaveBeenCalled()
    expect(mocks.availabilityUpsert).not.toHaveBeenCalled()
  })

  it('loc-bound admin + lastni zaposleni → upsert klican', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await availabilityPOST(
      makePostReq('http://localhost:3000/api/staff-availability', AVAILABILITY_BODY),
    )
    expect(res.status).toBe(200)
    expect(mocks.availabilityUpsert).toHaveBeenCalledTimes(1)
    expect(mocks.availabilityUpsert.mock.calls[0][0].where
      .employeeId_dayOfWeek_startTime_endTime.employeeId).toBe(EMP_A)
  })

  it('loc-bound admin + batch s tujim zaposlenim → 404 + NIKOLI upsert', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.employeeFindMany.mockResolvedValue([{ id: EMP_A }]) // EMP_B manjka
    const res = await availabilityPOST(
      makePostReq('http://localhost:3000/api/staff-availability', [
        AVAILABILITY_BODY,
        { ...AVAILABILITY_BODY, employeeId: EMP_B, dayOfWeek: 2 },
      ]),
    )
    expect(res.status).toBe(404)
    expect(mocks.availabilityUpsert).not.toHaveBeenCalled()
  })

  it('loc-bound admin: findMany where.locationId pripet na scope', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await availabilityPOST(
      makePostReq('http://localhost:3000/api/staff-availability', AVAILABILITY_BODY),
    )
    expect(mocks.employeeFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin: tuji zaposleni dovoljen, findMany where BREZ locationId', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.employeeFindMany.mockResolvedValue([{ id: EMP_A }, { id: EMP_B }])
    const res = await availabilityPOST(
      makePostReq('http://localhost:3000/api/staff-availability', [
        AVAILABILITY_BODY,
        { ...AVAILABILITY_BODY, employeeId: EMP_B, dayOfWeek: 2 },
      ]),
    )
    expect(res.status).toBe(200)
    expect(Object.prototype.hasOwnProperty.call(mocks.employeeFindMany.mock.calls[0][0].where, 'locationId')).toBe(false)
    expect(mocks.availabilityUpsert).toHaveBeenCalledTimes(2)
  })
})

// ══════════════════════════════════════════════════════════════════
// F. STAFF-AVAILABILITY DELETE (cross-tenant WRITE po id)
// ══════════════════════════════════════════════════════════════════
describe('R85-4b F: DELETE /api/staff-availability?id= — ownership guard', () => {
  const OWN = { id: 'av-1', employee: { locationId: LOC_A } }
  const FOREIGN = { id: 'av-2', employee: { locationId: LOC_B } }
  const LEGACY_NULL = { id: 'av-3', employee: { locationId: null } }

  it('regular user brez locationId → 403, delete NI klican', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await availabilityDELETE(
      new Request('http://localhost:3000/api/staff-availability?id=av-1', { method: 'DELETE' }),
    )
    expect(res.status).toBe(403)
    expect(mocks.availabilityDelete).not.toHaveBeenCalled()
  })

  it('lasten vnos → delete klican', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.availabilityFindUnique.mockResolvedValue(OWN)
    const res = await availabilityDELETE(
      new Request('http://localhost:3000/api/staff-availability?id=av-1', { method: 'DELETE' }),
    )
    expect(res.status).toBe(200)
    expect(mocks.availabilityDelete).toHaveBeenCalledTimes(1)
    expect(mocks.availabilityDelete.mock.calls[0][0].where.id).toBe('av-1')
  })

  it('TUJ vnos → 404 + delete NI klican', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.availabilityFindUnique.mockResolvedValue(FOREIGN)
    const res = await availabilityDELETE(
      new Request('http://localhost:3000/api/staff-availability?id=av-2', { method: 'DELETE' }),
    )
    expect(res.status).toBe(404)
    expect(mocks.availabilityDelete).not.toHaveBeenCalled()
  })

  it('legacy NULL vnos + loc-bound admin → 404 fail-closed', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    mocks.availabilityFindUnique.mockResolvedValue(LEGACY_NULL)
    const res = await availabilityDELETE(
      new Request('http://localhost:3000/api/staff-availability?id=av-3', { method: 'DELETE' }),
    )
    expect(res.status).toBe(404)
    expect(mocks.availabilityDelete).not.toHaveBeenCalled()
  })

  it('super-admin sme izbrisati NULL-lokacijski vnos', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    mocks.availabilityFindUnique.mockResolvedValue(LEGACY_NULL)
    const res = await availabilityDELETE(
      new Request('http://localhost:3000/api/staff-availability?id=av-3', { method: 'DELETE' }),
    )
    expect(res.status).toBe(200)
    expect(mocks.availabilityDelete).toHaveBeenCalledTimes(1)
  })

  it('manjkajoč id → 400 (obnašanje ohranjeno)', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await availabilityDELETE(
      new Request('http://localhost:3000/api/staff-availability', { method: 'DELETE' }),
    )
    expect(res.status).toBe(400)
    expect(mocks.availabilityDelete).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// G. LABOR-REPORTS GET (routa podaja scope helperjem)
// ══════════════════════════════════════════════════════════════════
describe('R85-4b G: GET /api/labor-reports — scope na vseh helper poizvedbah', () => {
  const RANGE = `dateFrom=${DATE_FROM.toISOString()}&dateTo=${DATE_TO.toISOString()}`

  it('regular user brez locationId → 403 fail-closed, NI poizvedb', async () => {
    mockSession({ role: 'manager', locationId: null })
    const res = await laborReportsGET(new Request('http://localhost:3000/api/labor-reports'))
    expect(res.status).toBe(403)
    expect(mocks.staffShiftFindMany).not.toHaveBeenCalled()
    expect(mocks.timeEntryFindMany).not.toHaveBeenCalled()
  })

  it('loc-bound scheduled_vs_actual: staffShift + timeEntry oba where.locationId', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    const res = await laborReportsGET(
      new Request(`http://localhost:3000/api/labor-reports?type=scheduled_vs_actual&${RANGE}`),
    )
    expect(res.status).toBe(200)
    expect(mocks.staffShiftFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.timeEntryFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('loc-bound overtime: timeEntry where.locationId', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await laborReportsGET(
      new Request(`http://localhost:3000/api/labor-reports?type=overtime&${RANGE}`),
    )
    expect(mocks.timeEntryFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('loc-bound attendance: timeEntry where.locationId + employeeId ohranjen', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await laborReportsGET(
      new Request(`http://localhost:3000/api/labor-reports?type=attendance&employeeId=${EMP_A}&${RANGE}`),
    )
    const where = mocks.timeEntryFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A)
    expect(where.employeeId).toBe(EMP_A)
  })

  it('?locationId bypass je ignoriran za lokacijskega admina', async () => {
    mockSession({ role: 'admin', locationId: LOC_A })
    await laborReportsGET(
      new Request(`http://localhost:3000/api/labor-reports?type=overtime&locationId=${LOC_B}&${RANGE}`),
    )
    expect(mocks.timeEntryFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('super-admin: brez locationId ključa (nikoli { locationId: null })', async () => {
    mockSession({ role: 'super_admin', locationId: null })
    await laborReportsGET(
      new Request(`http://localhost:3000/api/labor-reports?type=scheduled_vs_actual&${RANGE}`),
    )
    const shiftWhere = mocks.staffShiftFindMany.mock.calls[0][0].where
    const teWhere = mocks.timeEntryFindMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(shiftWhere, 'locationId')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(teWhere, 'locationId')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// H. LIB helperji — neposredna pinanja (R84 fetchFinancialData vzorec)
// ══════════════════════════════════════════════════════════════════
describe('R85-4b H: lib/labor-reports helperji — locationId parameter', () => {
  it('getScheduledVsActualReport(LOC_A): oba findMany where.locationId pripeta', async () => {
    await getScheduledVsActualReport(DATE_FROM, DATE_TO, LOC_A)
    expect(mocks.staffShiftFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mocks.timeEntryFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    // ostali filtri ohranjeni
    expect(mocks.staffShiftFindMany.mock.calls[0][0].where.status).toEqual({ notIn: ['cancelled'] })
  })

  it('getScheduledVsActualReport(null): brez locationId ključa', async () => {
    await getScheduledVsActualReport(DATE_FROM, DATE_TO, null)
    expect(Object.prototype.hasOwnProperty.call(mocks.staffShiftFindMany.mock.calls[0][0].where, 'locationId')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(mocks.timeEntryFindMany.mock.calls[0][0].where, 'locationId')).toBe(false)
  })

  it('getOvertimeReport(LOC_A): timeEntry where.locationId + status filter ohranjen', async () => {
    await getOvertimeReport(DATE_FROM, DATE_TO, LOC_A)
    const where = mocks.timeEntryFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A)
    expect(where.status).toEqual({ notIn: ['disputed'] })
  })

  it('getAttendanceReport(LOC_A): where.locationId pripet, employeeId ohranjen', async () => {
    await getAttendanceReport(DATE_FROM, DATE_TO, EMP_A, LOC_A)
    const where = mocks.timeEntryFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A)
    expect(where.employeeId).toBe(EMP_A)
  })

  it('getAttendanceReport(null): brez locationId ključa (super-admin)', async () => {
    await getAttendanceReport(DATE_FROM, DATE_TO, undefined, null)
    expect(Object.prototype.hasOwnProperty.call(mocks.timeEntryFindMany.mock.calls[0][0].where, 'locationId')).toBe(false)
  })
})
