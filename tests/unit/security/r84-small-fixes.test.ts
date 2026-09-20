// ============================================
// R84-3 — SMALL FIX WAVE: IoT scope + tableNumber fail-closed + employees gate
// ============================================
// REGRESIJA za R84-0 auditor najdbe:
//   1. IoT sensors GET — prej { category: 'temperature' } BREZ locationId
//      (križno-tenant HACCP podatki); sedaj scoped po session.locationId
//      (isti vzorec kot /api/haccp GET)
//   2. IoT readings POST — neznana body.locationId je prej TIHO padla na NULL
//      (naprava s ključem atributirala reading na nič/tuj tenant); sedaj 400
//      fail-closed
//   3. employees [id] PUT — super_admin izjema v role gate (pariteta s POST;
//      prej fail-closed 403 za platformnega admina)
//   4. resolveTable tableNumber brez locationId → 400 (pinned v r83 testu)
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  revokeEmployeeSessions: vi.fn(),
  haccpFindMany: vi.fn(),
  locationFindUnique: vi.fn(),
  createHaccpEntryWithChain: vi.fn(),
  employeeFindFirst: vi.fn(),
  employeeUpdate: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
  revokeEmployeeSessions: mocks.revokeEmployeeSessions,
}))

vi.mock('@/lib/auth-middleware/session-store', () => ({
  invalidateEmployeeStatusCache: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    haccpEntry: { findMany: mocks.haccpFindMany },
    location: { findUnique: mocks.locationFindUnique },
    employee: { findFirst: mocks.employeeFindFirst, update: mocks.employeeUpdate },
  },
  createAuditLog: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/haccp-chain', () => ({
  createHaccpEntryWithChain: mocks.createHaccpEntryWithChain,
}))

import { GET as sensorsGET } from '@/app/api/iot/sensors/route'
import { POST as readingsPOST } from '@/app/api/iot/readings/route'
import { PUT as employeePUT } from '@/app/api/employees/[id]/route'

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.haccpFindMany.mockResolvedValue([])
  mocks.createHaccpEntryWithChain.mockResolvedValue({ id: 'haccp-1' })
  mocks.locationFindUnique.mockResolvedValue(null)
  mocks.employeeUpdate.mockResolvedValue({})
})

// ══════════════════════════════════════════════════════════════════
// 1. IoT sensors GET — tenant scope
// ══════════════════════════════════════════════════════════════════
describe('R84-3: GET /api/iot/sensors — tenant scope', () => {
  it('loc-bound admin: findMany where vsebuje locationId + category temperature', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A },
      error: null,
    })
    const res = await sensorsGET(new Request('http://localhost:3000/api/iot/sensors'))
    expect(res.status).toBe(200)
    const where = mocks.haccpFindMany.mock.calls[0][0].where
    expect(where.category).toBe('temperature')
    expect(where.locationId).toBe(LOC_A)
  })

  it('super-admin (null lokacija): PRAZEN locationId filter (globalno)', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'super_admin', locationId: null },
      error: null,
    })
    await sensorsGET(new Request('http://localhost:3000/api/iot/sensors'))
    const where = mocks.haccpFindMany.mock.calls[0][0].where
    expect(where.category).toBe('temperature')
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════
// 2. IoT readings POST — fail-closed atribucija
// ══════════════════════════════════════════════════════════════════
describe('R84-3: POST /api/iot/readings — fail-closed locationId atribucija', () => {
  function makeReq(body: Record<string, unknown>) {
    return new Request('http://localhost:3000/api/iot/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-IoT-Api-Key': 'key-123' },
      body: JSON.stringify(body),
    })
  }

  it('neznana locationId → 400, HACCP entry NI ustvarjen (prej tiho NULL)', async () => {
    process.env.IOT_API_KEY = 'key-123'
    mocks.locationFindUnique.mockResolvedValue(null)

    const res = await readingsPOST(makeReq({
      sensorId: 'sensor-1',
      temperature: 3.5,
      locationId: 'bogus-loc',
    }))

    expect(res.status).toBe(400)
    expect(mocks.createHaccpEntryWithChain).not.toHaveBeenCalled()
    delete process.env.IOT_API_KEY
  })

  it('veljavna locationId → entry atributiran na lokacijo', async () => {
    process.env.IOT_API_KEY = 'key-123'
    mocks.locationFindUnique.mockResolvedValue({ id: LOC_A })

    const res = await readingsPOST(makeReq({
      sensorId: 'sensor-1',
      temperature: 3.5,
      locationId: LOC_A,
    }))

    expect(res.status).toBe(201)
    expect(mocks.createHaccpEntryWithChain).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: LOC_A }),
    )
    delete process.env.IOT_API_KEY
  })

  it('brez locationId → legacy NULL atribucija dovoljena (nima ključa → ni atribucije)', async () => {
    process.env.IOT_API_KEY = 'key-123'

    const res = await readingsPOST(makeReq({
      sensorId: 'sensor-1',
      temperature: 3.5,
    }))

    expect(res.status).toBe(201)
    expect(mocks.locationFindUnique).not.toHaveBeenCalled()
    expect(mocks.createHaccpEntryWithChain).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: null }),
    )
    delete process.env.IOT_API_KEY
  })
})

// ══════════════════════════════════════════════════════════════════
// 3. employees [id] PUT — super_admin izjema
// ══════════════════════════════════════════════════════════════════
describe('R84-3: PUT /api/employees/[id] — super_admin gate pariteta', () => {
  function makePutReq(body: Record<string, unknown>) {
    return new Request('http://localhost:3000/api/employees/emp-target', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  const existingAdmin = {
    id: 'emp-target',
    name: 'Admin A',
    email: 'a@x.si',
    role: 'admin',
    status: 'active',
    locationId: LOC_A,
  }

  it('super_admin sme spremeniti vlogo admina (prej 403 fail-closed inkonzistenca)', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-platform', role: 'super_admin', locationId: null },
      error: null,
    })
    mocks.employeeFindFirst.mockResolvedValue(existingAdmin)

    const res = await employeePUT(makePutReq({ role: 'manager' }), {
      params: Promise.resolve({ id: 'emp-target' }),
    })

    expect(res.status).toBe(200)
    expect(mocks.employeeUpdate).toHaveBeenCalled()
  })

  it('manager NE SME povišati na admin (regresija FIX CRITICAL ostane)', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-mgr', role: 'manager', locationId: LOC_A },
      error: null,
    })
    mocks.employeeFindFirst.mockResolvedValue({ ...existingAdmin, role: 'staff' })

    const res = await employeePUT(makePutReq({ role: 'admin' }), {
      params: Promise.resolve({ id: 'emp-target' }),
    })

    expect(res.status).toBe(403)
    expect(mocks.employeeUpdate).not.toHaveBeenCalled()
  })

  it('manager NE SME demote-admin-a (regresija FIX CRITICAL ostane)', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-mgr', role: 'manager', locationId: LOC_A },
      error: null,
    })
    mocks.employeeFindFirst.mockResolvedValue(existingAdmin)

    const res = await employeePUT(makePutReq({ role: 'staff' }), {
      params: Promise.resolve({ id: 'emp-target' }),
    })

    expect(res.status).toBe(403)
    expect(mocks.employeeUpdate).not.toHaveBeenCalled()
  })

  it('loc-bound manager tuji zaposleni → 404 (tenant scope regresija ostane)', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-mgr', role: 'manager', locationId: LOC_A },
      error: null,
    })
    mocks.employeeFindFirst.mockResolvedValue(null)

    const res = await employeePUT(makePutReq({ name: 'XX' }), {
      params: Promise.resolve({ id: 'emp-foreign' }),
    })

    expect(res.status).toBe(404)
  })
})
