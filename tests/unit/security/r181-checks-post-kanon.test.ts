// ============================================
// R181 — CK-5: POST /api/checks PISALNI KANON (A3 rešitev)
//        create + link + IZVORNI ČEKI RECALC v ENEM tx pod ključavnicami
// ============================================
//
// Forenzika (A3 iz docs/BUSINESS-CHAIN.md registra tveganj):
// `recalculateAffectedChecks` je deloval read-modify-write na golem `db`
// klientu BREZ tx/ključavnice (isti vzorec, ki ga je R109 CK-3 popravil na
// void poti):
//   - POST /api/checks ∥ POST /api/checks (razdelitev istega naročila):
//     oba recalc-a prebereta STALE OrderItems → lost update na totals
//     izvornih čekov (R106 INV-2 dvojček);
//   - POST /api/checks ∥ void (R109 zaklene 'order-write:'+orderId, recalc
//     NI) → stale prepis svežih void recalc totals;
//   - POST /api/checks ∥ plačilo/PUT/DELETE čeka (raw checkId ključavnice)
//     → stale totals čez sočasno spremembo čeka.
//
// KANON (CK-5, zrcali R106–R109): $transaction(Serializable, 10s) +
// orderWriteLock('order-write:'+orderId) PRVA → tx-fresh re-read naročila
// + tx-fresh paid guard → acquireCheckIdLocks(sorted raw checkId) →
// totals iz TX-FRESH artiklov → create + link + recalcAffectedChecksInTx
// VSE v istem tx. Error kontrakt v ruti: P2002/P2034 → 409 +
// structuredErrorResponse (pariteta R109 PUT/DELETE).
//
// Pokritje: A kanon vedenje (tx-fresh, locks, CAS, popust) ·
// B fail-closed guardi · C fs-pini (vir pini + negativni pini starega
// read-modify-write vzorca).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Prisma } from '@prisma/client'

const ORD = 'ord-1'
const LOC_A = 'loc-tenant-a'
const CHK_SRC = 'chk-src'
const CHK_NEW = 'chk-new'
const DISC = 'disc-a'

// --- Mocki (vi.hoisted) ---
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  txExecuteRaw: vi.fn(),
  txOrderFindFirst: vi.fn(),
  txCheckCreate: vi.fn(),
  txCheckFindMany: vi.fn(),
  txCheckUpdateMany: vi.fn(),
  txDiscountFindFirst: vi.fn(),
  txDiscountFindUnique: vi.fn(),
  txDiscountUpdate: vi.fn(),
  txDiscountUpdateMany: vi.fn(),
  txOrderItemUpdateMany: vi.fn(),
  dbOrderFindFirst: vi.fn(),
  dbCheckFindUnique: vi.fn(),
  dbDiscountFindFirst: vi.fn(),
  getNextCounter: vi.fn(),
}))

// Privzeti tx klient — kanon kliče db.$transaction(fn, options)
const txClient = {
  $executeRaw: mocks.txExecuteRaw,
  order: { findFirst: mocks.txOrderFindFirst },
  check: {
    create: mocks.txCheckCreate,
    findMany: mocks.txCheckFindMany,
    updateMany: mocks.txCheckUpdateMany,
  },
  discount: {
    findFirst: mocks.txDiscountFindFirst,
    findUnique: mocks.txDiscountFindUnique,
    update: mocks.txDiscountUpdate,
    updateMany: mocks.txDiscountUpdateMany,
  },
  orderItem: { updateMany: mocks.txOrderItemUpdateMany },
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mocks.transaction,
    order: { findFirst: mocks.dbOrderFindFirst },
    check: { findUnique: mocks.dbCheckFindUnique },
    discount: { findFirst: mocks.dbDiscountFindFirst },
  },
}))

vi.mock('@/lib/counters', () => ({
  getNextCounter: mocks.getNextCounter,
}))

vi.mock('@/lib/logger', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }
})

// --- Helperji ---
function session(locationId: string | null = LOC_A) {
  return {
    session: {
      token: 'tok',
      employeeId: 'emp-1',
      role: 'staff',
      permissions: ['take_orders'],
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      absoluteExpiry: Date.now() + 86400000,
      locationId,
    },
    error: null,
  }
}

function makeReq(body: unknown): Request {
  return new Request(`http://localhost/api/checks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Izvorni ček CHK_SRC z enim preostalim artiklom (oi-2): 10 € × 2 + DDV 4.4 */
function sourceCheckAfterTransfer() {
  return {
    id: CHK_SRC,
    discount: 0,
    serviceCharge: 0,
    tip: 0,
    orderItems: [
      { id: 'oi-2', voided: false, price: 10, quantity: 2, vatRate: 22, vatAmount: 4.4 },
    ],
  }
}

/** Naročilo z 2 artikloma na izvornem čeku; POST prenese oi-1 na nov ček. */
function orderWithTwoItems(checkId: string | null = CHK_SRC) {
  return {
    id: ORD,
    locationId: LOC_A,
    discount: 0,
    orderItems: [
      { id: 'oi-1', checkId, check: checkId ? { id: checkId, paymentStatus: 'unpaid' } : null, voided: false, price: 5, quantity: 1, vatRate: 22, vatAmount: 1.1 },
      { id: 'oi-2', checkId, check: checkId ? { id: checkId, paymentStatus: 'unpaid' } : null, voided: false, price: 10, quantity: 2, vatRate: 22, vatAmount: 4.4 },
    ],
  }
}

const ACTIVE_DISCOUNT = {
  id: DISC,
  type: 'percentage',
  amount: 10,
  isActive: true,
  maxUses: null,
  currentUses: 0,
  validFrom: null,
  validTo: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient))
  mocks.getNextCounter.mockResolvedValue(101)
  mocks.txExecuteRaw.mockResolvedValue(undefined)
  mocks.txCheckCreate.mockResolvedValue({ id: CHK_NEW, checkNumber: 101 })
  mocks.txCheckUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txOrderItemUpdateMany.mockResolvedValue({ count: 1 })
  mocks.dbCheckFindUnique.mockResolvedValue({ id: CHK_NEW, checkNumber: 101, orderItems: [], payments: [] })
})

// ════════════════════════════════════════════════════════════════
// A. KANON VEDENJE (tx-fresh + locks + CAS + popust)
// ════════════════════════════════════════════════════════════════
describe('R181 A: CK-5 kanon vedenje', () => {
  it('A1: happy path — Serializable + order-write PRVA → sorted checkId → 201', async () => {
    const { handlePostCheck } = await import('@/app/api/checks/_helpers/post-handler')
    mocks.dbOrderFindFirst.mockResolvedValue(orderWithTwoItems())
    mocks.txOrderFindFirst.mockResolvedValue(orderWithTwoItems())
    mocks.txCheckFindMany.mockResolvedValue([sourceCheckAfterTransfer()])

    const res = await handlePostCheck(makeReq({ orderId: ORD, orderItemIds: ['oi-1'] }), session())
    expect(res.status).toBe(201)

    // Tx opcije: Serializable + 10s (pariteta R109 CHECK_TX_OPTS)
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10_000,
      }),
    )

    // Lock graf: order-write:ORD PRVA → sorted raw checkId (CHK_SRC)
    expect(mocks.txExecuteRaw.mock.calls[0][1]).toBe('order-write:' + ORD)
    expect(mocks.txExecuteRaw.mock.calls[1][1]).toBe(CHK_SRC)

    // Vse mutacije v ISTEM tx (create + link + recalc)
    expect(mocks.txCheckCreate).toHaveBeenCalledTimes(1)
    expect(mocks.txOrderItemUpdateMany).toHaveBeenCalledTimes(1)
    expect(mocks.txCheckUpdateMany).toHaveBeenCalledTimes(1)
  })

  it('A2: recalc izvornega čeka iz TX-FRESH seznamov + CAS (paymentStatus not paid)', async () => {
    const { handlePostCheck } = await import('@/app/api/checks/_helpers/post-handler')
    mocks.dbOrderFindFirst.mockResolvedValue(orderWithTwoItems())
    mocks.txOrderFindFirst.mockResolvedValue(orderWithTwoItems())
    mocks.txCheckFindMany.mockResolvedValue([sourceCheckAfterTransfer()])

    await handlePostCheck(makeReq({ orderId: ORD, orderItemIds: ['oi-1'] }), session())

    // 10 × 2 = 20 + DDV 4.4 − popust 0 + postrežba 0 = 24.4 (totalWithTip brez tipa)
    expect(mocks.txCheckUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CHK_SRC, paymentStatus: { not: 'paid' } },
        data: expect.objectContaining({ subtotal: 20, tax: 4.4, total: 24.4, totalWithTip: 24.4 }),
      }),
    )
  })

  it('A3: totals NOVEGA čeka iz TX-FRESH artiklov (ne stale pre-flight)', async () => {
    const { handlePostCheck } = await import('@/app/api/checks/_helpers/post-handler')
    // stale outer: oi-1 cena 5; fresh (sočasen add-items/void): cena 7
    const stale = orderWithTwoItems()
    const fresh = orderWithTwoItems()
    fresh.orderItems[0] = { ...fresh.orderItems[0], price: 7, vatAmount: 1.54 }
    mocks.dbOrderFindFirst.mockResolvedValue(stale)
    mocks.txOrderFindFirst.mockResolvedValue(fresh)
    mocks.txCheckFindMany.mockResolvedValue([sourceCheckAfterTransfer()])

    await handlePostCheck(makeReq({ orderId: ORD, orderItemIds: ['oi-1'] }), session())

    // subtotal 7 (ne 5) — tx-fresh avtoritativno; total = 7 + DDV 1.54
    const createData = mocks.txCheckCreate.mock.calls[0][0].data
    expect(createData.subtotal).toBe(7)
    expect(createData.tax).toBeCloseTo(1.54, 2)
    expect(createData.total).toBeCloseTo(8.54, 2)
    expect(createData.totalWithTip).toBeCloseTo(8.54, 2)
  })

  it('A4: popust re-validiran proti TX-FRESH subtotalu prek tx klienta (10 % od 200 → 20)', async () => {
    const { handlePostCheck } = await import('@/app/api/checks/_helpers/post-handler')
    // stale outer subtotal 100 (oi-1 = 5 × 2 zapisa... modelirano: 5+95) — bistvo:
    // fresh items dajo 200; discount mora biti 20 (ne 10 iz stale branja)
    const stale = orderWithTwoItems()
    stale.orderItems[0] = { ...stale.orderItems[0], price: 50, vatAmount: 11 }
    const fresh = orderWithTwoItems()
    fresh.orderItems[0] = { ...fresh.orderItems[0], price: 100, vatAmount: 22 }
    mocks.dbOrderFindFirst.mockResolvedValue(stale)
    mocks.dbDiscountFindFirst.mockResolvedValue(ACTIVE_DISCOUNT)
    mocks.txOrderFindFirst.mockResolvedValue(fresh)
    mocks.txDiscountFindFirst.mockResolvedValue(ACTIVE_DISCOUNT)
    mocks.txDiscountUpdateMany.mockResolvedValue({ count: 1 })
    mocks.txCheckFindMany.mockResolvedValue([sourceCheckAfterTransfer()])

    await handlePostCheck(makeReq({ orderId: ORD, orderItemIds: ['oi-1'], appliedDiscountId: DISC }), session())

    // validacija proti tx klientu (ne db)
    expect(mocks.txDiscountFindFirst).toHaveBeenCalled()
    expect(mocks.dbDiscountFindFirst).toHaveBeenCalled() // UX pre-flight
    // 10 % od fresh subtotal 100 = 10 (stale bi dal 5); maxUses null → update path
    expect(mocks.txCheckCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ discount: 10, appliedDiscountId: DISC }),
      }),
    )
  })
})

// ════════════════════════════════════════════════════════════════
// B. FAIL-CLOSED GUARDI (tx-fresh)
// ════════════════════════════════════════════════════════════════
describe('R181 B: CK-5 tx-fresh guardi', () => {
  it('B1: naročilo izginilo med pre-flightom in tx → strukturirana 404, NI create', async () => {
    const { handlePostCheck } = await import('@/app/api/checks/_helpers/post-handler')
    mocks.dbOrderFindFirst.mockResolvedValue(orderWithTwoItems())
    mocks.txOrderFindFirst.mockResolvedValue(null)

    await expect(
      handlePostCheck(makeReq({ orderId: ORD, orderItemIds: ['oi-1'] }), session()),
    ).rejects.toMatchObject({ error: 'Naročilo ni najdeno', status: 404 })
    expect(mocks.txCheckCreate).not.toHaveBeenCalled()
  })

  it('B2: artikel prešel na PLAČAN ček med pre-flightom in tx → 400, NI create (prej stale guard)', async () => {
    const { handlePostCheck } = await import('@/app/api/checks/_helpers/post-handler')
    // outer: unpaid (guard mimo); fresh: paid (tx-fresh ulov)
    const stale = orderWithTwoItems(CHK_SRC)
    const fresh = orderWithTwoItems(CHK_SRC)
    fresh.orderItems[0] = {
      ...fresh.orderItems[0],
      check: { id: CHK_SRC, paymentStatus: 'paid' },
    }
    mocks.dbOrderFindFirst.mockResolvedValue(stale)
    mocks.txOrderFindFirst.mockResolvedValue(fresh)

    await expect(
      handlePostCheck(makeReq({ orderId: ORD, orderItemIds: ['oi-1'] }), session()),
    ).rejects.toMatchObject({ status: 400 })
    expect(mocks.txCheckCreate).not.toHaveBeenCalled()
    expect(mocks.txOrderItemUpdateMany).not.toHaveBeenCalled()
  })

  it('B3: vsi izbrani artikli voidani v tx → 400 "vsaj en artikel", NI create', async () => {
    const { handlePostCheck } = await import('@/app/api/checks/_helpers/post-handler')
    const stale = orderWithTwoItems()
    const fresh = orderWithTwoItems()
    fresh.orderItems[0] = { ...fresh.orderItems[0], voided: true }
    mocks.dbOrderFindFirst.mockResolvedValue(stale)
    mocks.txOrderFindFirst.mockResolvedValue(fresh)

    await expect(
      handlePostCheck(makeReq({ orderId: ORD, orderItemIds: ['oi-1'] }), session()),
    ).rejects.toMatchObject({ error: 'Ček mora vsebovati vsaj en artikel', status: 400 })
    expect(mocks.txCheckCreate).not.toHaveBeenCalled()
  })

  it('B4: brez orderItemIds — vse nepovezane artikle poveže, recalc preskočen (brez izgubljenih čekov)', async () => {
    const { handlePostCheck } = await import('@/app/api/checks/_helpers/post-handler')
    const unassigned = orderWithTwoItems(null)
    mocks.dbOrderFindFirst.mockResolvedValue(unassigned)
    mocks.txOrderFindFirst.mockResolvedValue(unassigned)

    const res = await handlePostCheck(makeReq({ orderId: ORD }), session())
    expect(res.status).toBe(201)
    // link: updateMany na nepovezane artikle (2 klica v linkOrderItemsToCheck? ne — en updateMany z in[])
    expect(mocks.txOrderItemUpdateMany).toHaveBeenCalled()
    // recalc: reassignedItemIds = [] → zgodnji izhod, NI txCheckFindMany/updateMany
    expect(mocks.txCheckFindMany).not.toHaveBeenCalled()
    expect(mocks.txCheckUpdateMany).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// C. FS-PINI (vir pini + negativni pini starega vzorca)
// ════════════════════════════════════════════════════════════════
describe('R181 C: fs-pini', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  // stripComments — pin na KODI, ne komentarjih (R180 kanon)
  const stripComments = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .trim()

  it('C1: transaction.ts — InTx kanon + locks + CAS; STARI db-client vzorec IZBRISAN', () => {
    const src = read('src/app/api/checks/_helpers/transaction.ts')
    expect(src).toContain('export async function recalculateAffectedChecksInTx')
    expect(src).toContain('export function orderWriteLockKey')
    expect(src).toContain('export async function orderWriteLock')
    expect(src).toContain('export async function acquireCheckIdLocks')
    expect(src).toContain("'order-write:' + orderId")
    expect(src).toContain('pg_advisory_xact_lock')
    // CAS obrambna globina: totals plačanega čeka se ne spreminjajo
    expect(src).toContain("paymentStatus: { not: 'paid' }")
    const stripped = stripComments(src)
    // NEGATIVNI pini — stari read-modify-write na golem klientu
    expect(stripped).not.toContain('await db.check.update')
    expect(stripped).not.toContain('await db.check.findMany')
    expect(stripped).not.toContain('export async function recalculateAffectedChecks(')
  })

  it('C2: transaction.ts — lock vrstni red strukturno (order-write PRED checkId zanko)', () => {
    const src = stripComments(read('src/app/api/checks/_helpers/transaction.ts'))
    const orderWriteIdx = src.indexOf("'order-write:' + orderId")
    const loopIdx = src.indexOf('for (const id of ids)')
    expect(orderWriteIdx).toBeGreaterThan(-1)
    expect(loopIdx).toBeGreaterThan(-1)
    expect(orderWriteIdx).toBeLessThan(loopIdx)
  })

  it('C3: post-handler.ts — kanon klican (Serializable + locki + recalc v tx)', () => {
    const src = read('src/app/api/checks/_helpers/post-handler.ts')
    expect(src).toContain('TransactionIsolationLevel.Serializable')
    expect(src).toContain('timeout: 10_000')
    expect(src).toContain('orderWriteLock(tx, data.orderId)')
    expect(src).toContain('acquireCheckIdLocks(tx, freshItems.map(oi => oi.checkId))')
    expect(src).toContain('recalculateAffectedChecksInTx(tx, data.orderId, newCheck.id')
    expect(src).toContain("oi.check?.paymentStatus === 'paid'")
    const stripped = stripComments(src)
    // NEGATIVNI pini — recalc IZVEN tx (stari A3 vzorec) je izbrisan
    expect(stripped).not.toContain('await recalculateAffectedChecks(')
    expect(stripped).not.toContain('db.check.update')
  })

  it('C4: route.ts POST — R109 error kontrakt (P2002/P2034 → 409 + structured)', () => {
    const src = read('src/app/api/checks/route.ts')
    expect(src).toContain("'P2002' || error.code === 'P2034'")
    expect(src).toContain('structuredErrorResponse')
    expect(src).toContain('status: 409')
    // handleApiError ne zmore strukturiranih throw-ov → očiščen iz te rute
    expect(stripComments(src)).not.toContain('handleApiError')
  })

  it('C5: calculate.ts — validateAndCalculateDiscount sprejme tx klient', () => {
    const src = read('src/app/api/checks/_helpers/calculate.ts')
    expect(src).toContain('client: Prisma.TransactionClient = db')
    expect(src).toContain('client.discount.findFirst')
  })

  it('C6: index.ts — novi eksporti, stari ime izginjeno', () => {
    const src = read('src/app/api/checks/_helpers/index.ts')
    expect(src).toContain('recalculateAffectedChecksInTx')
    expect(src).toContain('orderWriteLock')
    expect(src).toContain('acquireCheckIdLocks')
    // staro ime (brez InTx pripone) ni več eksportirano
    expect(src).not.toContain('recalculateAffectedChecks,')
  })
})
