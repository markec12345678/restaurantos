// ============================================
// R105 — PURCHASE-ORDER RECEIVE (denarna/zalogovna pot) CONCURRENCY &
//        IDEMPOTENCY + PUT/PATCH CAS STATE MACHINE (TOCTOU razred R100–R104)
// ============================================
//
// Forenzika (bug-hunt val: "sibling prevzemnih tokov, ki jih R100–R104 niso
// pokrili" — glej _helpers.ts R105 header):
//
//   PO-1 (HIGH, TOCTOU double-receive): stale PO+items read izven tx →
//      read-modify-write quantityReceived → dvojna zaloga; handleReceiveAction
//      (PUT/PATCH pot) sploh ni imel 'received' status guard-a.
//   PO-2 (HIGH, dvojna obveznost): AP create brez obstoječega-AP pregleda +
//      apNumber @unique count+1 števec → P2002 → 500 (R104 Q1 razred).
//   PO-3 (MEDIUM): prevzem cancelled naročila → tiho povečanje zaloge.
//   PO-4 (MEDIUM): neznan itemId v PUT poti → tihi `continue` → 200 brez pisanj.
//   PO-5 (MEDIUM): PUT/PATCH state machine check-then-act → last-write-wins.
//   PO-6: error kontrakt (strukturirani tx throw-i + structuredErrorResponse).
//
// Pokritje: A POST receive kanon (lock/tx-fresh/guardi/AP/race-pathi) ·
// B PUT action=receive pariteta · C PUT/PATCH CAS · D fs-guardi (vir pini).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Prisma } from '@prisma/client'

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'
const PO_ID = 'po-r105-1'

// --- Mocki (vi.hoisted) ---
const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  // db-level ([id] route: PUT/PATCH CAS)
  poDbFindFirst: vi.fn(),
  poDbUpdateMany: vi.fn(),
  // tx-level (receive kanon)
  transaction: vi.fn(),
  txExecuteRaw: vi.fn(),
  txPoFindFirst: vi.fn(),
  txPoFindUnique: vi.fn(),
  txPoUpdate: vi.fn(),
  txPoiUpdate: vi.fn(),
  txInvUpdate: vi.fn(),
  txStockTxCreate: vi.fn(),
  txApFindFirst: vi.fn(),
  txApCount: vi.fn(),
  txApCreate: vi.fn(),
}))

// Privzeti tx klient — rute kličejo $transaction(fn, options)
const txClient = {
  $executeRaw: mocks.txExecuteRaw,
  purchaseOrder: {
    findFirst: mocks.txPoFindFirst,
    findUnique: mocks.txPoFindUnique,
    update: mocks.txPoUpdate,
  },
  purchaseOrderItem: { update: mocks.txPoiUpdate },
  inventoryItem: { update: mocks.txInvUpdate },
  stockTransaction: { create: mocks.txStockTxCreate },
  accountsPayable: {
    findFirst: mocks.txApFindFirst,
    count: mocks.txApCount,
    create: mocks.txApCreate,
  },
}

function defaultTxImpl(fn: (tx: unknown) => Promise<unknown>) {
  return fn(txClient)
}

vi.mock('@/lib/db', () => ({
  db: {
    purchaseOrder: {
      findFirst: mocks.poDbFindFirst,
      updateMany: mocks.poDbUpdateMany,
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
  greaterThanOrEqual: (a: unknown, b: unknown) => Number(a) >= Number(b),
  isPositive: (v: unknown) => Number(v) > 0,
  deepToNumbers: <T>(v: T): T => v,
  decimalsToNumbers: <T>(v: T): T => v,
}))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  isEmailEnabled: vi.fn().mockResolvedValue(false),
}))

import { POST as receivePost } from '@/app/api/purchase-orders/[id]/receive/route'
import { PUT as poPUT, PATCH as poPATCH } from '@/app/api/purchase-orders/[id]/route'

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

function mockAuth(role = 'manager', locationId: string | null = LOC_A, permissions = ['manage_inventory']) {
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

const RECEIVE_URL = `http://localhost:3000/api/purchase-orders/${PO_ID}/receive`
const PO_URL = `http://localhost:3000/api/purchase-orders/${PO_ID}`

// --- Fixture: PO z enim itemom (ordered 10, prejeto 0, povezan inventar) ---
function makePo(overrides: Record<string, unknown> = {}) {
  return {
    id: PO_ID,
    poNumber: 'PO-2026-0001',
    status: 'approved',
    locationId: LOC_A,
    supplierId: 'sup-1',
    subtotal: 100,
    vatAmount: 22,
    totalAmount: 122,
    notes: null,
    receivedDate: null,
    supplier: { id: 'sup-1', name: 'Dobavitelj d.o.o.' },
    items: [
      {
        id: 'poi-1',
        description: 'Kava 1kg',
        quantityOrdered: 10,
        quantityReceived: 0,
        unitPrice: 10,
        inventoryItemId: 'inv-1',
        status: 'ordered',
      },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(defaultTxImpl)
  mocks.txExecuteRaw.mockResolvedValue(1)
  mockAuth()
})

// ════════════════════════════════════════════════════════════════
// A. POST /api/purchase-orders/[id]/receive — prevzemni kanon
// ════════════════════════════════════════════════════════════════
describe('R105 A: POST receive — Serializable tx + advisory lock + tx-fresh', () => {
  beforeEach(() => {
    // Tx-fresh PO (prej: stale read izven transakcije)
    mocks.txPoFindFirst.mockResolvedValue(makePo())
    // Roll-up re-read po item update-u — simulira sveže stanje (poi-1: 10/10)
    mocks.txPoFindUnique.mockResolvedValue(makePo({ items: [makePo().items[0] && { ...makePo().items[0], quantityReceived: 10, status: 'received' }] }))
    mocks.txPoiUpdate.mockResolvedValue({})
    mocks.txInvUpdate.mockResolvedValue({ id: 'inv-1', quantity: 10 })
    mocks.txStockTxCreate.mockResolvedValue({})
    mocks.txPoUpdate.mockResolvedValue(makePo({ status: 'received', receivedDate: new Date() }))
    mocks.txApFindFirst.mockResolvedValue(null)
    mocks.txApCount.mockResolvedValue(7)
    mocks.txApCreate.mockResolvedValue({ id: 'ap-1', apNumber: 'AP-2026-000008' })
  })

  it('A1: advisory lock + Serializable izolacija (kanon R104)', async () => {
    const res = await receivePost(jsonReq(RECEIVE_URL, 'POST', {
      receivedItems: [{ itemId: 'poi-1', quantityReceived: 10 }],
    }), params(PO_ID))
    expect(res.status).toBe(200)
    expect(mocks.txExecuteRaw).toHaveBeenCalledTimes(1)
    expect(String(mocks.txExecuteRaw.mock.calls[0][0])).toContain('pg_advisory_xact_lock')
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    )
  })

  it('A2: tx-fresh re-read — stale db-level PO read je IZBRISAN iz rute', async () => {
    await receivePost(jsonReq(RECEIVE_URL, 'POST', {
      receivedItems: [{ itemId: 'poi-1', quantityReceived: 10 }],
    }), params(PO_ID))
    // R105 PO-1: ruta NE bere PO več izven transakcije — samo tx-level findFirst
    expect(mocks.poDbFindFirst).not.toHaveBeenCalled()
    expect(mocks.txPoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: PO_ID, locationId: LOC_A }) })
    )
  })

  it('A3: tx-fresh status guard — received PO → 400, ZERO pisanj (dvojni prevzem)', async () => {
    mocks.txPoFindFirst.mockResolvedValue(makePo({ status: 'received' }))
    const res = await receivePost(jsonReq(RECEIVE_URL, 'POST', {
      receivedItems: [{ itemId: 'poi-1', quantityReceived: 1 }],
    }), params(PO_ID))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('že popolnoma prejeto')
    expect(mocks.txPoiUpdate).not.toHaveBeenCalled()
    expect(mocks.txInvUpdate).not.toHaveBeenCalled()
    expect(mocks.txApCreate).not.toHaveBeenCalled()
  })

  it('A4: tx-fresh cancelled guard → 400 (prej: tiho povečanje zaloge)', async () => {
    mocks.txPoFindFirst.mockResolvedValue(makePo({ status: 'cancelled' }))
    const res = await receivePost(jsonReq(RECEIVE_URL, 'POST', {
      receivedItems: [{ itemId: 'poi-1', quantityReceived: 1 }],
    }), params(PO_ID))
    expect(res.status).toBe(400)
    expect(mocks.txInvUpdate).not.toHaveBeenCalled()
  })

  it('A5: over-receipt → 400, zaloga NI increment-ana', async () => {
    mocks.txPoFindFirst.mockResolvedValue(makePo({ items: [{ ...makePo().items[0], quantityReceived: 8 }] }))
    const res = await receivePost(jsonReq(RECEIVE_URL, 'POST', {
      receivedItems: [{ itemId: 'poi-1', quantityReceived: 5 }], // 8+5 > 10
    }), params(PO_ID))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('presega naročeno')
    expect(mocks.txInvUpdate).not.toHaveBeenCalled()
    expect(mocks.txStockTxCreate).not.toHaveBeenCalled()
  })

  it('A6: happy path — item update + inventory increment + StockTransaction forenzika + status received + AP', async () => {
    const res = await receivePost(jsonReq(RECEIVE_URL, 'POST', {
      receivedItems: [{ itemId: 'poi-1', quantityReceived: 10 }],
    }), params(PO_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.status).toBe('received')
    // item: totalReceived = 0 + 10, status received
    expect(mocks.txPoiUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'poi-1' },
      data: expect.objectContaining({ quantityReceived: 10, status: 'received' }),
    }))
    // zaloga: atomic increment 10
    expect(mocks.txInvUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'inv-1' },
      data: expect.objectContaining({ quantity: { increment: 10 } }),
    }))
    // StockTransaction forenzika iz post-op vrednosti (prev 0 → new 10)
    expect(mocks.txStockTxCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quantity: 10, previousQty: 0, newQty: 10, type: 'procurement' }),
    }))
    // AP: count+1 števec → AP-2026-000008, vezan na PO
    expect(mocks.txApCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        apNumber: 'AP-2026-000008',
        purchaseOrderId: PO_ID,
        totalAmount: 122,
      }),
    }))
  })

  it('A7: AP idempotnost — obstoječ AP za ta PO → NI drugega create-a (dvojna obveznost zaprta)', async () => {
    mocks.txApFindFirst.mockResolvedValue({ id: 'ap-existing', apNumber: 'AP-2026-000001' })
    await receivePost(jsonReq(RECEIVE_URL, 'POST', {
      receivedItems: [{ itemId: 'poi-1', quantityReceived: 10 }],
    }), params(PO_ID))
    expect(mocks.txApFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { purchaseOrderId: PO_ID } })
    )
    expect(mocks.txApCreate).not.toHaveBeenCalled()
  })

  it('A8: neznan itemId → fail-closed 400 (prej PUT tihi continue → 200 brez pisanj)', async () => {
    const res = await receivePost(jsonReq(RECEIVE_URL, 'POST', {
      receivedItems: [{ itemId: 'poi-NEZNAN', quantityReceived: 5 }],
    }), params(PO_ID))
    expect(res.status).toBe(400)
    expect(mocks.txPoiUpdate).not.toHaveBeenCalled()
    expect(mocks.txInvUpdate).not.toHaveBeenCalled()
  })

  it('A9: delni prevzem — status partial, NI AP (obveznost šele ob popolnem prejemu)', async () => {
    mocks.txPoFindUnique.mockResolvedValue(makePo({ items: [{ ...makePo().items[0], quantityReceived: 4, status: 'partial' }] }))
    mocks.txPoUpdate.mockResolvedValue(makePo({ status: 'partial' }))
    const res = await receivePost(jsonReq(RECEIVE_URL, 'POST', {
      receivedItems: [{ itemId: 'poi-1', quantityReceived: 4 }],
    }), params(PO_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('partial')
    expect(mocks.txApCreate).not.toHaveBeenCalled()
    expect(mocks.txApFindFirst).not.toHaveBeenCalled()
  })

  it('A10: tx-fresh 404 (tuja naročilnica / izbrisana) → 404', async () => {
    mocks.txPoFindFirst.mockResolvedValue(null)
    const res = await receivePost(jsonReq(RECEIVE_URL, 'POST', {
      receivedItems: [{ itemId: 'poi-1', quantityReceived: 1 }],
    }), params(PO_ID))
    expect(res.status).toBe(404)
  })

  it('A11: P2002 (apNumber @unique count+1 race) → 409, NIKOLI 500 (R104 Q1 razred)', async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
    )
    const res = await receivePost(jsonReq(RECEIVE_URL, 'POST', {
      receivedItems: [{ itemId: 'poi-1', quantityReceived: 10 }],
    }), params(PO_ID))
    expect(res.status).toBe(409)
  })

  it('A12: P2034 serialization conflict → 409 retry', async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Serialization failure', { code: 'P2034', clientVersion: 'test' })
    )
    const res = await receivePost(jsonReq(RECEIVE_URL, 'POST', {
      receivedItems: [{ itemId: 'poi-1', quantityReceived: 10 }],
    }), params(PO_ID))
    expect(res.status).toBe(409)
  })
})

// ════════════════════════════════════════════════════════════════
// B. PUT/PATCH action='receive' — handleReceiveAction pariteta
// ════════════════════════════════════════════════════════════════
describe('R105 B: PUT action=receive — isti kanon (prej stale + brez guard-a)', () => {
  beforeEach(() => {
    mocks.txPoFindFirst.mockResolvedValue(makePo())
    mocks.txPoFindUnique.mockResolvedValue(makePo({ items: [{ ...makePo().items[0], quantityReceived: 10, status: 'received' }] }))
    mocks.txPoiUpdate.mockResolvedValue({})
    mocks.txInvUpdate.mockResolvedValue({ id: 'inv-1', quantity: 10 })
    mocks.txStockTxCreate.mockResolvedValue({})
    mocks.txPoUpdate.mockResolvedValue(makePo({ status: 'received' }))
    mocks.txApFindFirst.mockResolvedValue(null)
    mocks.txApCount.mockResolvedValue(1)
    mocks.txApCreate.mockResolvedValue({ id: 'ap-1' })
  })

  it('B1: happy path — 200 + advisory lock + tx-fresh (isti kanon kot POST)', async () => {
    const res = await poPUT(jsonReq(PO_URL, 'PUT', {
      action: 'receive',
      receivedItems: [{ itemId: 'poi-1', quantityReceived: 10 }],
    }), params(PO_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mocks.txExecuteRaw).toHaveBeenCalledTimes(1)
    expect(mocks.txPoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: PO_ID, locationId: LOC_A }) })
    )
  })

  it('B2: received PO prek PUT → 400 (prej: SPLOH brez status guard-a = dvojni prevzem!)', async () => {
    mocks.txPoFindFirst.mockResolvedValue(makePo({ status: 'received' }))
    const res = await poPUT(jsonReq(PO_URL, 'PUT', {
      action: 'receive',
      receivedItems: [{ itemId: 'poi-1', quantityReceived: 10 }],
    }), params(PO_ID))
    expect(res.status).toBe(400)
    expect(mocks.txInvUpdate).not.toHaveBeenCalled()
    expect(mocks.txApCreate).not.toHaveBeenCalled()
  })

  it('B3: neznan itemId prek PUT → 400 (prej: tihi `continue` → 200 brez vsakega pisanja)', async () => {
    const res = await poPUT(jsonReq(PO_URL, 'PUT', {
      action: 'receive',
      receivedItems: [{ itemId: 'poi-NEZNAN', quantityReceived: 1 }],
    }), params(PO_ID))
    expect(res.status).toBe(400)
    expect(mocks.txPoiUpdate).not.toHaveBeenCalled()
  })

  it('B4: P2034 prek PUT → 409', async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Serialization failure', { code: 'P2034', clientVersion: 'test' })
    )
    const res = await poPUT(jsonReq(PO_URL, 'PUT', {
      action: 'receive',
      receivedItems: [{ itemId: 'poi-1', quantityReceived: 10 }],
    }), params(PO_ID))
    expect(res.status).toBe(409)
  })
})

// ════════════════════════════════════════════════════════════════
// C. PUT/PATCH status — CAS state-machine write (PO-5)
// ════════════════════════════════════════════════════════════════
describe('R105 C: PUT/PATCH CAS — last-write-wins state-machine bypass zaprt', () => {
  beforeEach(() => {
    mocks.poDbFindFirst.mockResolvedValue({ id: PO_ID, status: 'submitted', locationId: LOC_A })
    mocks.poDbUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('C1: PATCH happy path — pogojni updateMany (id + status: existing.status + lokacija) + re-read', async () => {
    mocks.poDbFindFirst.mockResolvedValueOnce({ id: PO_ID, status: 'submitted', locationId: LOC_A })
      .mockResolvedValueOnce(makePo({ status: 'approved' }))
    const res = await poPATCH(jsonReq(PO_URL, 'PATCH', { status: 'approved' }), params(PO_ID))
    expect(res.status).toBe(200)
    expect(mocks.poDbUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: PO_ID, status: 'submitted', locationId: LOC_A }),
      data: expect.objectContaining({ status: 'approved' }),
    }))
  })

  it('C2: PATCH race (count 0) → 409 (prej: last-write-wins obide state machine)', async () => {
    mocks.poDbUpdateMany.mockResolvedValue({ count: 0 })
    const res = await poPATCH(jsonReq(PO_URL, 'PATCH', { status: 'approved' }), params(PO_ID))
    expect(res.status).toBe(409)
  })

  it('C3: PUT race (count 0) → 409', async () => {
    mocks.poDbUpdateMany.mockResolvedValue({ count: 0 })
    const res = await poPUT(jsonReq(PO_URL, 'PUT', { status: 'approved' }), params(PO_ID))
    expect(res.status).toBe(409)
  })

  it('C4: neveljaven prehod ostane 400 (state machine validacija nedotaknjena)', async () => {
    mocks.poDbFindFirst.mockResolvedValue({ id: PO_ID, status: 'received', locationId: LOC_A })
    const res = await poPATCH(jsonReq(PO_URL, 'PATCH', { status: 'draft' }), params(PO_ID))
    expect(res.status).toBe(400)
    expect(mocks.poDbUpdateMany).not.toHaveBeenCalled()
  })

  it('C5: CAS where je vedno scope-pet (cross-tenant PUT → count 0 → 409, ne 200)', async () => {
    // tuja lokacija: existing read z lokacijskim filtrom ne najde → 404 (scope)
    mocks.poDbFindFirst.mockResolvedValue(null)
    const res = await poPUT(jsonReq(PO_URL, 'PUT', { status: 'approved' }), params(PO_ID))
    expect(res.status).toBe(404)
    expect(mocks.poDbUpdateMany).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// D. fs-guardi — vir pini (R91 lekcija: pini morajo brati izvor)
// ════════════════════════════════════════════════════════════════
describe('R105 D: fs-guardi — kanon pini', () => {
  const HELPERS = readFileSync(
    join(__dirname, '../../../src/app/api/purchase-orders/[id]/_helpers.ts'), 'utf8'
  )
  const RECEIVE = readFileSync(
    join(__dirname, '../../../src/app/api/purchase-orders/[id]/receive/route.ts'), 'utf8'
  )
  const PO_ROUTE = readFileSync(
    join(__dirname, '../../../src/app/api/purchase-orders/[id]/route.ts'), 'utf8'
  )

  it('D1: helpers vsebuje advisory lock + Serializable + AP idempotenčni pregled', () => {
    expect(HELPERS).toContain('pg_advisory_xact_lock')
    expect(HELPERS).toContain('TransactionIsolationLevel.Serializable')
    expect(HELPERS).toContain('where: { purchaseOrderId: poId }')
  })

  it('D2: receive ruta brez stale db-level PO read-a + race-path 409', () => {
    // stale read izbrisano — PO se bere SAMO tx-fresh znotraj kanona
    expect(RECEIVE).not.toMatch(/purchaseOrder\.findFirst/)
    expect(RECEIVE).toContain("code === 'P2002'")
    expect(RECEIVE).toContain("code === 'P2034'")
    expect(RECEIVE).toContain('structuredErrorResponse')
  })

  it('D3: [id] ruta uporablja CAS (nepogojen purchaseOrder.update izbrisan iz PUT/PATCH)', () => {
    expect(PO_ROUTE.match(/casUpdatePurchaseOrder/g)?.length).toBeGreaterThanOrEqual(2) // PUT + PATCH
    expect(PO_ROUTE).not.toMatch(/purchaseOrder\.update\(/)
  })
})
