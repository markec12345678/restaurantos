// ============================================
// R103 — HR (time-entries / staff-shifts) + GIFT-CARD CONCURRENCY & ERROR CONTRACT
//
// Forenzika (bug-hunt val iz R102 ostankov: "staff-shifts/time-entries
// concurrent clock-in, gift-card atomicity"):
//
//   T1 (HIGH, TOCTOU double clock-in) POST /api/time-entries: open-entry probe
//      (findFirst clockOut: null) + create sta bili DVE ločeni operaciji —
//      dva sočasna clock-in za istega zaposlenega → oba prebereta "ni odprtega
//      vnosa" → oba create → dva aktivna vnosa → dvojna plača. ISTI razred kot
//      R100 counter replay / R102 reservations double-booking.
//      FIX: $transaction(Serializable) — tx-fresh probe + create atomarno.
//   T2 (MEDIUM, cross-tenant leak) POST /api/time-entries: 409 openEntry
//      odgovor (existingEntry.id + clockIn!) je bil izveden PRED employee
//      scope validacijo → odzivnost 409-vs-404 je razkrivala obstoj odprtega
//      vnosa TUJEGA zaposlenega. FIX: employee fetch + scope NAJPREJ.
//   T3 (MEDIUM) PUT /api/time-entries/[id]: NEPOGOJEN db.update({ where: { id }})
//      → mid-flight izbris → P2025 → 500; scope-escape. FIX: scoped updateMany
//      → count 0 → 404 (R102 F5 vzorec).
//   T4 (plačilna integriteta) PUT: vnos s statusom 'approved' je bil uredujiv
//      (payRate/clockOut tiho prepisana odobrena plačila). FIX: 400 immutable.
//   G1 (HIGH, TOCTOU load-cap) PUT /api/gift-cards/[id]: cap check
//      (existing.balance + diff > maxBalance) proti STALE branju + NEPOGOJEN
//      increment → dva sočasna naloga presežeta initialBalance (tiskanje
//      denarja). FIX: pogojni updateMany (balance lte maxBalance − diff).
//   G2 (MEDIUM, TOCTOU status) PUT: suspended/potekla validacija SAMO pred tx;
//      sočasni suspend med pre-checkom in tx → mutacija suspendirane kartice.
//      FIX: re-validacija ZNOTRAJ tx proti tx-fresh branju.
//   G3 (MEDIUM, ledger forenzika) PUT: auto zapis transakcije iz STALE
//      compare-a (data.balance !== existing.balance) → napačen znesek/smer.
//      FIX: zapis iz appliedDelta + balanceAfter post-op (payments vzorec).
//   G5 (MEDIUM) DELETE: db.delete({ where: { id } }) → P2025 → 500; FK
//      Restrict mid-flight → P2003 → 500. FIX: scoped deleteMany → 404;
//      P2003 → 409 (fiskalna zgodovina se nikoli ne izbriše tiho).
//   S1 (HIGH, TOCTOU double-booking) POST /api/staff-shifts: conflict probe +
//      create ločena → dva sočasna POST-a → dvojna razporeditev.
//      FIX: $transaction(Serializable) + tx-fresh re-read zaposlenega.
//   S2 (MEDIUM) PATCH /api/staff-shifts/[id]: NEPOGOJEN update + confirmedAt
//      iz stale existing.status. FIX: CAS updateMany (status: existing.status)
//      → count 0 → 409 (R102 F4 waitlist vzorec).
//   S3 (LOW) DELETE /api/staff-shifts/[id]: delete → P2025 → 500. FIX: scoped
//      deleteMany → 404.
//   G8/S1/T1 (error kontrakt, R102 F1 razred): strukturirani { error, status }
//      throw-i iz $transaction teles (404/400/409) so padli v handleApiError →
//      500 '[object Object]'. FIX: structuredErrorResponse (canonical
//      src/lib/structured-error.ts, R102 reservations vzorec).
//
// Pokritje: A time-entries POST · B time-entries PUT · C gift-card PUT ·
// D gift-card DELETE · E staff-shifts POST · F staff-shifts PATCH/DELETE ·
// G fs-guardi (vir pini).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

// --- Mocki (vi.hoisted) ---
const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  // db-level
  employeeFindUnique: vi.fn(),
  employeeJobFindUnique: vi.fn(),
  timeEntryFindFirst: vi.fn(),
  timeEntryUpdateMany: vi.fn(),
  timeEntryFindUnique: vi.fn(),
  giftCardFindUnique: vi.fn(),
  giftCardUpdate: vi.fn(),
  giftCardDeleteMany: vi.fn(),
  txnCount: vi.fn(),
  staffShiftDbFindFirst: vi.fn(),
  staffShiftFindUnique: vi.fn(),
  staffShiftUpdateMany: vi.fn(),
  staffShiftDeleteMany: vi.fn(),
  // tx-level
  transaction: vi.fn(),
  txEmployeeFindUnique: vi.fn(),
  txTimeEntryFindFirst: vi.fn(),
  txTimeEntryCreate: vi.fn(),
  txGiftCardFindUnique: vi.fn(),
  txGiftCardUpdate: vi.fn(),
  txGiftCardUpdateMany: vi.fn(),
  txGiftCardTxnCreate: vi.fn(),
  txStaffShiftFindFirst: vi.fn(),
  txStaffShiftCreate: vi.fn(),
}))

// Privzeti tx klient — rute kličejo $transaction(fn, options); mock podpira
// oba tudi takrat, ko test prekrije implementacijo (mockRejectedValue).
const txClient = {
  employee: { findUnique: mocks.txEmployeeFindUnique },
  employeeJob: { findUnique: mocks.employeeJobFindUnique },
  timeEntry: { findFirst: mocks.txTimeEntryFindFirst, create: mocks.txTimeEntryCreate },
  giftCard: {
    findUnique: mocks.txGiftCardFindUnique,
    update: mocks.txGiftCardUpdate,
    updateMany: mocks.txGiftCardUpdateMany,
  },
  giftCardTransaction: { create: mocks.txGiftCardTxnCreate },
  staffShift: { findFirst: mocks.txStaffShiftFindFirst, create: mocks.txStaffShiftCreate },
}

function defaultTxImpl(fn: (tx: unknown) => Promise<unknown>) {
  return fn(txClient)
}

vi.mock('@/lib/db', () => ({
  db: {
    employee: { findUnique: mocks.employeeFindUnique },
    employeeJob: { findUnique: mocks.employeeJobFindUnique },
    timeEntry: {
      findFirst: mocks.timeEntryFindFirst,
      updateMany: mocks.timeEntryUpdateMany,
      findUnique: mocks.timeEntryFindUnique,
    },
    giftCard: {
      findUnique: mocks.giftCardFindUnique,
      update: mocks.giftCardUpdate,
      deleteMany: mocks.giftCardDeleteMany,
    },
    giftCardTransaction: { count: mocks.txnCount },
    staffShift: {
      findFirst: mocks.staffShiftDbFindFirst,
      findUnique: mocks.staffShiftFindUnique,
      updateMany: mocks.staffShiftUpdateMany,
      deleteMany: mocks.staffShiftDeleteMany,
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
  multiply: (a: number, b: number) => a * b,
  greaterThan: (a: unknown, b: unknown) => Number(a) > Number(b),
  deepToNumbers: <T>(v: T): T => v,
  decimalsToNumbers: <T>(v: T): T => v,
}))

import { POST as timeEntriesPOST } from '@/app/api/time-entries/route'
import { PUT as timeEntryPUT } from '@/app/api/time-entries/[id]/route'
import { PUT as giftCardPUT, DELETE as giftCardDELETE } from '@/app/api/gift-cards/[id]/route'
import { POST as staffShiftsPOST } from '@/app/api/staff-shifts/route'
import { PATCH as staffShiftPATCH, DELETE as staffShiftDELETE } from '@/app/api/staff-shifts/[id]/route'

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

function mockAuth(role = 'manager', locationId: string | null = LOC_A, permissions = ['manage_employees']) {
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

const TIME_ENTRIES_URL = 'http://localhost:3000/api/time-entries'
const GIFT_CARD_URL = 'http://localhost:3000/api/gift-cards/gc-1'
const STAFF_SHIFTS_URL = 'http://localhost:3000/api/staff-shifts'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(defaultTxImpl)
  mockAuth()
})

// ════════════════════════════════════════════════════════════════
// A. POST /api/time-entries — T1 tx atomarnost + T2 reorder
// ════════════════════════════════════════════════════════════════
describe('R103 A: POST /api/time-entries — Serializable tx + scope reorder', () => {
  const CLOCK_IN_BODY = { employeeId: 'emp-1', clockIn: '2026-01-15T08:00:00Z' }

  beforeEach(() => {
    mocks.employeeFindUnique.mockResolvedValue({ id: 'emp-1', name: 'Ana', role: 'waiter', locationId: LOC_A })
    // tx-fresh re-read (R103: zaposleni se ponovno prebere ZNOTRAJ tx)
    mocks.txEmployeeFindUnique.mockResolvedValue({ id: 'emp-1', name: 'Ana', role: 'waiter', locationId: LOC_A })
    mocks.txTimeEntryFindFirst.mockResolvedValue(null)
    mocks.txTimeEntryCreate.mockResolvedValue({ id: 'te-1', clockIn: new Date() })
  })

  it('T1: open-entry probe + create v tx klientu, Serializable pin', async () => {
    const res = await timeEntriesPOST(jsonReq(TIME_ENTRIES_URL, 'POST', CLOCK_IN_BODY))

    expect(res.status).toBe(201)
    // Serializable isolation level (TOCTOU zapora)
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    )
    // probe + create OBA v tx klientu (ločeni mocki od db-level)
    expect(mocks.txTimeEntryFindFirst).toHaveBeenCalledWith({
      where: {
        employeeId: 'emp-1',
        clockOut: null,
        status: { notIn: ['cancelled'] },
      },
    })
    expect(mocks.txTimeEntryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ employeeId: 'emp-1', locationId: LOC_A }),
      }),
    )
  })

  it('T1: probe se izvede PRED create (invocationCallOrder)', async () => {
    await timeEntriesPOST(jsonReq(TIME_ENTRIES_URL, 'POST', CLOCK_IN_BODY))
    const probeOrder = mocks.txTimeEntryFindFirst.mock.invocationCallOrder[0]
    const createOrder = mocks.txTimeEntryCreate.mock.invocationCallOrder[0]
    expect(probeOrder).toBeLessThan(createOrder)
  })

  it('T1: tx probe najde odprt vnos → 409 s structured error kontraktom (ne 500)', async () => {
    mocks.txTimeEntryFindFirst.mockResolvedValue({ id: 'te-old', clockIn: new Date('2026-01-15T07:00:00Z') })

    const res = await timeEntriesPOST(jsonReq(TIME_ENTRIES_URL, 'POST', CLOCK_IN_BODY))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain('že ima odprt časovni vnos')
    // NextResponse.json serializira Date → ISO string
    expect(body.existingEntry).toEqual({ id: 'te-old', clockIn: expect.any(String) })
    expect(mocks.txTimeEntryCreate).not.toHaveBeenCalled()
  })

  it('T1: clock-out create (clockOut podan) → probe NI izveden', async () => {
    const res = await timeEntriesPOST(
      jsonReq(TIME_ENTRIES_URL, 'POST', { ...CLOCK_IN_BODY, clockOut: '2026-01-15T16:00:00Z' }),
    )

    expect(res.status).toBe(201)
    expect(mocks.txTimeEntryFindFirst).not.toHaveBeenCalled()
  })

  it('T1: P2034 serialization abort → 409 "Poskusite znova", ne 500', async () => {
    mocks.transaction.mockRejectedValue({ code: 'P2034' })

    const res = await timeEntriesPOST(jsonReq(TIME_ENTRIES_URL, 'POST', CLOCK_IN_BODY))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain('Poskusite znova')
  })

  it('T2: tuj zaposleni (loc-2) → 404 notInScope + probe NI izveden (leak zaprt)', async () => {
    mocks.employeeFindUnique.mockResolvedValue({ id: 'emp-x', name: 'Tuj', role: 'waiter', locationId: LOC_B })

    const res = await timeEntriesPOST(jsonReq(TIME_ENTRIES_URL, 'POST', { employeeId: 'emp-x', clockIn: '2026-01-15T08:00:00Z' }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Zaposleni ni najden')
    // R103 jedro: prej je 409 probe (z existingEntry leakom) potekla PRED
    // scope validacijo — zdaj scope pade prej in probe se ne izvede
    expect(mocks.txTimeEntryFindFirst).not.toHaveBeenCalled()
    expect(mocks.txTimeEntryCreate).not.toHaveBeenCalled()
  })

  it('T1: zaposleni izbrisan mid-flight (tx re-read null) → 404 + NI create-a', async () => {
    mocks.txEmployeeFindUnique.mockResolvedValue(null)

    const res = await timeEntriesPOST(jsonReq(TIME_ENTRIES_URL, 'POST', CLOCK_IN_BODY))

    expect(res.status).toBe(404)
    expect(mocks.txTimeEntryCreate).not.toHaveBeenCalled()
  })

  it('T1: lokacijska sprememba mid-flight (tx re-read loc-2) → 404 (scope re-check)', async () => {
    mocks.txEmployeeFindUnique.mockResolvedValue({ id: 'emp-1', name: 'Ana', role: 'waiter', locationId: LOC_B })

    const res = await timeEntriesPOST(jsonReq(TIME_ENTRIES_URL, 'POST', CLOCK_IN_BODY))

    expect(res.status).toBe(404)
    expect(mocks.txTimeEntryCreate).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// B. PUT /api/time-entries/[id] — T3 scoped CAS + T4 approved immutable
// ════════════════════════════════════════════════════════════════
describe('R103 B: PUT /api/time-entries/[id] — approved guard + scoped updateMany', () => {
  const entryAt = (status = 'active') => ({
    id: 'te-1',
    locationId: LOC_A,
    status,
    clockIn: new Date('2026-01-15T08:00:00Z'),
    clockOut: null,
    breakMinutes: 30,
    payRate: 10,
  })

  beforeEach(() => {
    mocks.timeEntryFindFirst.mockResolvedValue(entryAt())
    mocks.timeEntryUpdateMany.mockResolvedValue({ count: 1 })
    mocks.timeEntryFindUnique.mockResolvedValue(entryAt())
  })

  it('T4: odobren vnos → 400 "plačilna integriteta" + NI update-a', async () => {
    mocks.timeEntryFindFirst.mockResolvedValue(entryAt('approved'))

    const res = await timeEntryPUT(
      jsonReq('http://localhost:3000/api/time-entries/te-1', 'PUT', { payRate: 50 }),
      params('te-1'),
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('plačilna integriteta')
    expect(mocks.timeEntryUpdateMany).not.toHaveBeenCalled()
  })

  it('T3: uspešni clock-out → scoped updateMany (where { id, locationId }) + re-fetch', async () => {
    const res = await timeEntryPUT(
      jsonReq('http://localhost:3000/api/time-entries/te-1', 'PUT', { clockOut: '2026-01-15T16:00:00Z' }),
      params('te-1'),
    )

    expect(res.status).toBe(200)
    expect(mocks.timeEntryUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'te-1', locationId: LOC_A },
        data: expect.objectContaining({ clockOut: expect.any(Date) }),
      }),
    )
    // odgovor iz svežega re-fetcha (ne stale)
    expect(mocks.timeEntryFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'te-1' } }),
    )
  })

  it('T3: super-admin (null scope) → where BREZ locationId (nikoli { locationId: null })', async () => {
    mockAuth('super_admin', null, ['manage_employees'])

    await timeEntryPUT(
      jsonReq('http://localhost:3000/api/time-entries/te-1', 'PUT', { clockOut: '2026-01-15T16:00:00Z' }),
      params('te-1'),
    )

    const where = mocks.timeEntryUpdateMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })

  it('T3: mid-flight izbris (count 0) → 404, ne 500', async () => {
    mocks.timeEntryUpdateMany.mockResolvedValue({ count: 0 })

    const res = await timeEntryPUT(
      jsonReq('http://localhost:3000/api/time-entries/te-1', 'PUT', { clockOut: '2026-01-15T16:00:00Z' }),
      params('te-1'),
    )

    expect(res.status).toBe(404)
  })

  it('T3: tuji vnos (pre-check null) → 404 + NI update-a', async () => {
    mocks.timeEntryFindFirst.mockResolvedValue(null)

    const res = await timeEntryPUT(
      jsonReq('http://localhost:3000/api/time-entries/te-1', 'PUT', { clockOut: '2026-01-15T16:00:00Z' }),
      params('te-1'),
    )

    expect(res.status).toBe(404)
    expect(mocks.timeEntryUpdateMany).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// C. PUT /api/gift-cards/[id] — G1 atomni cap + G2 tx re-validacija + G3 ledger
// ════════════════════════════════════════════════════════════════
describe('R103 C: PUT /api/gift-cards/[id] — atomic load cap + tx re-validation', () => {
  /** Parent kartica (pre-tx findUnique brez select/include). */
  const cardAt = (overrides: Record<string, unknown> = {}) => ({
    id: 'gc-1',
    locationId: LOC_A,
    status: 'active',
    balance: 30,
    initialBalance: 100,
    expiresAt: null,
    ...overrides,
  })

  /** Razlikuje parent / tx re-read (1. klic) / post-op (nadalej) / final re-fetch (include). */
  function mockCardFlow(parent: Record<string, unknown>, postOp?: Record<string, unknown>) {
    mocks.giftCardFindUnique.mockImplementation((args: { include?: unknown; select?: unknown } = {}) => {
      if (args?.include) return Promise.resolve({ ...parent, transactions: [] })
      if (args?.select) return Promise.resolve({ balance: parent.balance })
      return Promise.resolve(parent)
    })
    // tx-fresh: 1. klic = parent (tx začetno stanje), nadaljnji = postOp
    let call = 0
    mocks.txGiftCardFindUnique.mockImplementation(() => {
      call += 1
      return Promise.resolve(call === 1 ? parent : (postOp ?? parent))
    })
  }

  beforeEach(() => {
    mockCardFlow(cardAt())
    mocks.txGiftCardUpdateMany.mockResolvedValue({ count: 1 })
    mocks.txGiftCardUpdate.mockResolvedValue(cardAt())
    mocks.txGiftCardTxnCreate.mockResolvedValue({})
  })

  it('G1: load → POGOJNI updateMany (balance lte cap − diff), increment diff', async () => {
    // balance 30 → 50 (diff +20), initialBalance 100 → cap predicate lte 80
    const res = await giftCardPUT(jsonReq(GIFT_CARD_URL, 'PUT', { balance: 50 }), params('gc-1'))

    expect(res.status).toBe(200)
    expect(mocks.txGiftCardUpdateMany).toHaveBeenCalledWith({
      where: { id: 'gc-1', balance: { lte: 80 } },
      data: { balance: { increment: 20 } },
    })
  })

  it('G1: cap presežen (DB predicate fail → count 0) → 409 "exceed initial card value", ne 500', async () => {
    mocks.txGiftCardUpdateMany.mockResolvedValue({ count: 0 })

    const res = await giftCardPUT(jsonReq(GIFT_CARD_URL, 'PUT', { balance: 500 }), params('gc-1'))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain('exceed initial card value')
    expect(mocks.txGiftCardTxnCreate).not.toHaveBeenCalled()
  })

  it('G2: suspendiranje mid-flight (tx re-read suspended) → 400 + NI mutacije', async () => {
    // pre-tx parent: active; tx-fresh re-read (1. klic): suspended (sočasni
    // suspend) — NE skozi mockCardFlow sekvenco (ta postavi 1. klic = parent)
    mocks.giftCardFindUnique.mockImplementation((args: { include?: unknown; select?: unknown } = {}) => {
      if (args?.include) return Promise.resolve({ ...cardAt(), transactions: [] })
      if (args?.select) return Promise.resolve({ balance: cardAt().balance })
      return Promise.resolve(cardAt())
    })
    mocks.txGiftCardFindUnique.mockResolvedValue(cardAt({ status: 'suspended' }))

    const res = await giftCardPUT(jsonReq(GIFT_CARD_URL, 'PUT', { balance: 50 }), params('gc-1'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Suspendirane kartice ni mogoče spreminjati')
    expect(mocks.txGiftCardUpdateMany).not.toHaveBeenCalled()
    expect(mocks.txGiftCardTxnCreate).not.toHaveBeenCalled()
  })

  it('G2: potek mid-flight (tx re-read expiresAt v preteklosti) → 400', async () => {
    mocks.giftCardFindUnique.mockImplementation((args: { include?: unknown; select?: unknown } = {}) => {
      if (args?.include) return Promise.resolve({ ...cardAt(), transactions: [] })
      if (args?.select) return Promise.resolve({ balance: cardAt().balance })
      return Promise.resolve(cardAt())
    })
    mocks.txGiftCardFindUnique.mockResolvedValue(cardAt({ expiresAt: new Date('2026-01-01T00:00:00Z') }))

    const res = await giftCardPUT(jsonReq(GIFT_CARD_URL, 'PUT', { balance: 50 }), params('gc-1'))

    expect(res.status).toBe(400)
    expect(mocks.txGiftCardUpdateMany).not.toHaveBeenCalled()
  })

  it('G1: decrement brez sredstev (count 0) → 400 "Insufficient", ne 500', async () => {
    mocks.txGiftCardUpdateMany.mockResolvedValue({ count: 0 })

    const res = await giftCardPUT(jsonReq(GIFT_CARD_URL, 'PUT', { balance: 0 }), params('gc-1'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Insufficient gift card balance')
  })

  it('G1+G3: decrement na 0 → depleted reclassifikacija + ledger redeem z appliedDelta', async () => {
    // balance 30 → 0 (diff −30); post-op branje pokaže 0 → depleted
    mockCardFlow(cardAt(), cardAt({ balance: 0 }))
    mocks.txGiftCardUpdateMany.mockResolvedValue({ count: 1 })
    mocks.txGiftCardUpdate.mockResolvedValue(cardAt({ status: 'depleted' }))

    const res = await giftCardPUT(jsonReq(GIFT_CARD_URL, 'PUT', { balance: 0 }), params('gc-1'))

    expect(res.status).toBe(200)
    expect(mocks.txGiftCardUpdateMany).toHaveBeenCalledWith({
      where: { id: 'gc-1', balance: { gte: 30 } },
      data: { balance: { decrement: 30 } },
    })
    // depleted reclassifikacija (post-op balance 0)
    expect(mocks.txGiftCardUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'depleted' }) }),
    )
    // ledger iz appliedDelta (−30), ne stale compare
    expect(mocks.txGiftCardTxnCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'redeem', amount: -30 }),
    })
  })

  it('G3: load success → auto ledger "load" z appliedDelta in balanceAfter post-op', async () => {
    mockCardFlow(cardAt(), cardAt({ balance: 50 })) // post-op stanje 50

    await giftCardPUT(jsonReq(GIFT_CARD_URL, 'PUT', { balance: 50 }), params('gc-1'))

    expect(mocks.txGiftCardTxnCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'load',
        amount: 20,
        balanceAfter: 50,
        note: 'Nalaganje sredstev',
      }),
    })
  })

  it('G8: mid-flight izbris (tx re-read null) → 404 structured, ne 500', async () => {
    mocks.txGiftCardFindUnique.mockResolvedValue(null)

    const res = await giftCardPUT(jsonReq(GIFT_CARD_URL, 'PUT', { balance: 50 }), params('gc-1'))

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain('ni najdena')
  })

  it('G8: fallback NE-strukturirana napaka (Error) → handleApiError 500', async () => {
    mocks.transaction.mockRejectedValue(new Error('db connection lost'))

    const res = await giftCardPUT(jsonReq(GIFT_CARD_URL, 'PUT', { balance: 50 }), params('gc-1'))

    expect(res.status).toBe(500)
  })
})

// ════════════════════════════════════════════════════════════════
// D. DELETE /api/gift-cards/[id] — G5 scoped deleteMany + P2003 → 409
// ════════════════════════════════════════════════════════════════
describe('R103 D: DELETE /api/gift-cards/[id] — scoped deleteMany', () => {
  beforeEach(() => {
    mocks.giftCardFindUnique.mockImplementation((args: { include?: unknown; select?: unknown } = {}) => {
      if (args?.select) return Promise.resolve({ balance: 0 })
      return Promise.resolve({ id: 'gc-1', locationId: LOC_A, status: 'active', balance: 0, initialBalance: 0, expiresAt: null })
    })
    mocks.txnCount.mockResolvedValue(0)
    mocks.giftCardDeleteMany.mockResolvedValue({ count: 1 })
  })

  it('G5: loc-bound admin → scoped deleteMany (where { id, locationId })', async () => {
    const res = await giftCardDELETE(jsonReq(GIFT_CARD_URL, 'DELETE'), params('gc-1'))

    expect(res.status).toBe(200)
    expect(mocks.giftCardDeleteMany).toHaveBeenCalledWith({
      where: { id: 'gc-1', locationId: LOC_A },
    })
  })

  it('G5: super-admin → where BREZ locationId ključa', async () => {
    mockAuth('super_admin', null, ['admin'])

    await giftCardDELETE(jsonReq(GIFT_CARD_URL, 'DELETE'), params('gc-1'))

    const where = mocks.giftCardDeleteMany.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })

  it('G5: mid-flight izbris (count 0) → 404, ne 500', async () => {
    mocks.giftCardDeleteMany.mockResolvedValue({ count: 0 })

    const res = await giftCardDELETE(jsonReq(GIFT_CARD_URL, 'DELETE'), params('gc-1'))

    expect(res.status).toBe(404)
  })

  it('G5: FK Restrict mid-flight transakcija (P2003) → 409 "transakcijsko zgodovino", ne 500', async () => {
    mocks.giftCardDeleteMany.mockRejectedValue({ code: 'P2003' })

    const res = await giftCardDELETE(jsonReq(GIFT_CARD_URL, 'DELETE'), params('gc-1'))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain('transakcijsko zgodovino')
  })
})

// ════════════════════════════════════════════════════════════════
// E. POST /api/staff-shifts — S1 Serializable tx double-booking
// ════════════════════════════════════════════════════════════════
describe('R103 E: POST /api/staff-shifts — Serializable tx (double-booking)', () => {
  const SHIFT_BODY = { employeeId: 'emp-1', shiftDate: '2026-01-15', startTime: '09:00', endTime: '17:00' }

  beforeEach(() => {
    mocks.employeeFindUnique.mockResolvedValue({ id: 'emp-1', name: 'Ana', role: 'waiter', locationId: LOC_A })
    mocks.txEmployeeFindUnique.mockResolvedValue({ id: 'emp-1', name: 'Ana', role: 'waiter', locationId: LOC_A })
    mocks.txStaffShiftFindFirst.mockResolvedValue(null)
    mocks.txStaffShiftCreate.mockResolvedValue({ id: 'ss-1' })
  })

  it('S1: conflict probe + create v tx klientu, Serializable pin', async () => {
    const res = await staffShiftsPOST(jsonReq(STAFF_SHIFTS_URL, 'POST', SHIFT_BODY))

    expect(res.status).toBe(201)
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    )
    // tx-fresh probe — scopcan na session lokacijo (R81-G pin ohranjen)
    expect(mocks.txStaffShiftFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: 'emp-1',
          status: { notIn: ['cancelled'] },
          locationId: LOC_A,
        }),
      }),
    )
    expect(mocks.txStaffShiftCreate).toHaveBeenCalled()
  })

  it('S1: prekrivanje (tx-fresh probe) → 409 structured error doseže klienta (ne 500)', async () => {
    mocks.txStaffShiftFindFirst.mockResolvedValue({ id: 'ss-old', startTime: '10:00', endTime: '18:00' })

    const res = await staffShiftsPOST(jsonReq(STAFF_SHIFTS_URL, 'POST', SHIFT_BODY))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain('prekriva')
    expect(mocks.txStaffShiftCreate).not.toHaveBeenCalled()
  })

  it('S1: zaposleni izbrisan mid-flight (tx re-read null) → 404 + NI create-a', async () => {
    mocks.txEmployeeFindUnique.mockResolvedValue(null)

    const res = await staffShiftsPOST(jsonReq(STAFF_SHIFTS_URL, 'POST', SHIFT_BODY))

    expect(res.status).toBe(404)
    expect(mocks.txStaffShiftFindFirst).not.toHaveBeenCalled()
    expect(mocks.txStaffShiftCreate).not.toHaveBeenCalled()
  })

  it('S1: lokacijska sprememba mid-flight (tx re-read loc-2) → 404 (scope re-check)', async () => {
    mocks.txEmployeeFindUnique.mockResolvedValue({ id: 'emp-1', name: 'Ana', role: 'waiter', locationId: LOC_B })

    const res = await staffShiftsPOST(jsonReq(STAFF_SHIFTS_URL, 'POST', SHIFT_BODY))

    expect(res.status).toBe(404)
    expect(mocks.txStaffShiftCreate).not.toHaveBeenCalled()
  })

  it('S1: P2034 serialization abort → 409 "Poskusite znova", ne 500', async () => {
    mocks.transaction.mockRejectedValue({ code: 'P2034' })

    const res = await staffShiftsPOST(jsonReq(STAFF_SHIFTS_URL, 'POST', SHIFT_BODY))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain('Poskusite znova')
  })
})

// ════════════════════════════════════════════════════════════════
// F. PATCH/DELETE /api/staff-shifts/[id] — S2 CAS + S3 scoped deleteMany
// ════════════════════════════════════════════════════════════════
describe('R103 F: staff-shifts/[id] — CAS PATCH + scoped DELETE', () => {
  beforeEach(() => {
    // PATCH/DELETE pre-check gre prek db.staffShift.findFirst (scoped)
    mocks.staffShiftDbFindFirst.mockResolvedValue({ id: 'ss-1', status: 'scheduled', locationId: LOC_A, employee: { name: 'A' } })
    mocks.staffShiftUpdateMany.mockResolvedValue({ count: 1 })
    mocks.staffShiftDeleteMany.mockResolvedValue({ count: 1 })
    mocks.staffShiftFindUnique.mockResolvedValue({ id: 'ss-1', employee: { name: 'A' }, location: { id: LOC_A } })
  })

  it('S2: PATCH → CAS updateMany (where { id, locationId, status: stale })', async () => {
    const res = await staffShiftPATCH(
      jsonReq('http://localhost:3000/api/staff-shifts/ss-1', 'PATCH', { status: 'confirmed' }),
      params('ss-1'),
    )

    expect(res.status).toBe(200)
    expect(mocks.staffShiftUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ss-1', locationId: LOC_A, status: 'scheduled' },
        data: expect.objectContaining({ status: 'confirmed', confirmedAt: expect.any(Date) }),
      }),
    )
  })

  it('S2: stale status (count 0) → 409 "osvežite pogled", ne 500', async () => {
    mocks.staffShiftUpdateMany.mockResolvedValue({ count: 0 })

    const res = await staffShiftPATCH(
      jsonReq('http://localhost:3000/api/staff-shifts/ss-1', 'PATCH', { status: 'confirmed' }),
      params('ss-1'),
    )

    expect(res.status).toBe(409)
  })

  it('S2: tuja izmena (pre-check null) → 404 + NI update-a', async () => {
    mocks.staffShiftDbFindFirst.mockResolvedValue(null)

    const res = await staffShiftPATCH(
      jsonReq('http://localhost:3000/api/staff-shifts/ss-1', 'PATCH', { status: 'confirmed' }),
      params('ss-1'),
    )

    expect(res.status).toBe(404)
    expect(mocks.staffShiftUpdateMany).not.toHaveBeenCalled()
  })

  it('S3: DELETE → scoped deleteMany; count 0 → 404', async () => {
    const res = await staffShiftDELETE(jsonReq('http://localhost:3000/api/staff-shifts/ss-1', 'DELETE'), params('ss-1'))
    expect(res.status).toBe(200)
    expect(mocks.staffShiftDeleteMany).toHaveBeenCalledWith({
      where: { id: 'ss-1', locationId: LOC_A },
    })

    mocks.staffShiftDeleteMany.mockResolvedValue({ count: 0 })
    const res404 = await staffShiftDELETE(jsonReq('http://localhost:3000/api/staff-shifts/ss-1', 'DELETE'), params('ss-1'))
    expect(res404.status).toBe(404)
  })
})

// ════════════════════════════════════════════════════════════════
// G. fs-guardi — vir pini (prepreči regresijo na plain update/delete)
// ════════════════════════════════════════════════════════════════
describe('R103 G: fs-guardi — vir pini', () => {
  // Komentarji vsebujejo forenzične opombe z ISTIMI nizi kot stara koda —
  // pini morajo garantirati stanje PRAVE kode, zato stripamo // komentarje.
  const readCode = (p: string) =>
    readFileSync(join(process.cwd(), p), 'utf-8').replace(/\/\/.*$/gm, '')

  it('structuredErrorResponse (canonical lib) je vezan v gift-cards PUT + staff-shifts POST', () => {
    const gc = readCode('src/app/api/gift-cards/[id]/route.ts')
    const ss = readCode('src/app/api/staff-shifts/route.ts')
    expect(gc).toContain("from '@/lib/structured-error'")
    expect(gc).toContain('structuredErrorResponse(error,')
    expect(ss).toContain("from '@/lib/structured-error'")
  })

  it('time-entries PUT: plain db.update IZBRISAN, scoped updateMany prisoten', () => {
    const src = readCode('src/app/api/time-entries/[id]/route.ts')
    expect(src).toContain('db.timeEntry.updateMany(')
    expect(src).not.toContain('db.timeEntry.update({')
  })

  it('staff-shifts [id]: plain db.update/delete IZBRISANA, CAS updateMany + scoped deleteMany prisotna', () => {
    const src = readCode('src/app/api/staff-shifts/[id]/route.ts')
    expect(src).toContain('db.staffShift.updateMany(')
    expect(src).toContain('db.staffShift.deleteMany(')
    expect(src).not.toContain('db.staffShift.update({')
    expect(src).not.toContain('db.staffShift.delete({')
    // CAS: where pripet na stale status
    expect(src).toContain('status: existing.status')
  })

  it('gift-cards [id]: plain db.delete IZBRISAN, scoped deleteMany + P2003 map prisotna', () => {
    const src = readCode('src/app/api/gift-cards/[id]/route.ts')
    expect(src).toContain('db.giftCard.deleteMany(')
    expect(src).not.toContain('db.giftCard.delete({')
    expect(src).toContain("code === 'P2003'")
  })

  it('gift-cards PUT: atomni load cap (balance lte) prisoten, stale-compare ledger IZBRISAN', () => {
    const src = readCode('src/app/api/gift-cards/[id]/route.ts')
    expect(src).toContain('balance: { lte: maxBalance - diff }')
    // G3 fs-guard: stale compare `data.balance !== toNum(existing.balance)` IZBRISAN
    expect(src).not.toContain('data.balance !== toNum(existing.balance)')
    // G3: appliedDelta pogoj (zapis iz dejansko uporabljene spremembe)
    expect(src).toContain('appliedDelta !== null')
    // G2 fs-guard: status re-validacija ZNOTRAJ tx
    expect(src).toContain("existing.status === 'suspended'")
  })

  it('Serializable pin v obeh POST tokovih (staff-shifts + time-entries)', () => {
    expect(readCode('src/app/api/staff-shifts/route.ts')).toContain('TransactionIsolationLevel.Serializable')
    expect(readCode('src/app/api/time-entries/route.ts')).toContain('TransactionIsolationLevel.Serializable')
  })

  it('canonical src/lib/structured-error.ts obstaja; reservations helper re-exporta', () => {
    const lib = readCode('src/lib/structured-error.ts')
    expect(lib).toContain('export function structuredErrorResponse')
    const helper = readCode('src/app/api/reservations/_helpers/structured-error.ts')
    expect(helper).toContain("export { structuredErrorResponse } from '@/lib/structured-error'")
  })
})
