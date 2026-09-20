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
  walletPaymentUpdateMany: vi.fn(),
  walletPaymentFindFirst: vi.fn(),
  walletPaymentFindUnique: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', async () => {
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: mocks.requireAuth,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
    revokeEmployeeSessions: mocks.revokeEmployeeSessions,
  }
})

vi.mock('@/lib/auth-middleware/session-store', () => ({
  invalidateEmployeeStatusCache: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    haccpEntry: { findMany: mocks.haccpFindMany },
    location: { findUnique: mocks.locationFindUnique },
    employee: { findFirst: mocks.employeeFindFirst, update: mocks.employeeUpdate },
    // wallet capture/refund poti (R84-FIX2)
    walletPayment: {
      updateMany: mocks.walletPaymentUpdateMany,
      findFirst: mocks.walletPaymentFindFirst,
      findUnique: mocks.walletPaymentFindUnique,
      update: mocks.walletPaymentFindUnique,
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $executeRaw: vi.fn().mockResolvedValue(undefined),
        walletPayment: { findUnique: mocks.walletPaymentFindUnique, update: mocks.walletPaymentFindUnique },
      })),
    outboxEvent: { upsert: vi.fn().mockResolvedValue({}) },
  },
  createAuditLog: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/haccp-chain', () => ({
  createHaccpEntryWithChain: mocks.createHaccpEntryWithChain,
}))

import { GET as sensorsGET } from '@/app/api/iot/sensors/route'
import { POST as readingsPOST } from '@/app/api/iot/readings/route'
import { PUT as employeePUT } from '@/app/api/employees/[id]/route'
import { POST as capturePOST } from '@/app/api/wallet-payment/[id]/capture/route'
import { POST as refundPOST } from '@/app/api/wallet-payment/[id]/refund/route'
import { captureWalletPayment, refundWalletPayment } from '@/lib/wallet-payment'

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

// ══════════════════════════════════════════════════════════════════
// 4. Wallet capture/refund — tenant scope (R84-FIX2, final-auditor H3:
//    cross-tenant money movement — manage_cash user tuje lokacije je lahko
//    bremil/povrnil tuje plačilo)
// ══════════════════════════════════════════════════════════════════
describe('R84-FIX2: wallet capture/refund — tenant scope', () => {
  it('capture loc-bound: updateMany where vsebuje locationId + status authorized', async () => {
    mocks.walletPaymentUpdateMany.mockResolvedValue({ count: 1 })
    mocks.walletPaymentFindUnique.mockResolvedValue({
      id: 'wp-1', status: 'captured', amount: 50, currency: 'EUR', checkId: null, paymentId: null,
    })

    await captureWalletPayment('wp-1', LOC_A)

    const where = mocks.walletPaymentUpdateMany.mock.calls[0][0].where
    expect(where.id).toBe('wp-1')
    expect(where.status).toBe('authorized')
    expect(where.locationId).toBe(LOC_A)
  })

  it('capture tujega plačila → count=0 + scoped re-read: napaka BREZ razkritja obstoja', async () => {
    mocks.walletPaymentUpdateMany.mockResolvedValue({ count: 0 })
    mocks.walletPaymentFindFirst.mockResolvedValue(null) // tuj zapis = ne najden

    await expect(captureWalletPayment('wp-foreign', LOC_A)).rejects.toThrow(
      'ne obstaja ali ni na vaši lokaciji',
    )
  })

  it('refund tujega/legacy-NULL plačila → strict tenant guard (fail-closed)', async () => {
    mocks.walletPaymentFindUnique.mockResolvedValue({
      id: 'wp-2', status: 'captured', amount: 50, refundedAmount: 0, locationId: null, currency: 'EUR',
    })

    await expect(refundWalletPayment('wp-2', 10, LOC_A)).rejects.toThrow(
      'ne obstaja ali ni na vaši lokaciji',
    )
  })

  it('refund lastnega plačila → uspešno (outbox event z lokacijo)', async () => {
    mocks.walletPaymentFindUnique
      .mockResolvedValueOnce({
        id: 'wp-3', status: 'captured', amount: 50, refundedAmount: 0, locationId: LOC_A, currency: 'EUR', checkId: null, paymentId: null,
      })
      .mockResolvedValueOnce({
        id: 'wp-3', status: 'refunded', amount: 50, refundedAmount: 10, locationId: LOC_A, currency: 'EUR', checkId: null, paymentId: null,
      })

    const result = await refundWalletPayment('wp-3', 10, LOC_A)
    expect(result.status).toBe('refunded')
  })

  it('capture route: loc-bound klicatelj → lib prejme scope.locationId', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A },
      error: null,
    })
    mocks.walletPaymentUpdateMany.mockResolvedValue({ count: 1 })
    mocks.walletPaymentFindUnique.mockResolvedValue({
      id: 'wp-9', status: 'captured', amount: 20, currency: 'EUR', checkId: null, paymentId: null,
    })

    const res = await capturePOST(new Request('http://localhost:3000/api/wallet-payment/wp-9/capture'), {
      params: Promise.resolve({ id: 'wp-9' }),
    })

    expect(res.status).toBe(200)
    expect(mocks.walletPaymentUpdateMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('refund route: super-admin (null scope) → lib prejme null (globalno)', async () => {
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'super_admin', locationId: null },
      error: null,
    })
    mocks.walletPaymentFindUnique
      .mockResolvedValueOnce({
        id: 'wp-4', status: 'captured', amount: 30, refundedAmount: 0, locationId: null, currency: 'EUR', checkId: null, paymentId: null,
      })
      .mockResolvedValueOnce({
        id: 'wp-4', status: 'refunded', amount: 30, refundedAmount: 5, locationId: null, currency: 'EUR', checkId: null, paymentId: null,
      })

    const res = await refundPOST(new Request('http://localhost:3000/api/wallet-payment/wp-4/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 5 }),
    }), { params: Promise.resolve({ id: 'wp-4' }) })

    expect(res.status).toBe(200)
  })
})
