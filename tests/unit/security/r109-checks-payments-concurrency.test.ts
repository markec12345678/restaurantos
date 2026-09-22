// ============================================
// R109 — ČEKOVNI PISALNI KANON (checks PUT/DELETE)
//        + VOID RECALC KANON (order-items)
//        + PLAČILNI MUTACIJSKI LOCK PARITETA (PUT refund/void ↔ POST refund)
//        — CONCURRENCY & ERROR KONTRAKT (TOCTOU razred R100–R108)
// ============================================
//
// Forenzika (bug-hunt val: "checks recalc + payments void/refund race" —
// glej checks/[id]/_helpers.ts / recalculate-totals.ts / payments/[id]/
// _helpers.ts R109 headerje):
//
//   PAY-1 (HIGH, PUT /api/payments/[id] ↔ POST /api/payments/[id]/refund):
//     RAZLIČNA advisory lock ključa na ISTI vrstici plačila
//     ('payment-void:'+id vs raw id) → cross-path dvojno povračilo
//     (oba reversal-a, refundAmount > amount).
//   CK-1 (HIGH, PUT /api/checks/[id]): existingCheck IZVEN tx → totals iz
//     STALE subtotal/tax (lost update), stale appliedDiscountId primerjava
//     (dvojen decrement currentUses), brez izolacije/ključavnice.
//   CK-2 (HIGH, DELETE /api/checks/[id]): 4 NETRANSAKCIJSKE mutacije + stale
//     check-then-act na plačilih → sočasno plačilo = P2003 (FK Restrict)
//     → 500 PO delnih mutacijah.
//   CK-3 (MEDIUM, PUT /api/order-items/[id] void): recalc order+check totals
//     = dva stale db-client read-modify-write brez tx/locka + stale
//     paymentStatus guard → void na plačanem čeku.
//   CK-4 (MEDIUM, PUT /api/checks/[id]): paymentStatus client-writable
//     ('paid' brez plačila = revenue oracle; 'storno' = FURS bypass).
//
// Pokritje: A lock unifikacija · B updateCheckWithLock kanon ·
// C deleteCheckWithLock kanon · D route kontrakt (checks PUT/DELETE +
// order-items void) · E plačilni error kontrakt (refund/PUT structured) ·
// F fs-pini (vir pini).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Prisma } from '@prisma/client'

const LOC_A = 'loc-tenant-a'
const CHK = 'chk-1'
const ORD = 'ord-1'
const PAY = 'pay-1'

// --- Mocki (vi.hoisted) ---
const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  transaction: vi.fn(),
  txExecuteRaw: vi.fn(),
  // tx-level — skupni tx klient za checks kanon + recalc kanon + refund/PUT payments
  txCheckFindFirst: vi.fn(),
  txCheckUpdate: vi.fn(),
  txCheckDeleteMany: vi.fn(),
  txCheckFindMany: vi.fn(),
  txAuditLogCreate: vi.fn(),
  txPaymentDeleteMany: vi.fn(),
  txDiscountFindUnique: vi.fn(),
  txDiscountUpdate: vi.fn(),
  txDiscountUpdateMany: vi.fn(),
  txOrderItemFindMany: vi.fn(),
  txOrderItemUpdateMany: vi.fn(),
  txOrderFindUnique: vi.fn(),
  txOrderUpdate: vi.fn(),
  txPaymentFindUnique: vi.fn(),
  txPaymentUpdate: vi.fn(),
  txPaymentUpdateMany: vi.fn(),
  txPaymentAggregate: vi.fn(),
  // db-level (fast-path + order-items route)
  dbCheckFindFirst: vi.fn(),
  dbCheckFindUnique: vi.fn(),
  dbPaymentFindFirst: vi.fn(),
  dbOrderItemFindFirst: vi.fn(),
  dbOrderItemFindUnique: vi.fn(),
  dbOrderItemUpdateMany: vi.fn(),
}))

// Privzeti tx klient — kanon kliče db.$transaction(fn, options)
const txClient = {
  $executeRaw: mocks.txExecuteRaw,
  check: {
    findFirst: mocks.txCheckFindFirst,
    update: mocks.txCheckUpdate,
    deleteMany: mocks.txCheckDeleteMany,
    findMany: mocks.txCheckFindMany,
    findUnique: mocks.dbCheckFindUnique,
  },
  discount: {
    findUnique: mocks.txDiscountFindUnique,
    update: mocks.txDiscountUpdate,
    updateMany: mocks.txDiscountUpdateMany,
  },
  orderItem: {
    findMany: mocks.txOrderItemFindMany,
    updateMany: mocks.txOrderItemUpdateMany,
  },
  order: {
    findUnique: mocks.txOrderFindUnique,
    update: mocks.txOrderUpdate,
  },
  payment: {
    findUnique: mocks.txPaymentFindUnique,
    update: mocks.txPaymentUpdate,
    updateMany: mocks.txPaymentUpdateMany,
    aggregate: mocks.txPaymentAggregate,
    deleteMany: mocks.txPaymentDeleteMany,
  },
  auditLog: { create: mocks.txAuditLogCreate },
}

function defaultTxImpl(fn: (tx: unknown) => Promise<unknown>) {
  return fn(txClient)
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mocks.transaction,
    check: { findFirst: mocks.dbCheckFindFirst, findUnique: mocks.dbCheckFindUnique },
    payment: { findFirst: mocks.dbPaymentFindFirst },
    orderItem: {
      findFirst: mocks.dbOrderItemFindFirst,
      findUnique: mocks.dbOrderItemFindUnique,
      updateMany: mocks.dbOrderItemUpdateMany,
    },
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

vi.mock('@/lib/ws-server-broadcast', () => ({
  wsBroadcastEvent: vi.fn(),
}))

vi.mock('@/lib/stock-deduction', () => ({
  broadcastLowStockAlert: vi.fn(),
  deductStockForAddedItems: vi.fn(),
}))

vi.mock('@/lib/accounting/journal-generator', () => ({
  generateJournalForRefund: vi.fn(),
}))

vi.mock('@/lib/logger', async (importOriginal) => {
  // api-utils/errors.ts tudi importira generateRequestId iz '@/lib/logger'
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }
})

// --- Helperji ---
function session(locationId: string | null = LOC_A, role = 'staff') {
  return {
    session: {
      token: 'tok',
      employeeId: 'emp-1',
      role,
      permissions: ['take_orders', 'void_items'],
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      absoluteExpiry: Date.now() + 86400000,
      locationId,
    },
    error: null,
  }
}

function makeReq(url: string, method = 'PUT', body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// Standarden tx-fresh ček (unpaid, subtotal 200)
function freshCheck(overrides: Record<string, unknown> = {}) {
  return {
    id: CHK,
    subtotal: 200,
    tax: 44,
    serviceCharge: 0,
    tip: 0,
    discount: 0,
    total: 244,
    totalWithTip: 244,
    paymentStatus: 'unpaid',
    appliedDiscountId: null,
    order: { locationId: LOC_A },
    orderItems: [],
    payments: [],
    ...overrides,
  }
}

function freshPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: PAY,
    checkId: CHK,
    status: 'completed',
    type: 'cash',
    amount: 100,
    refundAmount: 0,
    tipAmount: 0,
    loyaltyPointsUsed: 0,
    giftCardId: null,
    loyaltyAccountId: null,
    check: { order: { locationId: LOC_A } },
    giftCard: null,
    loyaltyAccount: null,
    ...overrides,
  }
}

const VALID_DISCOUNT = {
  id: 'disc-a',
  locationId: LOC_A,
  isActive: true,
  type: 'percentage',
  amount: 10,
  validFrom: null,
  validTo: null,
  maxUses: null,
  currentUses: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue(session())
  mocks.transaction.mockImplementation(defaultTxImpl)
  mocks.txExecuteRaw.mockResolvedValue(undefined)
  mocks.txCheckUpdate.mockResolvedValue({ id: CHK })
  mocks.txCheckDeleteMany.mockResolvedValue({ count: 1 })
  mocks.txCheckFindMany.mockResolvedValue([{ paymentStatus: 'partial' }])
  mocks.txAuditLogCreate.mockResolvedValue({ id: 'audit-1' })
  mocks.txPaymentDeleteMany.mockResolvedValue({ count: 0 })
  mocks.txDiscountUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txOrderItemUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txOrderUpdate.mockResolvedValue({})
  mocks.txPaymentUpdateMany.mockResolvedValue({ count: 1 })
  mocks.dbCheckFindFirst.mockResolvedValue({ id: CHK })
  mocks.dbCheckFindUnique.mockResolvedValue(null)
  mocks.dbOrderItemUpdateMany.mockResolvedValue({ count: 1 })
})

// ════════════════════════════════════════════════════════════════
// A. LOCK UNIFIKACIJA (PAY-1)
// ════════════════════════════════════════════════════════════════
describe('R109 A: plačilni mutacijski lock ključi — unifikacija', () => {
  it('A1: paymentMutationLockKey = payment-mutate:<id> (isti ključ za PUT in /refund)', async () => {
    const { paymentMutationLockKey } = await import('@/app/api/payments/[id]/_helpers')
    expect(paymentMutationLockKey(PAY)).toBe('payment-mutate:' + PAY)
  })

  it('A2: paymentCheckLockKey = RAW checkId (pariteta create-payment/qr-pay)', async () => {
    const { paymentCheckLockKey } = await import('@/app/api/payments/[id]/_helpers')
    expect(paymentCheckLockKey(CHK)).toBe(CHK)
  })

  it('A3: checkWriteLockKey = RAW checkId (isti ključ kot create-payment/qr-pay)', async () => {
    const { checkWriteLockKey } = await import('@/app/api/checks/[id]/_helpers')
    expect(checkWriteLockKey(CHK)).toBe(CHK)
  })

  it('A4: refund route — ključa prisotna, star raw ključ izginjen', async () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/payments/[id]/refund/route.ts'), 'utf8')
    expect(src).toContain('paymentMutationLockKey(id)')
    expect(src).toContain('paymentCheckLockKey(')
    expect(src).not.toContain('pg_advisory_xact_lock(hashtext(${id}))') // star raw ključ
  })

  it('A5: PUT payments route — star "payment-void:" ključ izginjen', async () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/payments/[id]/route.ts'), 'utf8')
    expect(src).toContain('paymentMutationLockKey(id)')
    expect(src).toContain('paymentCheckLockKey(')
    // funkcijska raba starega ključa izginjena (komentar forenzike sme ostati)
    expect(src).not.toContain("pg_advisory_xact_lock(hashtext(${" + "'payment-void:'")
  })
})

// ════════════════════════════════════════════════════════════════
// B. UPDATE CHECK KANON (updateCheckWithLock)
// ════════════════════════════════════════════════════════════════
describe('R109 B: updateCheckWithLock — lock + Serializable + tx-fresh', () => {
  it('B1: Serializable izolacija + advisory lock na raw checkId', async () => {
    const { updateCheckWithLock } = await import('@/app/api/checks/[id]/_helpers')
    mocks.txCheckFindFirst.mockResolvedValue(freshCheck())

    await updateCheckWithLock({ checkId: CHK, sessionLocationId: LOC_A, paymentMethod: 'cash' })

    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    const options = mocks.transaction.mock.calls[0][1]
    expect(options).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 })
    expect(mocks.txExecuteRaw.mock.calls[0][1]).toBe(CHK)
  })

  it('B2: tx-fresh scoped re-read — order.locationId v where', async () => {
    const { updateCheckWithLock } = await import('@/app/api/checks/[id]/_helpers')
    mocks.txCheckFindFirst.mockResolvedValue(freshCheck())

    await updateCheckWithLock({ checkId: CHK, sessionLocationId: LOC_A, paymentMethod: 'cash' })

    const where = mocks.txCheckFindFirst.mock.calls[0][0].where
    expect(where.id).toBe(CHK)
    expect(where.order).toEqual({ locationId: LOC_A })
  })

  it('B3: super-admin (null scope) → brez order ključa (nikoli { order: { locationId: null } })', async () => {
    const { updateCheckWithLock } = await import('@/app/api/checks/[id]/_helpers')
    mocks.txCheckFindFirst.mockResolvedValue(freshCheck())

    await updateCheckWithLock({ checkId: CHK, sessionLocationId: null, paymentMethod: 'cash' })

    const where = mocks.txCheckFindFirst.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'order')).toBe(false)
  })

  it('B4 (CK-1): ček izven scope-a → strukturirana 404 (nikoli 500)', async () => {
    const { updateCheckWithLock } = await import('@/app/api/checks/[id]/_helpers')
    mocks.txCheckFindFirst.mockResolvedValue(null)

    await expect(
      updateCheckWithLock({ checkId: CHK, sessionLocationId: LOC_A, paymentMethod: 'cash' }),
    ).rejects.toMatchObject({ error: 'Ček ni najden', status: 404 })
  })

  it('B5 (CK-1): totals iz TX-FRESH čeka — popust 10 % od svežega subtotal 200 (ne stale 100)', async () => {
    const { updateCheckWithLock } = await import('@/app/api/checks/[id]/_helpers')
    // stale outer stanje bi imelo subtotal 100; fresh ima 200 (sočasen add-items/void recalc)
    mocks.txCheckFindFirst.mockResolvedValue(freshCheck({ subtotal: 200, tax: 44 }))
    mocks.txDiscountFindUnique.mockResolvedValue(VALID_DISCOUNT)

    await updateCheckWithLock({ checkId: CHK, sessionLocationId: LOC_A, appliedDiscountId: 'disc-a' })

    expect(mocks.txDiscountFindUnique).toHaveBeenCalledWith({ where: { id: 'disc-a' } })
    const data = mocks.txCheckUpdate.mock.calls[0][0].data
    // 10 % od 200 = 20 (stale read bi dal 10 — lost update na DDV osnovi)
    expect(data.discount).toBe(20)
    expect(data.tax).toBeCloseTo(39.6, 2)
    expect(data.total).toBeCloseTo(219.6, 2)
  })

  it('B6 (CK-1): swap popusta — decrement SVEŽEGA appliedDiscountId (ne stale)', async () => {
    const { updateCheckWithLock } = await import('@/app/api/checks/[id]/_helpers')
    mocks.txCheckFindFirst.mockResolvedValue(freshCheck({ appliedDiscountId: 'disc-old' }))
    mocks.txDiscountFindUnique.mockResolvedValue({ ...VALID_DISCOUNT, id: 'disc-new' })

    await updateCheckWithLock({ checkId: CHK, sessionLocationId: LOC_A, appliedDiscountId: 'disc-new' })

    expect(mocks.txDiscountUpdateMany).toHaveBeenCalledWith({
      where: { id: 'disc-old', currentUses: { gt: 0 } },
      data: { currentUses: { decrement: 1 } },
    })
  })

  it('B7: maxUses quota race — pogojni increment count 0 → strukturirana 409', async () => {
    const { updateCheckWithLock } = await import('@/app/api/checks/[id]/_helpers')
    mocks.txCheckFindFirst.mockResolvedValue(freshCheck())
    // validacija prestala (currentUses 4 < maxUses 5), increment pa zgubil race
    mocks.txDiscountFindUnique.mockResolvedValue({ ...VALID_DISCOUNT, maxUses: 5, currentUses: 4 })
    mocks.txDiscountUpdateMany.mockResolvedValue({ count: 0 })

    await expect(
      updateCheckWithLock({ checkId: CHK, sessionLocationId: LOC_A, appliedDiscountId: 'disc-a' }),
    ).rejects.toMatchObject({ error: 'Popust je že bil uporabljen največkrat', status: 409 })
    expect(mocks.txCheckUpdate).not.toHaveBeenCalled()
  })

  it('B8: odstranitev popusta — totals brez popusta iz svežega čeka', async () => {
    const { updateCheckWithLock } = await import('@/app/api/checks/[id]/_helpers')
    mocks.txCheckFindFirst.mockResolvedValue(
      freshCheck({ appliedDiscountId: 'disc-old', serviceCharge: 5, tip: 3 }),
    )

    await updateCheckWithLock({ checkId: CHK, sessionLocationId: LOC_A, appliedDiscountId: null })

    expect(mocks.txDiscountUpdateMany).toHaveBeenCalledWith({
      where: { id: 'disc-old', currentUses: { gt: 0 } },
      data: { currentUses: { decrement: 1 } },
    })
    const data = mocks.txCheckUpdate.mock.calls[0][0].data
    expect(data.appliedDiscountId).toBeNull()
    expect(data.discount).toBe(0)
    expect(data.total).toBe(249) // 200 + 44 + 5
    expect(data.totalWithTip).toBe(252) // + tip 3
  })

  it('B9: brez discount spremembe → NI discount klicev, paymentMethod zapisan', async () => {
    const { updateCheckWithLock } = await import('@/app/api/checks/[id]/_helpers')
    mocks.txCheckFindFirst.mockResolvedValue(freshCheck())

    await updateCheckWithLock({ checkId: CHK, sessionLocationId: LOC_A, paymentMethod: 'card' })

    expect(mocks.txDiscountFindUnique).not.toHaveBeenCalled()
    expect(mocks.txDiscountUpdateMany).not.toHaveBeenCalled()
    expect(mocks.txCheckUpdate.mock.calls[0][0].data).toEqual({ paymentMethod: 'card' })
  })
})

// ════════════════════════════════════════════════════════════════
// C. DELETE CHECK KANON (deleteCheckWithLock)
// ════════════════════════════════════════════════════════════════
describe('R109 C: deleteCheckWithLock — atomarni izbris', () => {
  it('C1: Serializable + lock + tx-fresh re-read s plačili', async () => {
    const { deleteCheckWithLock } = await import('@/app/api/checks/[id]/_helpers')
    mocks.txCheckFindFirst.mockResolvedValue(freshCheck())

    await deleteCheckWithLock({ checkId: CHK, sessionLocationId: LOC_A })

    const options = mocks.transaction.mock.calls[0][1]
    expect(options).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 })
    expect(mocks.txExecuteRaw.mock.calls[0][1]).toBe(CHK)
    expect(mocks.txCheckFindFirst.mock.calls[0][0].include).toEqual({ payments: true })
    expect(mocks.txCheckFindFirst.mock.calls[0][0].where.order).toEqual({ locationId: LOC_A })
  })

  it('C2 (CK-2): completed plačilo (tx-fresh) → 400, NI mutacij (prej P2003 → 500 po delnih mutacijah)', async () => {
    const { deleteCheckWithLock } = await import('@/app/api/checks/[id]/_helpers')
    mocks.txCheckFindFirst.mockResolvedValue(freshCheck({ payments: [{ status: 'completed' }] }))

    await expect(
      deleteCheckWithLock({ checkId: CHK, sessionLocationId: LOC_A }),
    ).rejects.toMatchObject({ status: 400 })

    expect(mocks.txDiscountUpdateMany).not.toHaveBeenCalled()
    expect(mocks.txOrderItemUpdateMany).not.toHaveBeenCalled()
    expect(mocks.txCheckDeleteMany).not.toHaveBeenCalled()
  })

  it('C3: happy path — vsi koraki V tx (discount gt 0, detach, deleteMany, check deleteMany)', async () => {
    const { deleteCheckWithLock } = await import('@/app/api/checks/[id]/_helpers')
    mocks.txCheckFindFirst.mockResolvedValue(
      freshCheck({ appliedDiscountId: 'disc-old', payments: [{ status: 'pending' }] }),
    )

    const result = await deleteCheckWithLock({ checkId: CHK, sessionLocationId: LOC_A })

    expect(result).toEqual({ success: true, message: 'Ček izbrisan' })
    expect(mocks.txDiscountUpdateMany).toHaveBeenCalledWith({
      where: { id: 'disc-old', currentUses: { gt: 0 } },
      data: { currentUses: { decrement: 1 } },
    })
    expect(mocks.txOrderItemUpdateMany).toHaveBeenCalledWith({
      where: { checkId: CHK },
      data: { checkId: null },
    })
    expect(mocks.txCheckDeleteMany).toHaveBeenCalledWith({ where: { id: CHK } })
  })

  it('C4: ček izven scope-a (tx-fresh) → strukturirana 404', async () => {
    const { deleteCheckWithLock } = await import('@/app/api/checks/[id]/_helpers')
    mocks.txCheckFindFirst.mockResolvedValue(null)

    await expect(
      deleteCheckWithLock({ checkId: CHK, sessionLocationId: LOC_A }),
    ).rejects.toMatchObject({ error: 'Ček ni najden', status: 404 })
  })

  it('C5: check deleteMany count 0 (deleted medtem pod lockom) → 404', async () => {
    const { deleteCheckWithLock } = await import('@/app/api/checks/[id]/_helpers')
    mocks.txCheckFindFirst.mockResolvedValue(freshCheck())
    mocks.txCheckDeleteMany.mockResolvedValue({ count: 0 })

    await expect(
      deleteCheckWithLock({ checkId: CHK, sessionLocationId: LOC_A }),
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ════════════════════════════════════════════════════════════════
// D. ROUTE KONTRAKT (checks PUT/DELETE + order-items void)
// ════════════════════════════════════════════════════════════════
describe('R109 D: route kontrakt', () => {
  it('D1 (CK-4): PUT z paymentStatus → 400 (strežniško derivirano stanje)', async () => {
    const { PUT } = await import('@/app/api/checks/[id]/route')
    mocks.dbCheckFindFirst.mockResolvedValue({ id: CHK })

    const res = await PUT(
      makeReq(`http://localhost/api/checks/${CHK}`, 'PUT', { paymentStatus: 'paid' }),
      { params: Promise.resolve({ id: CHK }) },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('strežniško deriviran')
    // guard PO fast-path 404 → tx ni klican
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('D2: PUT — ček izven scope-a → 404 (fast-path ostaja, guard 400 ne preglasi)', async () => {
    const { PUT } = await import('@/app/api/checks/[id]/route')
    mocks.dbCheckFindFirst.mockResolvedValue(null)

    const res = await PUT(
      makeReq(`http://localhost/api/checks/${CHK}`, 'PUT', { paymentStatus: 'paid' }),
      { params: Promise.resolve({ id: CHK }) },
    )
    expect(res.status).toBe(404)
    expect(mocks.dbCheckFindFirst.mock.calls[0][0].where.order).toEqual({ locationId: LOC_A })
  })

  it('D3: PUT — veljaven tok skozi kanon (tx-fresh read + update)', async () => {
    const { PUT } = await import('@/app/api/checks/[id]/route')
    mocks.dbCheckFindFirst.mockResolvedValue({ id: CHK })
    mocks.txCheckFindFirst.mockResolvedValue(freshCheck())
    mocks.txDiscountFindUnique.mockResolvedValue(VALID_DISCOUNT)

    const res = await PUT(
      makeReq(`http://localhost/api/checks/${CHK}`, 'PUT', { appliedDiscountId: 'disc-a' }),
      { params: Promise.resolve({ id: CHK }) },
    )
    expect(res.status).toBe(200)
    expect(mocks.txCheckUpdate).toHaveBeenCalled()
    expect(mocks.txExecuteRaw).toHaveBeenCalled() // advisory lock pod kanonom
  })

  it('D4: PUT — P2034 (sočasna modifikacija) → 409, nikoli 500', async () => {
    const { PUT } = await import('@/app/api/checks/[id]/route')
    mocks.dbCheckFindFirst.mockResolvedValue({ id: CHK })
    const p2034 = new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' })
    mocks.transaction.mockRejectedValueOnce(p2034)

    const res = await PUT(
      makeReq(`http://localhost/api/checks/${CHK}`, 'PUT', { paymentMethod: 'cash' }),
      { params: Promise.resolve({ id: CHK }) },
    )
    expect(res.status).toBe(409)
  })

  it('D5: DELETE — ček izven scope-a → 404 fast-path', async () => {
    const { DELETE } = await import('@/app/api/checks/[id]/route')
    mocks.dbCheckFindFirst.mockResolvedValue(null)

    const res = await DELETE(
      makeReq(`http://localhost/api/checks/${CHK}`, 'DELETE'),
      { params: Promise.resolve({ id: CHK }) },
    )
    expect(res.status).toBe(404)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('D6: DELETE — completed plačilo v tx → 400 (kanon), ne 500', async () => {
    const { DELETE } = await import('@/app/api/checks/[id]/route')
    mocks.dbCheckFindFirst.mockResolvedValue({ id: CHK })
    mocks.txCheckFindFirst.mockResolvedValue(freshCheck({ payments: [{ status: 'completed' }] }))

    const res = await DELETE(
      makeReq(`http://localhost/api/checks/${CHK}`, 'DELETE'),
      { params: Promise.resolve({ id: CHK }) },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('storno')
  })

  it('D7 (CK-3): order-items void — svež guard: plačan ček → 409 (prej stale read + 500)', async () => {
    const { PUT } = await import('@/app/api/order-items/[id]/route')
    mocks.requireAuth.mockResolvedValue(session())
    mocks.dbOrderItemFindFirst.mockResolvedValue({ id: 'oi-1', checkId: CHK, orderId: ORD })
    mocks.dbCheckFindUnique.mockResolvedValue({ paymentStatus: 'unpaid' }) // fast-path
    mocks.dbOrderItemUpdateMany.mockResolvedValue({ count: 1 })
    mocks.dbOrderItemFindUnique.mockResolvedValue({
      id: 'oi-1', checkId: CHK, orderId: ORD, menuItem: { name: 'Test' },
      order: { locationId: LOC_A, inventoryDeducted: false },
    })
    // kanon: svež check read → 'paid' (plačilo zaključeno med claimom in recalc)
    mocks.dbCheckFindUnique.mockResolvedValueOnce({ paymentStatus: 'unpaid' }) // fast-path (1. klic)
    mocks.txOrderItemFindMany.mockResolvedValue([])
    mocks.txOrderFindUnique.mockResolvedValue({ id: ORD, discount: 0, tip: 0 })
    mocks.dbCheckFindUnique.mockResolvedValueOnce({
      id: CHK, paymentStatus: 'paid', discount: 0, serviceCharge: 0, tip: 0, orderItems: [],
    })

    const res = await PUT(
      makeReq('http://localhost/api/order-items/oi-1', 'PUT', { voided: true }),
      { params: Promise.resolve({ id: 'oi-1' }) },
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('storno')
  })

  it('D8 (CK-3): order-items void — recalc iz tx-fresh seznamov pod ključavnica (order-write → check)', async () => {
    const { PUT } = await import('@/app/api/order-items/[id]/route')
    mocks.requireAuth.mockResolvedValue(session())
    mocks.dbOrderItemFindFirst.mockResolvedValue({ id: 'oi-1', checkId: CHK, orderId: ORD })
    mocks.dbOrderItemUpdateMany.mockResolvedValue({ count: 1 })
    mocks.dbOrderItemFindUnique.mockResolvedValue({
      id: 'oi-1', checkId: CHK, orderId: ORD, menuItem: { name: 'Test' },
      order: { locationId: LOC_A, inventoryDeducted: false },
    })
    mocks.txOrderItemFindMany.mockResolvedValue([
      { id: 'oi-1', voided: true, price: 50, quantity: 1, vatRate: 22, vatAmount: 11 },
      { id: 'oi-2', voided: false, price: 100, quantity: 1, vatRate: 22, vatAmount: 22 },
    ])
    mocks.txOrderFindUnique.mockResolvedValue({ id: ORD, discount: 0, tip: 0 })
    mocks.dbCheckFindUnique.mockResolvedValue({
      id: CHK, paymentStatus: 'unpaid', discount: 0, serviceCharge: 0, tip: 0,
      orderItems: [
        { id: 'oi-1', voided: true, price: 50, quantity: 1, vatRate: 22, vatAmount: 11 },
        { id: 'oi-2', voided: false, price: 100, quantity: 1, vatRate: 22, vatAmount: 22 },
      ],
    })

    const res = await PUT(
      makeReq('http://localhost/api/order-items/oi-1', 'PUT', { voided: true }),
      { params: Promise.resolve({ id: 'oi-1' }) },
    )
    expect(res.status).toBe(200)

    // Lock graf: order-write:ORD → CHK (fiksen vrstni red)
    expect(mocks.txExecuteRaw.mock.calls[0][1]).toBe('order-write:' + ORD)
    expect(mocks.txExecuteRaw.mock.calls[1][1]).toBe(CHK)

    // Order totals iz TX-FRESH (samo ne-voidani: 100 + 22)
    expect(mocks.txOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORD },
        data: expect.objectContaining({ subtotal: 100, tax: 22, total: 122 }),
      }),
    )
    // Check totals iz TX-FRESH (voidan artikel izključen)
    expect(mocks.txCheckUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CHK },
        data: expect.objectContaining({ subtotal: 100, tax: 22, total: 122 }),
      }),
    )
  })
})

// ════════════════════════════════════════════════════════════════
// E. PLAČILNI ERROR KONTRAKT (refund + PUT payments structured)
// ════════════════════════════════════════════════════════════════
describe('R109 E: plačilni error kontrakt', () => {
  it('E1 (PAY-1): refund — lock vrstni red payment-mutate → check (dvojno povračilo nemogoče)', async () => {
    const { POST } = await import('@/app/api/payments/[id]/refund/route')
    mocks.dbPaymentFindFirst.mockResolvedValue(freshPayment({ check: { order: { locationId: LOC_A }, total: 100 } }))
    mocks.txPaymentFindUnique.mockResolvedValue({ refundAmount: 0, amount: 100, status: 'completed' })
    mocks.txPaymentUpdate.mockResolvedValue({ ...freshPayment(), refundAmount: 50 })
    mocks.txPaymentAggregate.mockResolvedValue({ _sum: { amount: 100, refundAmount: 50 } })

    const res = await POST(
      makeReq(`http://localhost/api/payments/${PAY}/refund`, 'POST', { amount: 50, reason: 'test' }),
      { params: Promise.resolve({ id: PAY }) },
    )
    // tx nadaljuje: update increment + aggregate + audit ... (mockirano)
    expect(mocks.txExecuteRaw.mock.calls[0][1]).toBe('payment-mutate:' + PAY)
    expect(mocks.txExecuteRaw.mock.calls[1][1]).toBe(CHK)
    expect(res.status).toBe(200)
  })

  it('E2: refund — REFUND_EXCEEDS → strukturirana 400 (prej string-matching)', async () => {
    const { POST } = await import('@/app/api/payments/[id]/refund/route')
    mocks.dbPaymentFindFirst.mockResolvedValue(freshPayment())
    mocks.txPaymentFindUnique.mockResolvedValue({ refundAmount: 0, amount: 100, status: 'completed' })

    const res = await POST(
      makeReq(`http://localhost/api/payments/${PAY}/refund`, 'POST', { amount: 150, reason: 'x' }),
      { params: Promise.resolve({ id: PAY }) },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('presega max povračilo')
  })

  it('E3: refund — že povrnjeno plačilo (tx-fresh status) → 409', async () => {
    const { POST } = await import('@/app/api/payments/[id]/refund/route')
    mocks.dbPaymentFindFirst.mockResolvedValue(freshPayment({ status: 'refunded', refundAmount: 100 }))
    mocks.txPaymentFindUnique.mockResolvedValue({ refundAmount: 100, amount: 100, status: 'refunded' })

    const res = await POST(
      makeReq(`http://localhost/api/payments/${PAY}/refund`, 'POST', { amount: 50, reason: 'x' }),
      { params: Promise.resolve({ id: PAY }) },
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('ni povračljivo')
  })

  it('E4: PUT payments — CAS claim count 0 → strukturirana 409 (prej string-matching)', async () => {
    const { PUT } = await import('@/app/api/payments/[id]/route')
    mocks.dbPaymentFindFirst.mockResolvedValue(freshPayment())
    mocks.txPaymentUpdateMany.mockResolvedValue({ count: 0 })

    const res = await PUT(
      makeReq(`http://localhost/api/payments/${PAY}`, 'PUT', { status: 'refunded' }),
      { params: Promise.resolve({ id: PAY }) },
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('spremenilo status')
    // CAS pin: pogojna posodobitev samo za completed
    expect(mocks.txPaymentUpdateMany.mock.calls[0][0].where).toEqual({ id: PAY, status: 'completed' })
  })

  it('E5: PUT payments — lock ključa v vrstnem redu payment-mutate → check', async () => {
    const { PUT } = await import('@/app/api/payments/[id]/route')
    mocks.dbPaymentFindFirst.mockResolvedValue(freshPayment())
    mocks.txPaymentUpdateMany.mockResolvedValue({ count: 1 })
    mocks.txPaymentFindUnique.mockResolvedValue({ ...freshPayment() })
    mocks.dbCheckFindUnique.mockResolvedValue({ id: CHK, appliedDiscountId: null, orderId: ORD })

    await PUT(
      makeReq(`http://localhost/api/payments/${PAY}`, 'PUT', { status: 'voided' }),
      { params: Promise.resolve({ id: PAY }) },
    )
    expect(mocks.txExecuteRaw.mock.calls[0][1]).toBe('payment-mutate:' + PAY)
    expect(mocks.txExecuteRaw.mock.calls[1][1]).toBe(CHK)
  })
})

// ════════════════════════════════════════════════════════════════
// F. FS-PINI (vir pini — struktura na disku)
// ════════════════════════════════════════════════════════════════
describe('R109 F: fs-pini', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('F1: checks/_helpers.ts — kanon (Serializable + advisory lock + tx-fresh)', () => {
    const src = read('src/app/api/checks/[id]/_helpers.ts')
    expect(src).toContain('TransactionIsolationLevel.Serializable')
    expect(src).toContain('pg_advisory_xact_lock')
    expect(src).toContain('export function checkWriteLockKey')
    expect(src).toContain('export async function updateCheckWithLock')
    expect(src).toContain('export async function deleteCheckWithLock')
    expect(src).toContain('tx-fresh scoped re-read')
  })

  it('F2: checks/[id]/route.ts — kanon klicana + error kontrakt + CK-4 guard', () => {
    const src = read('src/app/api/checks/[id]/route.ts')
    expect(src).toContain('updateCheckWithLock(')
    expect(src).toContain('deleteCheckWithLock(')
    expect(src).toContain('structuredErrorResponse')
    expect(src).toContain("'P2002' || error.code === 'P2034'")
    expect(src).toContain('strežniško deriviran')
    // stale read-modify-write vzorec izbrisan: NI več neposrednega tx.check.update v ruti
    expect(src).not.toContain('tx.check.update')
  })

  it('F3: recalculate-totals.ts — kanon (order-write → check lock, stale helperji izbrisani)', () => {
    const src = read('src/app/api/order-items/[id]/_helpers/recalculate-totals.ts')
    expect(src).toContain('TransactionIsolationLevel.Serializable')
    expect(src).toContain("'order-write:' + orderId")
    expect(src).toContain('recalculateOrderAndCheckAfterVoid')
    // stari stale helperji izbrisani (read-modify-write na db klientu)
    expect(src).not.toContain('export async function recalculateOrderTotals')
    expect(src).not.toContain('export async function recalculateCheckTotals')
  })

  it('F4: order-items route — kanon klican, stari helperji odstranjeni', () => {
    const src = read('src/app/api/order-items/[id]/route.ts')
    expect(src).toContain('recalculateOrderAndCheckAfterVoid(')
    expect(src).not.toContain('recalculateOrderTotals')
    expect(src).not.toContain('recalculateCheckTotals')
    expect(src).toContain('structuredErrorResponse')
  })

  it('F5: checks DELETE — brisalna logika živi v kanonu (ruta brez direktnih delete klicev)', () => {
    const src = read('src/app/api/checks/[id]/route.ts')
    expect(src).not.toContain('db.payment.deleteMany')
    expect(src).not.toContain('db.orderItem.updateMany')
    expect(src).not.toContain('db.check.delete')
  })
})
