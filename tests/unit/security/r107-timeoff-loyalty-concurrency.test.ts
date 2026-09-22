// ============================================
// R107 — TIME-OFF STATE MACHINE + LOYALTY POINTS KANON CONCURRENCY
//        & ERROR KONTRAKT (TOCTOU razred R100–R106)
// ============================================
//
// Forenzika (bug-hunt val: "HR odobritve + ročne prilagoditve točk, ki jih
// R100–R106 niso pokrili" — glej _helpers.ts / points-mutations.ts R107
// header):
//
//   TO-1 (HIGH, POST /api/time-off/[id]/approve|reject): NEPOGOJEN update za
//      stale scoped read-om → (a) rejected → approved state-machine bypass,
//      (b) approve ∥ reject race = last-writer-wins, (c) replay povozil
//      reviewedAt, (d) reviewedBy NIKOLI zapisan (revizijska vrzel).
//   LO-1 (HIGH, PUT /api/loyalty/[id]): stale `existing` izven tx → diff iz
//      stale → dva sočasna "nastavi na 100" = dvojna delta (LOST UPDATE —
//      R106 INV-1b dvojček). Unovčenje brez ključavnice (audit prepleti).
//   LO-2 (MEDIUM): avtomatski LoyaltyTransaction zapis s STALE diff → lažni
//      audit. LO-3 (MEDIUM): tier upgrade od stale tierja.
//   LO-4 (MEDIUM, POST /api/loyalty): duplikat check-then-act → DB P2002 na
//      race-pathu → 500 (PO-2 R105 dvojček) → sedaj 409.
//
// Pokritje: A time-off CAS (pending-only/scope/replay/konflikt/revizija) ·
// B loyalty kanon (lock/tx-fresh diff/guardi/audit/tier/race-pathi) ·
// C POST P2002 → 409 · D fs-pini (vir pini).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Prisma } from '@prisma/client'

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'
const TOR_ID = 'tor-1'
const ACC_ID = 'acc-1'

// --- Mocki (vi.hoisted) ---
const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  // time-off (route fast-path + helper re-read)
  timeOffFindUnique: vi.fn(),
  timeOffUpdateMany: vi.fn(),
  // loyalty db-level (fast-path 404 + post-tx re-fetch)
  loyaltyDbFindFirst: vi.fn(),
  // $transaction (loyalty kanon)
  transaction: vi.fn(),
  // tx-level (loyalty kanon)
  txExecuteRaw: vi.fn(),
  txLoyaltyFindFirst: vi.fn(),
  txLoyaltyUpdate: vi.fn(),
  txLoyaltyUpdateMany: vi.fn(),
  txLoyaltyTxCreate: vi.fn(),
  // loyalty POST
  loyaltyCreate: vi.fn(),
  triggerTierUpgrade: vi.fn(),
}))

// Privzeti tx klient — kanon kliče db.$transaction(fn, options)
const txClient = {
  $executeRaw: mocks.txExecuteRaw,
  loyaltyAccount: {
    findFirst: mocks.txLoyaltyFindFirst,
    update: mocks.txLoyaltyUpdate,
    updateMany: mocks.txLoyaltyUpdateMany,
  },
  loyaltyTransaction: { create: mocks.txLoyaltyTxCreate },
}

function defaultTxImpl(fn: (tx: unknown) => Promise<unknown>) {
  return fn(txClient)
}

vi.mock('@/lib/db', () => ({
  db: {
    timeOffRequest: {
      findUnique: mocks.timeOffFindUnique,
      updateMany: mocks.timeOffUpdateMany,
    },
    loyaltyAccount: {
      findFirst: mocks.loyaltyDbFindFirst,
      create: mocks.loyaltyCreate,
    },
    $transaction: mocks.transaction,
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

// REALNI tenant-scope resolver (kanon R80/R86) — testira produkcijsko logiko
vi.mock('@/lib/auth-middleware', async () => {
  const tenantScope = await import('@/lib/auth-middleware/tenant-scope')
  return {
    requireAuth: mocks.requireAuth,
    optionalAuth: vi.fn(),
    resolveTenantLocationId: tenantScope.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: tenantScope.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: tenantScope.tenantScopeToWhere,
  }
})

// Lahkoten decimal mock (kanon — brez decimal.js nalaganja)
vi.mock('@/lib/decimal', () => ({
  toNum: (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0),
  round2: (v: number) => Math.round(v * 100) / 100,
  deepToNumbers: <T>(v: T): T => v,
  decimalsToNumbers: <T>(v: T): T => v,
}))

vi.mock('@/lib/loyalty-automation', () => ({
  triggerTierUpgrade: mocks.triggerTierUpgrade,
}))

vi.mock('@/lib/sms', () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
}))

import { POST as approvePost } from '@/app/api/time-off/[id]/approve/route'
import { POST as rejectPost } from '@/app/api/time-off/[id]/reject/route'
import { PUT as loyaltyPUT, DELETE as loyaltyDELETE } from '@/app/api/loyalty/[id]/route'
import { POST as loyaltyPOST } from '@/app/api/loyalty/route'

// --- Helperji ---
function makeSession(role: string, locationId: string | null, permissions: string[]) {
  return {
    session: {
      employeeId: 'emp-mgr',
      role,
      locationId,
      permissions,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      absoluteExpiry: Date.now() + 86400000,
    },
    error: null,
  }
}

function mockAuth(role = 'manager', locationId: string | null = LOC_A, permissions = ['manage_employees', 'take_orders', 'admin']) {
  mocks.requireAuth.mockResolvedValue(makeSession(role, locationId, permissions))
}

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

const APPROVE_URL = `http://localhost:3000/api/time-off/${TOR_ID}/approve`
const REJECT_URL = `http://localhost:3000/api/time-off/${TOR_ID}/reject`
const ACC_URL = `http://localhost:3000/api/loyalty/${ACC_ID}`

// --- Fixture: prošnja za dopust ---
function makeTor(overrides: Record<string, unknown> = {}) {
  return {
    id: TOR_ID,
    status: 'pending',
    employee: { id: 'emp-9', name: 'Nino', locationId: LOC_A },
    ...overrides,
  }
}

// --- Fixture: loyalty račun ---
function makeAcc(overrides: Record<string, unknown> = {}) {
  return {
    id: ACC_ID,
    pointsBalance: 50,
    lifetimePoints: 50,
    tier: 'bronze',
    locationId: LOC_A,
    customerName: 'Gost',
    transactions: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(defaultTxImpl)
  mocks.txExecuteRaw.mockResolvedValue(1)
  // time-off: privzeto pending + CAS uspešen
  mocks.timeOffFindUnique.mockResolvedValue(makeTor())
  mocks.timeOffUpdateMany.mockResolvedValue({ count: 1 })
  // loyalty: fast-path + tx-fresh privzeto isti račun
  mocks.loyaltyDbFindFirst.mockResolvedValue(makeAcc())
  mocks.txLoyaltyFindFirst.mockResolvedValue(makeAcc())
  mocks.txLoyaltyUpdate.mockResolvedValue(makeAcc())
  mocks.txLoyaltyUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txLoyaltyTxCreate.mockResolvedValue({ id: 'ltx-1' })
  mocks.loyaltyCreate.mockResolvedValue(makeAcc())
  mocks.triggerTierUpgrade.mockResolvedValue(undefined)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// ══════════════════════════════════════════════════════════════════
// A. TIME-OFF CAS STATE MACHINE (TO-1)
// ══════════════════════════════════════════════════════════════════
describe('R107 A: time-off approve/reject — CAS state machine', () => {
  it('A1: approve pending → CAS updateMany { status pending, scope } + reviewedBy/At', async () => {
    mockAuth('manager', LOC_A)
    const res = await approvePost(jsonReq(APPROVE_URL, 'POST'), params(TOR_ID))
    expect(res.status).toBe(200)
    expect(mocks.timeOffUpdateMany).toHaveBeenCalledTimes(1)
    const cas = mocks.timeOffUpdateMany.mock.calls[0][0]
    expect(cas.where.id).toBe(TOR_ID)
    expect(cas.where.status).toBe('pending')
    expect(cas.where.employee).toEqual({ locationId: LOC_A })
    expect(cas.data.status).toBe('approved')
    expect(cas.data.reviewedBy).toBe('emp-mgr')
    expect(cas.data.reviewedAt).toBeInstanceOf(Date)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.replay).toBeUndefined()
  })

  it('A2: reject pending → data.status rejected (pariteta)', async () => {
    mockAuth('manager', LOC_A)
    const res = await rejectPost(jsonReq(REJECT_URL, 'POST'), params(TOR_ID))
    expect(res.status).toBe(200)
    const cas = mocks.timeOffUpdateMany.mock.calls[0][0]
    expect(cas.data.status).toBe('rejected')
    expect(cas.where.status).toBe('pending')
  })

  it('A3: replay (že odobrena) → 200 + replay flag + BREZ drugega pisanja', async () => {
    mockAuth('manager', LOC_A)
    mocks.timeOffUpdateMany.mockResolvedValue({ count: 0 })
    mocks.timeOffFindUnique.mockResolvedValue(makeTor({ status: 'approved' }))
    const res = await approvePost(jsonReq(APPROVE_URL, 'POST'), params(TOR_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.replay).toBe(true)
    expect(body.request.status).toBe('approved')
    // idempotentni replay — NATANČNO eno pisanje poskusov (CAS), brez overwrite-a
    expect(mocks.timeOffUpdateMany).toHaveBeenCalledTimes(1)
  })

  it('A4: approve na rejected prošnji → 409 (state-machine bypass zaprt)', async () => {
    mockAuth('manager', LOC_A)
    mocks.timeOffUpdateMany.mockResolvedValue({ count: 0 })
    mocks.timeOffFindUnique.mockResolvedValue(makeTor({ status: 'rejected' }))
    const res = await approvePost(jsonReq(APPROVE_URL, 'POST'), params(TOR_ID))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain(' že obdelana')
  })

  it('A5: reject na odobreni prošnji → 409 (approve ∥ reject race zaprt)', async () => {
    mockAuth('manager', LOC_A)
    mocks.timeOffUpdateMany.mockResolvedValue({ count: 0 })
    mocks.timeOffFindUnique.mockResolvedValue(makeTor({ status: 'approved' }))
    const res = await rejectPost(jsonReq(REJECT_URL, 'POST'), params(TOR_ID))
    expect(res.status).toBe(409)
  })

  it('A6: cancelled prošnja → 409 (ni prevrstave iz cancelled)', async () => {
    mockAuth('manager', LOC_A)
    mocks.timeOffUpdateMany.mockResolvedValue({ count: 0 })
    mocks.timeOffFindUnique.mockResolvedValue(makeTor({ status: 'cancelled' }))
    const res = await approvePost(jsonReq(APPROVE_URL, 'POST'), params(TOR_ID))
    expect(res.status).toBe(409)
  })

  it('A7: tuja prošnja → 404 fast-path + CAS NI klican', async () => {
    mockAuth('manager', LOC_A)
    mocks.timeOffFindUnique.mockResolvedValue(makeTor({ employee: { id: 'x', name: 'y', locationId: LOC_B } }))
    const res = await approvePost(jsonReq(APPROVE_URL, 'POST'), params(TOR_ID))
    expect(res.status).toBe(404)
    expect(mocks.timeOffUpdateMany).not.toHaveBeenCalled()
  })

  it('A8: neznani id → 404', async () => {
    mockAuth('manager', LOC_A)
    mocks.timeOffFindUnique.mockResolvedValue(null)
    const res = await approvePost(jsonReq(APPROVE_URL, 'POST'), params(TOR_ID))
    expect(res.status).toBe(404)
    expect(mocks.timeOffUpdateMany).not.toHaveBeenCalled()
  })

  it('A9: super-admin → where BREZ employee ključa (globalni nadzor)', async () => {
    mockAuth('admin', null)
    const res = await approvePost(jsonReq(APPROVE_URL, 'POST'), params(TOR_ID))
    expect(res.status).toBe(200)
    const cas = mocks.timeOffUpdateMany.mock.calls[0][0]
    expect(Object.prototype.hasOwnProperty.call(cas.where, 'employee')).toBe(false)
    expect(cas.where.status).toBe('pending')
  })

  it('A10: count 0 + izven-scope re-read → 404 (scope drift med CAS in re-readom zaprt)', async () => {
    mockAuth('manager', LOC_A)
    mocks.timeOffUpdateMany.mockResolvedValue({ count: 0 })
    mocks.timeOffFindUnique
      .mockResolvedValueOnce(makeTor()) // fast-path (in-scope)
      .mockResolvedValueOnce(makeTor({ employee: { id: 'x', name: 'y', locationId: LOC_B } })) // re-read (drift)
    const res = await approvePost(jsonReq(APPROVE_URL, 'POST'), params(TOR_ID))
    expect(res.status).toBe(404)
  })
})

// ══════════════════════════════════════════════════════════════════
// B. LOYALTY POINTS KANON (LO-1/LO-2/LO-3)
// ══════════════════════════════════════════════════════════════════
describe('R107 B: loyalty PUT — points kanon (tx-fresh diff)', () => {
  it('B1: advisory lock ključ loyalty-points:<id> + Serializable tx opts', async () => {
    mockAuth('manager', LOC_A)
    await loyaltyPUT(jsonReq(ACC_URL, 'PUT', { customerName: 'Nov' }), params(ACC_ID))
    expect(mocks.transaction).toHaveBeenCalled()
    // $executeRaw(templateStrings, value) — vrednost na indexu 1
    expect(mocks.txExecuteRaw.mock.calls[0][1]).toBe(`loyalty-points:${ACC_ID}`)
  })

  it('B2: diff iz TX-FRESH stanja (stale fast-path read NE določa delte)', async () => {
    mockAuth('manager', LOC_A)
    // fast-path vrne STALE (50), tx re-read vrne FRESH (80)
    mocks.loyaltyDbFindFirst.mockResolvedValue(makeAcc({ pointsBalance: 50, lifetimePoints: 50 }))
    mocks.txLoyaltyFindFirst.mockResolvedValue(makeAcc({ pointsBalance: 80, lifetimePoints: 80 }))
    mocks.txLoyaltyUpdate.mockResolvedValue(makeAcc({ pointsBalance: 100, lifetimePoints: 100 }))
    const res = await loyaltyPUT(jsonReq(ACC_URL, 'PUT', { pointsBalance: 100 }), params(ACC_ID))
    expect(res.status).toBe(200)
    // prej: diff = 100 − 50 (stale) = +50 → končno 150 (lost update)
    // sedaj: diff = 100 − 80 (fresh) = +20
    const updateArgs = mocks.txLoyaltyUpdate.mock.calls[0][0]
    expect(updateArgs.data.pointsBalance).toEqual({ increment: 20 })
    expect(updateArgs.data.lifetimePoints).toEqual({ increment: 20 })
  })

  it('B3: dva zaporedna "nastavi na 100" — drugi diff = 0 → brez incrementa, brez audit zapisa', async () => {
    mockAuth('manager', LOC_A)
    // 1. klic: fresh 50 → increment 50
    mocks.txLoyaltyFindFirst.mockResolvedValue(makeAcc({ pointsBalance: 50, lifetimePoints: 50 }))
    await loyaltyPUT(jsonReq(ACC_URL, 'PUT', { pointsBalance: 100 }), params(ACC_ID))
    expect(mocks.txLoyaltyUpdate.mock.calls[0][0].data.pointsBalance).toEqual({ increment: 50 })
    // 2. klic: fresh že 100 → diff 0
    mocks.txLoyaltyFindFirst.mockResolvedValue(makeAcc({ pointsBalance: 100, lifetimePoints: 100 }))
    await loyaltyPUT(jsonReq(ACC_URL, 'PUT', { pointsBalance: 100 }), params(ACC_ID))
    const secondUpdate = mocks.txLoyaltyUpdate.mock.calls[1][0]
    expect(secondUpdate.data.pointsBalance).toBeUndefined()
    expect(secondUpdate.data.lifetimePoints).toBeUndefined()
    // diff === 0 → drugi klic BREZ avtomatskega LoyaltyTransaction (prej lažni
    // audit zapis); edini zapis je iz 1. klica (diff +50)
    expect(mocks.txLoyaltyTxCreate).toHaveBeenCalledTimes(1)
    expect(mocks.txLoyaltyTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'earn', points: 50 }),
    })
  })

  it('B4: unovčenje → atomarni updateMany gte guard + update BREZ pointsBalance ključa', async () => {
    mockAuth('manager', LOC_A)
    mocks.txLoyaltyFindFirst.mockResolvedValue(makeAcc({ pointsBalance: 80, lifetimePoints: 80 }))
    mocks.txLoyaltyUpdate.mockResolvedValue(makeAcc({ pointsBalance: 30, lifetimePoints: 80 }))
    const res = await loyaltyPUT(jsonReq(ACC_URL, 'PUT', { pointsBalance: 30 }), params(ACC_ID))
    expect(res.status).toBe(200)
    expect(mocks.txLoyaltyUpdateMany).toHaveBeenCalledWith({
      where: { id: ACC_ID, pointsBalance: { gte: 50 } },
      data: { pointsBalance: { decrement: 50 } },
    })
    const updateArgs = mocks.txLoyaltyUpdate.mock.calls[0][0]
    expect(updateArgs.data.pointsBalance).toBeUndefined()
  })

  it('B5: unovčenje preko stanja (gte guard count 0) → 400 "Ni dovolj točk"', async () => {
    mockAuth('manager', LOC_A)
    mocks.txLoyaltyFindFirst.mockResolvedValue(makeAcc({ pointsBalance: 80, lifetimePoints: 80 }))
    mocks.txLoyaltyUpdateMany.mockResolvedValue({ count: 0 })
    const res = await loyaltyPUT(jsonReq(ACC_URL, 'PUT', { pointsBalance: 30 }), params(ACC_ID))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Ni dovolj točk za unovčenje')
  })

  it('B6: avtomatski audit zapis s TX-FRESH diff (prej stale diff → lažni audit)', async () => {
    mockAuth('manager', LOC_A)
    mocks.loyaltyDbFindFirst.mockResolvedValue(makeAcc({ pointsBalance: 50 })) // stale
    mocks.txLoyaltyFindFirst.mockResolvedValue(makeAcc({ pointsBalance: 80 })) // fresh
    await loyaltyPUT(jsonReq(ACC_URL, 'PUT', { pointsBalance: 100 }), params(ACC_ID))
    expect(mocks.txLoyaltyTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'earn', points: 20 }),
    })
  })

  it('B7: izrecen transaction payload → podan kot je, brez avtomatskega zapisa', async () => {
    mockAuth('manager', LOC_A)
    await loyaltyPUT(jsonReq(ACC_URL, 'PUT', {
      pointsBalance: 100,
      transaction: { type: 'adjust', points: 5, reason: 'ročni vnos', monetaryValue: 0 },
    }), params(ACC_ID))
    expect(mocks.txLoyaltyTxCreate).toHaveBeenCalledTimes(1)
    expect(mocks.txLoyaltyTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'adjust', points: 5, reason: 'ročni vnos' }),
    })
  })

  it('B8: tx-fresh scoped 404 (super-admin fast-path pass, tx re-read null) → strukturirana 404', async () => {
    mockAuth('admin', null)
    mocks.txLoyaltyFindFirst.mockResolvedValue(null)
    const res = await loyaltyPUT(jsonReq(ACC_URL, 'PUT', { customerName: 'X' }), params(ACC_ID))
    expect(res.status).toBe(404)
    expect(mocks.txLoyaltyUpdate).not.toHaveBeenCalled()
  })

  it('B9: super-admin → tx re-read where BREZ locationId ključa', async () => {
    mockAuth('admin', null)
    await loyaltyPUT(jsonReq(ACC_URL, 'PUT', { customerName: 'Global' }), params(ACC_ID))
    const where = mocks.txLoyaltyFindFirst.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })

  it('B10: tier upgrade od TX-FRESH tierja (bronze + lifetime 600 → silver)', async () => {
    mockAuth('manager', LOC_A)
    mocks.txLoyaltyFindFirst.mockResolvedValue(makeAcc({ tier: 'bronze', lifetimePoints: 50 }))
    mocks.txLoyaltyUpdate.mockResolvedValue(makeAcc({ tier: 'bronze', lifetimePoints: 600, pointsBalance: 600 }))
    const res = await loyaltyPUT(jsonReq(ACC_URL, 'PUT', { pointsBalance: 600 }), params(ACC_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tierUpgrade).toEqual({ from: 'bronze', to: 'silver' })
    // P2002 parity: SMS trigger PO commitu, fire-and-forget
    expect(mocks.triggerTierUpgrade).toHaveBeenCalledWith(ACC_ID, 'bronze', 'silver')
  })

  it('B11: P2034 Serializable konflikt → 409 (nikoli 500)', async () => {
    mockAuth('manager', LOC_A)
    mocks.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Serialization failure', { code: 'P2034', clientVersion: 'test' })
    )
    const res = await loyaltyPUT(jsonReq(ACC_URL, 'PUT', { pointsBalance: 100 }), params(ACC_ID))
    expect(res.status).toBe(409)
  })

  it('B12: enkratno prilaganje > 50000 točk (proti svežim) → 400', async () => {
    mockAuth('manager', LOC_A)
    mocks.txLoyaltyFindFirst.mockResolvedValue(makeAcc({ pointsBalance: 0, lifetimePoints: 0 }))
    const res = await loyaltyPUT(jsonReq(ACC_URL, 'PUT', { pointsBalance: 60000 }), params(ACC_ID))
    expect(res.status).toBe(400)
    expect(mocks.txLoyaltyUpdate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// C. LOYALTY POST — P2002 race-path → 409 (LO-4)
// ══════════════════════════════════════════════════════════════════
describe('R107 C: loyalty POST — duplicate race P2002 → 409', () => {
  function postRequest() {
    return jsonReq('http://localhost:3000/api/loyalty', 'POST', {
      customerName: 'Gost', customerPhone: '040123456', isActive: true,
    })
  }

  it('C1: create P2002 (sočasni duplikat) → 409, ne 500', async () => {
    mockAuth('staff', LOC_A)
    mocks.loyaltyDbFindFirst.mockResolvedValue(null) // oba preženeta duplikat pregled
    mocks.loyaltyCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
    )
    const res = await loyaltyPOST(postRequest())
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('že obstaja')
  })

  it('C2: normalen create → 201 (sanity, R86-5 parity)', async () => {
    mockAuth('staff', LOC_A)
    mocks.loyaltyDbFindFirst.mockResolvedValue(null)
    const res = await loyaltyPOST(postRequest())
    expect(res.status).toBe(201)
  })
})

// ══════════════════════════════════════════════════════════════════
// D. FS-PINI (vir pini — produkcija ostane na kanonu)
// ══════════════════════════════════════════════════════════════════
describe('R107 D: fs-pini', () => {
  const helperPath = join(process.cwd(), 'src/app/api/loyalty/_helpers/points-mutations.ts')
  const timeOffHelperPath = join(process.cwd(), 'src/app/api/time-off/[id]/_helpers.ts')
  const approvePath = join(process.cwd(), 'src/app/api/time-off/[id]/approve/route.ts')
  const rejectPath = join(process.cwd(), 'src/app/api/time-off/[id]/reject/route.ts')
  const loyaltyRoutePath = join(process.cwd(), 'src/app/api/loyalty/[id]/route.ts')

  it('D1: loyalty kanon helper pripet (lock + Serializable + tx-fresh re-read)', () => {
    const src = readFileSync(helperPath, 'utf8')
    expect(src).toContain('pg_advisory_xact_lock')
    expect(src).toContain('TransactionIsolationLevel.Serializable')
    expect(src).toContain("loyalty-points:")
    expect(src).toContain('tx.loyaltyAccount.findFirst')
    expect(src).toContain('pointsBalance: { gte: absDiff }')
  })

  it('D2: time-off helper pripet (CAS updateMany pending-only, brez nepogojenega update-a)', () => {
    const src = readFileSync(timeOffHelperPath, 'utf8')
    expect(src).toContain('status: \'pending\'')
    expect(src).toContain('updateMany')
    expect(src).not.toContain('.update({')
    expect(src).toContain('reviewedBy')
  })

  it('D3: approve/reject ruti pripeti na kanon + structuredErrorResponse', () => {
    for (const p of [approvePath, rejectPath]) {
      const src = readFileSync(p, 'utf8')
      expect(src).toContain('reviewTimeOffRequest')
      expect(src).toContain('structuredErrorResponse')
      expect(src).not.toContain('db.timeOffRequest.update(')
    }
  })

  it('D4: loyalty [id] ruta — error kontrakt (P2034/P2002 → 409), string-matching izbrisan', () => {
    const src = readFileSync(loyaltyRoutePath, 'utf8')
    expect(src).toContain("code === 'P2034'")
    expect(src).toContain("code === 'P2002'")
    expect(src).toContain('structuredErrorResponse')
    expect(src).not.toContain('handleRouteError')
    expect(src).not.toContain("match: 'Ni dovolj točk'")
  })
})
