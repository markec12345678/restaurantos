// ============================================
// R104 — QR-PAY CONFIRM (javna denarna pot) + CASH-REGISTER SHIFT LIFECYCLE
//        CONCURRENCY & IDEMPOTENCY (TOCTOU razred iz R100/R102/R103)
// ============================================
//
// Forenzika (bug-hunt val: "sibling plačilnih/izmenskih tokov, ki jih R100–R103
// niso pokrili"):
//
//   Q1 (HIGH, TOCTOU double-charge) POST /api/qr-pay/confirm: celoten tok je
//      bil read-then-act BREZ transakcije — paymentStatus pre-check +
//      idempotencyKey findFirst sta bili stale branji, create/update pa trije
//      ločeni klici. ISTI token → P2002 → 500 (čeprav je plačilo uspelo);
//      RAZLIČNA tokena (re-init izda nov token, stari veljaven do TTL R82-D)
//      → idempotencyKey različen → DVE plačili → gost plača DVAKRAT.
//      FIX: $transaction(Serializable) + pg_advisory_xact_lock(hashtext(checkId))
//      (kanon staff plačilne poti create-payment.ts) + tx-fresh re-read +
//      P2002 race-path → 200 obstoječe + P2034 → 409.
//   Q2 (HIGH, over-collection) confirm: amount = celoten total + tip ne glede
//      na paidSoFar → delno plačan ček ('partial') zaračunan ŠE ENKRAT v
//      celoti. FIX: amount = preostanek (round2(total − paidSoFar)), tip
//      ločeno (staff semantika — Z-report/cash-close ne štejeta tipa dvakrat).
//   Q3 (MEDIUM, idempotency kontrakt) isti-token replay → 200 z obstoječim
//      paymentId (SKB pravilo), brez dupliciranega audit loga.
//   C1 (HIGH, TOCTOU double-close) PUT /api/cash-register/[id]: status check
//      znotraj transakcije NE ščiti pod READ COMMITTED — nepogojen
//      update({ where: { id } }) je dovolil drugemu close-u, da je prepišal
//      Z-report agregate + dupliciral postShiftCloseActions (audit + webhooki
//      + Z-osnutek ×2). FIX: pogojni updateMany (where status: 'open') →
//      count 0 → SHIFT_ALREADY_CLOSED (R100 atomic CAS vzorec).
//   C2 (MEDIUM, TOCTOU double-open) POST /api/cash-register (openShift):
//      findFirst(open)-then-create pod READ COMMITTED → dve odprti izmeni na
//      isti lokaciji. FIX: Serializable izolacija + P2034 → 409.
//
// Pokritje: A qr-pay confirm (lock/izolacija/remaining/idempotency/race-path/
// fs-pini) · B cash-register close CAS · C openShift Serializable.
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Prisma } from '@prisma/client'

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'
const CHECK_1 = 'check-r104-1'

// --- Mocki (vi.hoisted) ---
const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  requireAuth: vi.fn(),
  // db-level
  transaction: vi.fn(),
  dbPaymentFindUnique: vi.fn(),
  auditLogCreate: vi.fn(),
  emitEvent: vi.fn(),
  // tx-level (qr-pay confirm)
  txExecuteRaw: vi.fn(),
  txPaymentFindUnique: vi.fn(),
  txPaymentAggregate: vi.fn(),
  txPaymentCreate: vi.fn(),
  txCheckFindUnique: vi.fn(),
  txCheckUpdate: vi.fn(),
  txCheckFindMany: vi.fn(),
  txOrderUpdate: vi.fn(),
  txOrderFindUnique: vi.fn(),
  updateCheckAndOrderStatus: vi.fn(),
  // tx-level (cash-register close)
  shiftFindUnique: vi.fn(),
  shiftUpdateMany: vi.fn(),
  orderCount: vi.fn(),
  orderFindMany: vi.fn(),
  postShiftCloseActions: vi.fn(),
  // tx-level (cash-register open)
  employeeFindUnique: vi.fn(),
  shiftFindFirst: vi.fn(),
  shiftCreate: vi.fn(),
}))

// Privzeti tx klient — rute kličejo $transaction(fn, options)
const txClient = {
  $executeRaw: mocks.txExecuteRaw,
  check: { findUnique: mocks.txCheckFindUnique, update: mocks.txCheckUpdate, findMany: mocks.txCheckFindMany },
  payment: {
    findUnique: mocks.txPaymentFindUnique,
    aggregate: mocks.txPaymentAggregate,
    create: mocks.txPaymentCreate,
    findMany: vi.fn().mockResolvedValue([]),
  },
  order: { update: mocks.txOrderUpdate, findUnique: mocks.txOrderFindUnique, count: mocks.orderCount, findMany: mocks.orderFindMany },
  cashRegisterShift: { findUnique: mocks.shiftFindUnique, updateMany: mocks.shiftUpdateMany, findFirst: mocks.shiftFindFirst, create: mocks.shiftCreate },
  employee: { findUnique: mocks.employeeFindUnique },
}

function defaultTxImpl(fn: (tx: unknown) => Promise<unknown>) {
  return fn(txClient)
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mocks.transaction,
    payment: { findUnique: mocks.dbPaymentFindUnique },
    auditLog: { create: mocks.auditLogCreate },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/app/api/payments/_helpers/check-status', () => ({
  updateCheckAndOrderStatus: mocks.updateCheckAndOrderStatus,
}))

vi.mock('@/app/api/cash-register/[id]/_helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/api/cash-register/[id]/_helpers')>()
  return { ...actual, postShiftCloseActions: mocks.postShiftCloseActions }
})

vi.mock('@/app/api/z-report/_helpers', () => ({
  upsertZReportForDay: vi.fn().mockResolvedValue({ report: { id: 'z-1' } }),
}))

vi.mock('@/lib/event-emitter', () => ({ emitEvent: mocks.emitEvent }))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.rateLimit,
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: { maxRequests: 100, windowMs: 60000 },
  QR_PAY_LIMIT: { maxRequests: 10, windowMs: 60000 },
}))

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

vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})

import { POST as qrPayConfirm } from '@/app/api/qr-pay/confirm/route'
import { PUT as cashRegisterClosePUT } from '@/app/api/cash-register/[id]/route'
import { POST as cashRegisterOpenPOST } from '@/app/api/cash-register/route'
import { qrPayTokenFor } from '@/lib/qr-pay-token'

function confirmReq(overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost:3000/api/qr-pay/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      checkId: CHECK_1,
      paymentMethod: 'card',
      tipAmount: 1,
      sessionToken: qrPayTokenFor(CHECK_1),
      ...overrides,
    }),
  })
}

function closeReq(id = 'shift-1') {
  return cashRegisterClosePUT(
    new Request(`http://localhost:3000/api/cash-register/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes: 'R104' }),
    }),
    { params: Promise.resolve({ id }) }
  )
}

function openReq() {
  return new Request('http://localhost:3000/api/cash-register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ employeeId: 'emp-1', employeeName: 'R104', startingCash: 100 }),
  })
}

function mockSession(session: { role: string; locationId: string | null; employeeId?: string; permissions?: string[] }) {
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: session.employeeId ?? 'emp-1', ...session, permissions: session.permissions ?? [] },
    error: null,
  })
}

function makeCheck(overrides: Record<string, unknown> = {}) {
  return {
    id: CHECK_1,
    checkNumber: 1,
    paymentStatus: 'unpaid',
    total: 12.2,
    orderId: 'ord-1',
    order: { id: 'ord-1', locationId: LOC_A },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.rateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 1000 })
  mocks.transaction.mockImplementation(defaultTxImpl)
  mocks.txExecuteRaw.mockResolvedValue(undefined)
  mocks.txPaymentFindUnique.mockResolvedValue(null)
  mocks.txPaymentAggregate.mockResolvedValue({ _sum: { amount: null } })
  mocks.txPaymentCreate.mockResolvedValue({ id: 'pay-1' })
  mocks.txCheckFindUnique.mockResolvedValue(makeCheck())
  mocks.txCheckFindMany.mockResolvedValue([])
  mocks.updateCheckAndOrderStatus.mockResolvedValue(undefined)
  mocks.dbPaymentFindUnique.mockResolvedValue(null)
  mocks.auditLogCreate.mockResolvedValue({ id: 'al-1' })
  mocks.emitEvent.mockResolvedValue(undefined)
  mocks.shiftFindUnique.mockResolvedValue({
    id: 'shift-1', locationId: LOC_A, status: 'open', startingCash: 100, openedAt: new Date(), employeeName: 'R104',
  })
  mocks.shiftUpdateMany.mockResolvedValue({ count: 1 })
  mocks.orderCount.mockResolvedValue(0)
  mocks.orderFindMany.mockResolvedValue([])
  mocks.postShiftCloseActions.mockResolvedValue(undefined)
  mocks.employeeFindUnique.mockResolvedValue({ locationId: LOC_A })
  mocks.shiftFindFirst.mockResolvedValue(null)
  mocks.shiftCreate.mockResolvedValue({ id: 'shift-new', status: 'open', locationId: LOC_A })
})

// ══════════════════════════════════════════════════════════════════
// A. QR-PAY CONFIRM — advisory lock + Serializable + remaining + idempotency
// ══════════════════════════════════════════════════════════════════
describe('R104 A: POST /api/qr-pay/confirm — atomarnost & idempotency', () => {
  it('A1: svež unpaid ček → 201, advisory lock + Serializable + create točno enkrat', async () => {
    const token = qrPayTokenFor(CHECK_1) // fixa issuedAt — isti token v req + assertaciji
    const res = await qrPayConfirm(confirmReq({ sessionToken: token }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.paymentId).toBe('pay-1')
    // Advisory lock per ček (isti ključ tudi za različne tokene)
    expect(mocks.txExecuteRaw).toHaveBeenCalledTimes(1)
    // Serializable izolacija (2. argument $transaction)
    const txOptions = mocks.transaction.mock.calls[0][1]
    expect(txOptions.isolationLevel).toBe(Prisma.TransactionIsolationLevel.Serializable)
    // Amount = blagovni preostanek (12.2), tip ločeno (1) — NE 12.2+1 v amount
    expect(mocks.txPaymentCreate.mock.calls[0][0].data.amount).toBe(12.2)
    expect(mocks.txPaymentCreate.mock.calls[0][0].data.tipAmount).toBe(1)
    expect(mocks.txPaymentCreate.mock.calls[0][0].data.idempotencyKey).toBe(`qrpay-${token}-${CHECK_1}`)
    // Status helper poklican znotraj tx (isti kanon kot staff pot)
    expect(mocks.updateCheckAndOrderStatus).toHaveBeenCalledTimes(1)
  })

  it('A2: plačan ček (tx-fresh prebereta paid) → 400, create NI klican (Q1)', async () => {
    mocks.txCheckFindUnique.mockResolvedValue(makeCheck({ paymentStatus: 'paid' }))
    const res = await qrPayConfirm(confirmReq())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('že plačan')
    expect(mocks.txPaymentCreate).not.toHaveBeenCalled()
  })

  it('A3: delno plačan ček (paidSoFar 5 od 12.2) → amount = preostanek 7.2, NE 12.2 (Q2 over-collection)', async () => {
    mocks.txPaymentAggregate.mockResolvedValue({ _sum: { amount: 5 } })
    const res = await qrPayConfirm(confirmReq())
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.amount).toBe(7.2)
    expect(body.tipAmount).toBe(1)
    expect(mocks.txPaymentCreate.mock.calls[0][0].data.amount).toBe(7.2)
  })

  it('A4: paidSoFar >= total (partial ček, preostanek 0) → 400 že plačan, create NI klican (Q2)', async () => {
    mocks.txCheckFindUnique.mockResolvedValue(makeCheck({ paymentStatus: 'partial' }))
    mocks.txPaymentAggregate.mockResolvedValue({ _sum: { amount: 12.2 } })
    const res = await qrPayConfirm(confirmReq())

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('že plačan')
    expect(mocks.txPaymentCreate).not.toHaveBeenCalled()
  })

  it('A5: isti-token replay (idempotencyKey obstaja) → 200 obstoječe plačilo, create + audit NE (Q3)', async () => {
    mocks.txPaymentFindUnique.mockResolvedValue({ id: 'pay-0', amount: 12.2, tipAmount: 1 })
    const res = await qrPayConfirm(confirmReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.paymentId).toBe('pay-0')
    expect(body.message).toContain('že obdelano')
    expect(mocks.txPaymentCreate).not.toHaveBeenCalled()
    // Replay ne proži duplicirane revizije
    expect(mocks.auditLogCreate).not.toHaveBeenCalled()
  })

  it('A6: P2002 race-path (defense-in-depth) → 200 z obstoječim plačilom, NIKOLI 500 (Q1)', async () => {
    mocks.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
    )
    mocks.dbPaymentFindUnique.mockResolvedValue({ id: 'pay-winner', amount: 12.2, tipAmount: 1 })
    const res = await qrPayConfirm(confirmReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.paymentId).toBe('pay-winner')
    expect(mocks.dbPaymentFindUnique.mock.calls[0][0].where.idempotencyKey).toContain('qrpay-')
  })

  it('A7: P2034 serialization conflict → 409 retry, NIKOLI 500', async () => {
    mocks.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Write conflict', { code: 'P2034', clientVersion: 'test' })
    )
    const res = await qrPayConfirm(confirmReq())

    expect(res.status).toBe(409)
  })

  it('A8: audit log točno enkrat za novo plačilo, locationId iz check.order', async () => {
    await qrPayConfirm(confirmReq())
    expect(mocks.auditLogCreate).toHaveBeenCalledTimes(1)
    expect(mocks.auditLogCreate.mock.calls[0][0].data.action).toBe('QR_PAY_PAYMENT')
    expect(mocks.auditLogCreate.mock.calls[0][0].data.locationId).toBe(LOC_A)
  })

  it('A9: manjkajoč ček → 404 (strukturirani throw, ne 500)', async () => {
    mocks.txCheckFindUnique.mockResolvedValue(null)
    const res = await qrPayConfirm(confirmReq())

    expect(res.status).toBe(404)
    expect(mocks.txPaymentCreate).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// B. CASH-REGISTER CLOSE — CAS updateMany (where status: 'open')
// ══════════════════════════════════════════════════════════════════
describe('R104 B: PUT /api/cash-register/[id] — CAS double-close vrata', () => {
  it('B1: CAS kontrakt — updateMany where { id, status: open }, count 1 → 200 + postClose točno enkrat (C1)', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })
    mocks.shiftFindUnique
      .mockResolvedValueOnce({ id: 'shift-1', locationId: LOC_A, status: 'open', startingCash: 100, openedAt: new Date(), employeeName: 'R104' })
      .mockResolvedValueOnce({ id: 'shift-1', locationId: LOC_A, status: 'closed', startingCash: 100, expectedCash: 100, closingCash: 100, totalSales: 0, cashSales: 0, cardSales: 0, cashDifference: 0, totalOrders: 0, closedAt: new Date(), employeeName: 'R104' })

    const res = await closeReq()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('closed')
    expect(mocks.shiftUpdateMany).toHaveBeenCalledTimes(1)
    expect(mocks.shiftUpdateMany.mock.calls[0][0].where).toEqual({ id: 'shift-1', status: 'open' })
    expect(mocks.shiftUpdateMany.mock.calls[0][0].data.status).toBe('closed')
    // postShiftCloseActions (audit + webhooki + Z-osnutek) točno ENKRAT
    expect(mocks.postShiftCloseActions).toHaveBeenCalledTimes(1)
  })

  it('B2: CAS count 0 (konkurenčni close je že zmagal) → 400 že zaprta, postClose NE (C1)', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })
    mocks.shiftUpdateMany.mockResolvedValue({ count: 0 })

    const res = await closeReq()
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('že zaprta')
    expect(mocks.postShiftCloseActions).not.toHaveBeenCalled()
  })

  it('B3: že zaprta izmena (tx-fresh fast-fail) → 400, updateMany NE (pin obstoječega)', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })
    mocks.shiftFindUnique.mockResolvedValue({ id: 'shift-1', locationId: LOC_A, status: 'closed', startingCash: 100, openedAt: new Date() })

    const res = await closeReq()

    expect(res.status).toBe(400)
    expect(mocks.shiftUpdateMany).not.toHaveBeenCalled()
    expect(mocks.postShiftCloseActions).not.toHaveBeenCalled()
  })

  it('B4: tuja izmena → 404, CAS NE (scope pin iz R86 ostaja)', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })
    mocks.shiftFindUnique.mockResolvedValue({ id: 'shift-1', locationId: LOC_B, status: 'open', startingCash: 100, openedAt: new Date() })

    const res = await closeReq()

    expect(res.status).toBe(404)
    expect(mocks.shiftUpdateMany).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// C. CASH-REGISTER OPEN — Serializable double-open vrata
// ══════════════════════════════════════════════════════════════════
describe('R104 C: POST /api/cash-register — openShift Serializable', () => {
  it('C1: openShift transakcija teče pod Serializable izolacijo (C2)', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })

    const res = await cashRegisterOpenPOST(openReq())

    expect(res.status).toBe(200)
    const txOptions = mocks.transaction.mock.calls[0][1]
    expect(txOptions.isolationLevel).toBe(Prisma.TransactionIsolationLevel.Serializable)
    expect(mocks.shiftCreate).toHaveBeenCalledTimes(1)
  })

  it('C2: ALREADY_OPEN pin — obstoječa odprta izmena → 400, create NI (obstoječi kontrakt)', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })
    mocks.shiftFindFirst.mockResolvedValue({ id: 'shift-open', status: 'open', locationId: LOC_A })

    const res = await cashRegisterOpenPOST(openReq())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Že obstaja odprta izmena')
    expect(mocks.shiftCreate).not.toHaveBeenCalled()
  })

  it('C3: P2034 serialization conflict (dva sočasna open-a) → 409, NIKOLI 500 (C2)', async () => {
    mockSession({ role: 'manager', locationId: LOC_A })
    mocks.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Write conflict', { code: 'P2034', clientVersion: 'test' })
    )

    const res = await cashRegisterOpenPOST(openReq())

    expect(res.status).toBe(409)
  })
})

// ══════════════════════════════════════════════════════════════════
// D. FS-GUARDI — vir pini (R103 G vzorec: testi ne blagoslavijo brez vira)
// ══════════════════════════════════════════════════════════════════
describe('R104 D: fs-guardi — vir pini', () => {
  const repoRoot = process.cwd()
  const confirmSrc = readFileSync(join(repoRoot, 'src/app/api/qr-pay/confirm/route.ts'), 'utf8')
  const closeSrc = readFileSync(join(repoRoot, 'src/app/api/cash-register/[id]/route.ts'), 'utf8')
  const openHelpersSrc = readFileSync(join(repoRoot, 'src/app/api/cash-register/_helpers.ts'), 'utf8')
  const openRouteSrc = readFileSync(join(repoRoot, 'src/app/api/cash-register/route.ts'), 'utf8')

  it('confirm: advisory lock + Serializable + structured error + ohranjen rate-limit ključ (r94 pin)', () => {
    expect(confirmSrc).toContain('pg_advisory_xact_lock(hashtext(')
    expect(confirmSrc).toContain('Prisma.TransactionIsolationLevel.Serializable')
    expect(confirmSrc).toContain('structuredErrorResponse')
    // idempotencyKey je vezan na token + check (replay kontrakt)
    expect(confirmSrc).toContain('qrpay-${data.sessionToken}-${data.checkId}')
    // paidSoFar — over-collection vrata
    expect(confirmSrc).toContain('_sum: { amount: true }')
    // R94 rate-limit kontrakt (kvantiteta točno 1)
    expect(confirmSrc.split("checkRateLimitAsync('qr-pay-confirm'").length - 1).toBe(1)
  })

  it('close: NI več nepogojenega cashRegisterShift.update (double-close vrata zaprta)', () => {
    expect(closeSrc).not.toMatch(/cashRegisterShift\.update\(\{/)
    expect(closeSrc).toContain("where: { id, status: 'open' }")
    expect(closeSrc).toContain('SHIFT_ALREADY_CLOSED')
  })

  it('open: Serializable izolacija v openShift + P2034 → 409 v ruti', () => {
    expect(openHelpersSrc).toContain('Prisma.TransactionIsolationLevel.Serializable')
    expect(openRouteSrc).toContain("code === 'P2034'")
  })
})
