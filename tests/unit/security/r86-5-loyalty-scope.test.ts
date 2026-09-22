// ============================================
// R86-5 — LOYALTY mini-val (R86-FINAL-AUDIT najdbe #1/#2)
// ============================================
// REGRESIJA za M2 razred, ki je preživel 6 R86 valov (loyalty/* ni bil v
// nobeni skupini):
//   HIGH   loyalty/[id] PUT:29  — raw `session?.locationId ?? undefined` v
//          findFirst where → cross-tenant branje/pisanje točk (±50000),
//          tier + SMS, transakcijski zapisi
//   HIGH   loyalty/[id] DELETE:194 — isti razred → cross-tenant brisanje
//   MEDIUM loyalty POST:79 — raw `|| null` → NULL-stamp globalnega računa +
//          preskočen duplikat check za regular-null seja
//
// Vzorec: realen tenant-scope resolver + pinanje where-clavzov. null scope
// (super-admin) = PRAZEN filter, NIKOLI { locationId: null }.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  loyaltyAccountFindFirst: vi.fn(),
  loyaltyAccountCreate: vi.fn(),
  loyaltyAccountUpdate: vi.fn(),
  loyaltyAccountDelete: vi.fn(),
  loyaltyTransactionCount: vi.fn(),
  loyaltyTransactionCreate: vi.fn(),
  triggerTierUpgrade: vi.fn(),
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

vi.mock('@/lib/loyalty-automation', () => ({
  triggerTierUpgrade: mocks.triggerTierUpgrade,
}))

vi.mock('@/lib/db', () => ({
  db: {
    loyaltyAccount: {
      findFirst: mocks.loyaltyAccountFindFirst,
      create: mocks.loyaltyAccountCreate,
      update: mocks.loyaltyAccountUpdate,
      delete: mocks.loyaltyAccountDelete,
    },
    loyaltyTransaction: { count: mocks.loyaltyTransactionCount },
    // R107: PUT kanon — $transaction telo zdaj kliče advisory lock ($executeRaw)
    // + tx-fresh re-read (loyaltyAccount.findFirst) + pogojni updateMany.
    // tx re-read je pripet na ISTI findFirst mock (fast-path + tx-fresh vrata
    // isti fixture) — scope pini v A sekciji ostanejo veljavni za oba klica.
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $executeRaw: vi.fn().mockResolvedValue(1),
        loyaltyAccount: {
          findFirst: mocks.loyaltyAccountFindFirst,
          update: mocks.loyaltyAccountUpdate,
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        loyaltyTransaction: { create: mocks.loyaltyTransactionCreate },
      }),
    ),
  },
}))

import { PUT as loyaltyPUT, DELETE as loyaltyDELETE } from '@/app/api/loyalty/[id]/route'
import { POST as loyaltyPOST } from '@/app/api/loyalty/route'

vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'
const ACC_ID = 'acc-1'

function session(overrides: Record<string, unknown> = {}) {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A, ...overrides },
    error: null,
  })
}

function putRequest(body: unknown, query = '') {
  return new Request(`http://localhost:3000/api/loyalty/${ACC_ID}${query}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.loyaltyAccountFindFirst.mockResolvedValue(null)
  mocks.loyaltyAccountCreate.mockResolvedValue({ id: 'new-acc', locationId: LOC_A })
  mocks.loyaltyAccountUpdate.mockResolvedValue({
    id: ACC_ID, pointsBalance: 100, lifetimePoints: 100, tier: 'bronze',
  })
  mocks.loyaltyTransactionCount.mockResolvedValue(0)
  mocks.loyaltyTransactionCreate.mockResolvedValue({})
  mocks.loyaltyAccountDelete.mockResolvedValue({ id: ACC_ID })
  mocks.triggerTierUpgrade.mockResolvedValue(undefined)
})

// ══════════════════════════════════════════════════════════════════
// A. loyalty/[id] PUT (HIGH)
// ══════════════════════════════════════════════════════════════════
describe('R86-5 A: PUT /api/loyalty/[id] — tenant scope', () => {
  it('regular user z NULL lokacijo → 403 + ZERO db klicev', async () => {
    session({ role: 'staff', locationId: null })
    const res = await loyaltyPUT(putRequest({ customerName: 'X' }), { params: Promise.resolve({ id: ACC_ID }) })
    expect(res.status).toBe(403)
    expect(mocks.loyaltyAccountFindFirst).not.toHaveBeenCalled()
    expect(mocks.loyaltyAccountUpdate).not.toHaveBeenCalled()
  })

  it('loc-bound admin → findFirst where pripet na { id, locationId: LOC_A }', async () => {
    session({ role: 'admin', locationId: LOC_A })
    mocks.loyaltyAccountFindFirst.mockResolvedValue({
      id: ACC_ID, locationId: LOC_A, pointsBalance: 50, lifetimePoints: 50, tier: 'bronze',
    })
    const res = await loyaltyPUT(putRequest({ customerName: 'Nov' }), { params: Promise.resolve({ id: ACC_ID }) })
    expect(res.status).toBe(200)
    expect(mocks.loyaltyAccountFindFirst).toHaveBeenCalledWith({
      where: { id: ACC_ID, locationId: LOC_A },
    })
  })

  it('tuji račun (findFirst null) → 404 + nič pisnih klicev', async () => {
    session({ role: 'admin', locationId: LOC_A })
    mocks.loyaltyAccountFindFirst.mockResolvedValue(null)
    const res = await loyaltyPUT(putRequest({ customerName: 'Nov' }), { params: Promise.resolve({ id: ACC_ID }) })
    expect(res.status).toBe(404)
    expect(mocks.loyaltyAccountUpdate).not.toHaveBeenCalled()
  })

  it('super-admin brez lokacije → where BREZ locationId ključa', async () => {
    session({ role: 'admin', locationId: null })
    mocks.loyaltyAccountFindFirst.mockResolvedValue({
      id: ACC_ID, locationId: LOC_B, pointsBalance: 0, lifetimePoints: 0, tier: 'bronze',
    })
    const res = await loyaltyPUT(putRequest({ customerName: 'Global' }), { params: Promise.resolve({ id: ACC_ID }) })
    expect(res.status).toBe(200)
    const where = mocks.loyaltyAccountFindFirst.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })

  it('regular user ?locationId bypass ignoriran (session lokacija zmaga)', async () => {
    session({ role: 'staff', locationId: LOC_A })
    mocks.loyaltyAccountFindFirst.mockResolvedValue({
      id: ACC_ID, locationId: LOC_A, pointsBalance: 0, lifetimePoints: 0, tier: 'bronze',
    })
    const res = await loyaltyPUT(putRequest({ customerName: 'X' }, `?locationId=${LOC_B}`), { params: Promise.resolve({ id: ACC_ID }) })
    expect(res.status).toBe(200)
    expect(mocks.loyaltyAccountFindFirst).toHaveBeenCalledWith({
      where: { id: ACC_ID, locationId: LOC_A },
    })
  })
})

// ══════════════════════════════════════════════════════════════════
// B. loyalty/[id] DELETE (HIGH)
// ══════════════════════════════════════════════════════════════════
describe('R86-5 B: DELETE /api/loyalty/[id] — tenant scope', () => {
  it('regular user z NULL lokacijo → 403 + ZERO db klicev', async () => {
    session({ role: 'staff', locationId: null })
    const res = await loyaltyDELETE(new Request(`http://localhost:3000/api/loyalty/${ACC_ID}`, { method: 'DELETE' }), { params: Promise.resolve({ id: ACC_ID }) })
    expect(res.status).toBe(403)
    expect(mocks.loyaltyAccountFindFirst).not.toHaveBeenCalled()
  })

  it('tuji račun → 404 + ni delete klica', async () => {
    session({ role: 'admin', locationId: LOC_A })
    mocks.loyaltyAccountFindFirst.mockResolvedValue(null)
    const res = await loyaltyDELETE(new Request(`http://localhost:3000/api/loyalty/${ACC_ID}`, { method: 'DELETE' }), { params: Promise.resolve({ id: ACC_ID }) })
    expect(res.status).toBe(404)
  })

  it('loc-bound admin → where pripet na lastno lokacijo', async () => {
    session({ role: 'admin', locationId: LOC_A })
    mocks.loyaltyAccountFindFirst.mockResolvedValue({
      id: ACC_ID, locationId: LOC_A, pointsBalance: 0, tier: 'bronze',
    })
    const res = await loyaltyDELETE(new Request(`http://localhost:3000/api/loyalty/${ACC_ID}`, { method: 'DELETE' }), { params: Promise.resolve({ id: ACC_ID }) })
    expect(res.status).toBe(200)
    expect(mocks.loyaltyAccountFindFirst).toHaveBeenCalledWith({
      where: { id: ACC_ID, locationId: LOC_A },
    })
  })
})

// ══════════════════════════════════════════════════════════════════
// C. loyalty POST (MEDIUM — NULL-stamp)
// ══════════════════════════════════════════════════════════════════
describe('R86-5 C: POST /api/loyalty — NULL-stamp zaprt', () => {
  function postRequest(query = '') {
    return new Request(`http://localhost:3000/api/loyalty${query}`, {
      method: 'POST',
      body: JSON.stringify({ customerName: 'Gost', customerPhone: '040123456', isActive: true }),
    })
  }

  it('regular user z NULL lokacijo → 403 + ZERO db klicev', async () => {
    session({ role: 'staff', locationId: null })
    const res = await loyaltyPOST(postRequest())
    expect(res.status).toBe(403)
    expect(mocks.loyaltyAccountCreate).not.toHaveBeenCalled()
    expect(mocks.loyaltyAccountFindFirst).not.toHaveBeenCalled()
  })

  it('loc-bound uporabnik → create žige session lokacijo (body/query tuje lokacije ne obstajata v shemi)', async () => {
    session({ role: 'staff', locationId: LOC_A })
    const res = await loyaltyPOST(postRequest())
    expect(res.status).toBe(201)
    expect(mocks.loyaltyAccountCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
    // duplikat check vedno vezan na žigano lokacijo
    expect(mocks.loyaltyAccountFindFirst).toHaveBeenCalledWith({
      where: { customerPhone: '040123456', locationId: LOC_A },
      select: { id: true },
    })
  })

  it('super-admin brez ?locationId → 400 fail-closed + ZERO pisnih klicev', async () => {
    session({ role: 'admin', locationId: null })
    const res = await loyaltyPOST(postRequest())
    expect(res.status).toBe(400)
    expect(mocks.loyaltyAccountCreate).not.toHaveBeenCalled()
  })

  it('super-admin z ?locationId=LOC_B → izrecni žig LOC_B', async () => {
    session({ role: 'admin', locationId: null })
    const res = await loyaltyPOST(postRequest(`?locationId=${LOC_B}`))
    expect(res.status).toBe(201)
    expect(mocks.loyaltyAccountCreate.mock.calls[0][0].data.locationId).toBe(LOC_B)
    expect(mocks.loyaltyAccountFindFirst).toHaveBeenCalledWith({
      where: { customerPhone: '040123456', locationId: LOC_B },
      select: { id: true },
    })
  })
})
