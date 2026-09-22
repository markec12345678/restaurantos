// ============================================
// R106 — INVENTORY STOCK MUTATIONS (zalogovna/denarna pot) CONCURRENCY
//        & ERROR KONTRAKT (TOCTOU razred R100–R105)
// ============================================
//
// Forenzika (bug-hunt val: "zalogovne pisalne poti, ki jih R100–R105 niso
// pokrili" — glej _helpers/stock-mutations.ts R106 header):
//
//   INV-1 (HIGH, POST /api/inventory/adjust): (a) odpisna pot NEPOGOJEN
//      decrement po stale cap-checku → dva sočasna odpisa = NEGATIVNA ZALOGA
//      (batch PUT je imel P3 atomarni guard, POST ga NI); (b) absolutna pot
//      ("nastavi na 100") lost update → dvojna delta; (c) `throw new
//      Error('Artikel ni najden')` → 500 namesto strukturirane 404.
//   INV-2 (HIGH, PUT/PATCH /api/inventory/[id]): `existing` stale read izven
//      tx + NEPOGOJEN absolute set → sočasna prodaja (decrement) tiho
//      prepisana (lost update) + duplirana StockTransaction vrstica.
//   INV-3 (MEDIUM, POST /api/inventory/restock): raw `where: { id }` brez
//      scope re-checka v tx (P2025 → 500) + brez per-item ključavnice
//      (audit prepleti med sočasnim restock/adjust).
//
// Pokritje: A adjust kanon (lock/tx-fresh/guardi/audit/race-pathi) ·
// B PUT/PATCH pariteta (tx-fresh diff) · C restock + skupni lock ključ ·
// D fs-guardi (vir pini).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Prisma } from '@prisma/client'

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'
const INV_ID = 'inv-1'

// --- Mocki (vi.hoisted) ---
const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  // db-level (rute: fast-path 404 + metadata-only update)
  invDbFindFirst: vi.fn(),
  invDbUpdate: vi.fn(),
  // $transaction (kanon + batch PUT)
  transaction: vi.fn(),
  // tx-level (kanon)
  txExecuteRaw: vi.fn(),
  txInvFindFirst: vi.fn(),
  txInvFindUnique: vi.fn(),
  txInvUpdate: vi.fn(),
  txInvUpdateMany: vi.fn(),
  txStockTxCreate: vi.fn(),
}))

// Privzeti tx klient — helperji kličejo db.$transaction(fn, options)
const txClient = {
  $executeRaw: mocks.txExecuteRaw,
  inventoryItem: {
    findFirst: mocks.txInvFindFirst,
    findUnique: mocks.txInvFindUnique,
    update: mocks.txInvUpdate,
    updateMany: mocks.txInvUpdateMany,
  },
  stockTransaction: { create: mocks.txStockTxCreate },
}

function defaultTxImpl(fn: (tx: unknown) => Promise<unknown>) {
  return fn(txClient)
}

vi.mock('@/lib/db', () => ({
  db: {
    inventoryItem: {
      findFirst: mocks.invDbFindFirst,
      update: mocks.invDbUpdate,
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
  divide: (a: number, b: number) => a / b,
  greaterThan: (a: unknown, b: unknown) => Number(a) > Number(b),
  greaterThanOrEqual: (a: unknown, b: unknown) => Number(a) >= Number(b),
  isPositive: (v: unknown) => Number(v) > 0,
  decEquals: (a: unknown, b: unknown) => Number(a) === Number(b),
  deepToNumbers: <T>(v: T): T => v,
  decimalsToNumbers: <T>(v: T): T => v,
}))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  isEmailEnabled: vi.fn().mockResolvedValue(false),
}))

import { POST as adjustPost, PUT as adjustBatchPut } from '@/app/api/inventory/adjust/route'
import { POST as restockPost } from '@/app/api/inventory/restock/route'
import { PUT as invPUT, PATCH as invPATCH } from '@/app/api/inventory/[id]/route'

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

const ADJUST_URL = 'http://localhost:3000/api/inventory/adjust'
const RESTOCK_URL = 'http://localhost:3000/api/inventory/restock'
const INV_URL = `http://localhost:3000/api/inventory/${INV_ID}`

// --- Fixture: zalogov artikel (fresh zaloga 20, cena 8, 4 porcije) ---
function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: INV_ID,
    name: 'Kava 1kg',
    quantity: 20,
    costPerUnit: 8,
    servingsPerUnit: 4,
    locationId: LOC_A,
    menuItem: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(defaultTxImpl)
  mocks.txExecuteRaw.mockResolvedValue(1)
  // Fast-path (route) + tx-fresh (kanon) — privzeto isti artikel
  mocks.invDbFindFirst.mockResolvedValue(makeItem())
  mocks.txInvFindFirst.mockResolvedValue(makeItem())
  mocks.txInvFindUnique.mockResolvedValue(makeItem({ quantity: 8 }))
  mocks.txInvUpdate.mockResolvedValue(makeItem())
  mocks.txInvUpdateMany.mockResolvedValue({ count: 1 })
  // tx-stockTransaction.create vrne ustvarjeno vrstico (produkcija) — echo data
  mocks.txStockTxCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'stx-1', ...data }))
  mockAuth()
})

// ════════════════════════════════════════════════════════════════
// A. POST /api/inventory/adjust — zalogovni kanon
// ════════════════════════════════════════════════════════════════
describe('R106 A: POST adjust — Serializable tx + advisory lock + tx-fresh', () => {
  it('A1: advisory lock + Serializable izolacija (kanon R105/R104)', async () => {
    const res = await adjustPost(jsonReq(ADJUST_URL, 'POST', {
      inventoryItemId: INV_ID, quantity: 5, type: 'write-off', reason: 'Odpis',
    }))
    expect(res.status).toBe(200)
    expect(mocks.txExecuteRaw).toHaveBeenCalledTimes(1)
    expect(String(mocks.txExecuteRaw.mock.calls[0][0])).toContain('pg_advisory_xact_lock')
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    )
  })

  it('A2: tx-fresh scoped re-read — lock pred branjem, lokacijski filter v tx', async () => {
    await adjustPost(jsonReq(ADJUST_URL, 'POST', {
      inventoryItemId: INV_ID, quantity: 5, type: 'write-off', reason: 'Odpis',
    }))
    // tx-level findFirst s scope-om (fresh re-read po ključavnici)
    expect(mocks.txInvFindFirst).toHaveBeenCalledWith({
      where: { id: INV_ID, locationId: LOC_A },
    })
  })

  it('A3: odpis presega TX-FRESH zalogo → 400, ZERO pisanj (negativna zaloga nemogoča)', async () => {
    mocks.txInvFindFirst.mockResolvedValue(makeItem({ quantity: 20 }))
    const res = await adjustPost(jsonReq(ADJUST_URL, 'POST', {
      inventoryItemId: INV_ID, quantity: 30, type: 'write-off', reason: 'Odpis',
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Odpis (30) presega razpoložljivo zalogo (20)')
    expect(mocks.txInvUpdateMany).not.toHaveBeenCalled()
    expect(mocks.txInvUpdate).not.toHaveBeenCalled()
    expect(mocks.txStockTxCreate).not.toHaveBeenCalled()
  })

  it('A4: odpis uspešen → atomarni gte decrement + StockTransaction iz sveže verige', async () => {
    mocks.txInvFindFirst.mockResolvedValue(makeItem({ quantity: 20 }))
    const res = await adjustPost(jsonReq(ADJUST_URL, 'POST', {
      inventoryItemId: INV_ID, quantity: 12, type: 'write-off', reason: 'Odpis pokvarjenega',
    }))
    expect(res.status).toBe(200)
    // Atomarni pogojni decrement (P3 pariteta — dvorno varovalo)
    expect(mocks.txInvUpdateMany).toHaveBeenCalledWith({
      where: { id: INV_ID, quantity: { gte: 12 } },
      data: { quantity: { decrement: 12 } },
    })
    expect(mocks.txInvUpdate).not.toHaveBeenCalled()
    // Audit veriga proti svežim podatkom
    expect(mocks.txStockTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inventoryItemId: INV_ID,
        quantity: -12,
        previousQty: 20,
        newQty: 8,
        totalCost: 96,
      }),
    })
  })

  it('A5: artikel izgine med stopnicama (tx-fresh 404) → strukturirana 404, zero pisanj', async () => {
    mocks.txInvFindFirst.mockResolvedValue(null)
    const res = await adjustPost(jsonReq(ADJUST_URL, 'POST', {
      inventoryItemId: INV_ID, quantity: 5, type: 'write-off', reason: 'Odpis',
    }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Zalogov artikel ni najden')
    expect(mocks.txInvUpdateMany).not.toHaveBeenCalled()
    expect(mocks.txStockTxCreate).not.toHaveBeenCalled()
  })

  it('A6: absolutna prilagoditev — delta iz TX-FRESH zaloge (lost update nemogoč)', async () => {
    mocks.txInvFindFirst.mockResolvedValue(makeItem({ quantity: 20 }))
    const res = await adjustPost(jsonReq(ADJUST_URL, 'POST', {
      inventoryItemId: INV_ID, type: 'adjustment', newQuantity: 100, reason: 'Inventura',
    }))
    expect(res.status).toBe(200)
    expect(mocks.txInvUpdate).toHaveBeenCalledWith({
      where: { id: INV_ID },
      data: { quantity: { increment: 80 } },
      include: { menuItem: true },
    })
    expect(mocks.txStockTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantity: 80,
        previousQty: 20,
        newQty: 100,
      }),
    })
  })

  it('A7: absolutna prilagoditev navzdol → gte guard decrement (brez negativne zaloge)', async () => {
    mocks.txInvFindFirst.mockResolvedValue(makeItem({ quantity: 20 }))
    const res = await adjustPost(jsonReq(ADJUST_URL, 'POST', {
      inventoryItemId: INV_ID, type: 'adjustment', newQuantity: 5, reason: 'Inventura',
    }))
    expect(res.status).toBe(200)
    expect(mocks.txInvUpdateMany).toHaveBeenCalledWith({
      where: { id: INV_ID, quantity: { gte: 15 } },
      data: { quantity: { decrement: 15 } },
    })
    expect(mocks.txStockTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ quantity: -15, previousQty: 20, newQty: 5 }),
    })
  })

  it('A8: audit log z TX-FRESH vrednostmi (prej stale previousQty/newQty)', async () => {
    const { createAuditLog } = await import('@/lib/db')
    mocks.txInvFindFirst.mockResolvedValue(makeItem({ quantity: 20 }))
    mocks.txInvFindUnique.mockResolvedValue(makeItem({ quantity: 8, name: 'Kava 1kg' }))
    await adjustPost(jsonReq(ADJUST_URL, 'POST', {
      inventoryItemId: INV_ID, quantity: 12, type: 'write-off', reason: 'Odpis',
    }))
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'INVENTORY_ADJUST',
      entityId: INV_ID,
      details: expect.objectContaining({
        quantity: -12,
        previousQty: 20,
        newQty: 8,
        itemName: 'Kava 1kg',
      }),
    }))
  })

  it('A9: P2034 serialization conflict → 409 (nikoli 500)', async () => {
    mocks.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Serialization failure', { code: 'P2034', clientVersion: 'test' })
    )
    const res = await adjustPost(jsonReq(ADJUST_URL, 'POST', {
      inventoryItemId: INV_ID, quantity: 5, type: 'write-off', reason: 'Odpis',
    }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('sočasen dostop')
  })

  it('A10: nestrukturiran tx error → handleApiError fallback, brez "[object Object]"', async () => {
    mocks.transaction.mockRejectedValueOnce(new Error('db connection reset'))
    const res = await adjustPost(jsonReq(ADJUST_URL, 'POST', {
      inventoryItemId: INV_ID, quantity: 5, type: 'write-off', reason: 'Odpis',
    }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(typeof body.error).toBe('string')
    expect(body.error).not.toContain('[object Object]')
  })

  it('A11: fast-path scope 404 (WRITE IDOR politika) — kanon sploh ne sproži tx', async () => {
    mocks.invDbFindFirst.mockResolvedValue(null)
    const res = await adjustPost(jsonReq(ADJUST_URL, 'POST', {
      inventoryItemId: INV_ID, quantity: 5, type: 'write-off', reason: 'Odpis',
    }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Zalogov artikel ni najden')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('A12: odgovor vsebuje sveži { item, transaction } par', async () => {
    const res = await adjustPost(jsonReq(ADJUST_URL, 'POST', {
      inventoryItemId: INV_ID, quantity: 5, type: 'write-off', reason: 'Odpis',
    }))
    const body = await res.json()
    expect(body.item).toBeDefined()
    expect(body.transaction).toBeDefined()
    expect(body.item.id).toBe(INV_ID)
  })
})

// ════════════════════════════════════════════════════════════════
// B. PUT/PATCH /api/inventory/[id] — tx-fresh diff pariteta
// ════════════════════════════════════════════════════════════════
describe('R106 B: PUT/PATCH [id] — kanon pariteta', () => {
  it('B1: PUT quantity → kanon (lock + Serializable)', async () => {
    const res = await invPUT(jsonReq(INV_URL, 'PUT', { quantity: 25 }), params(INV_ID))
    expect(res.status).toBe(200)
    expect(String(mocks.txExecuteRaw.mock.calls[0][0])).toContain('pg_advisory_xact_lock')
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    )
  })

  it('B2: PATCH quantity → isti kanon kot PUT', async () => {
    const res = await invPATCH(jsonReq(INV_URL, 'PATCH', { quantity: 25 }), params(INV_ID))
    expect(res.status).toBe(200)
    expect(String(mocks.txExecuteRaw.mock.calls[0][0])).toContain('pg_advisory_xact_lock')
    expect(mocks.txInvUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INV_ID },
        data: expect.objectContaining({ quantity: 25 }),
      })
    )
  })

  it('B3: diff izračunan iz TX-FRESH zaloge (stale existing NE določa audita)', async () => {
    // db-level (stale): 10 · tx-level (fresh): 30 · target: 25 → diff = -5
    // (prej: diff = +15 iz stale 10 → audit lažno prikazoval +15 pri dejanskih 25)
    mocks.invDbFindFirst.mockResolvedValue(makeItem({ quantity: 10 }))
    mocks.txInvFindFirst.mockResolvedValue(makeItem({ quantity: 30 }))
    await invPUT(jsonReq(INV_URL, 'PUT', { quantity: 25 }), params(INV_ID))
    expect(mocks.txStockTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantity: -5,
        previousQty: 30,
        newQty: 25,
      }),
    })
    expect(mocks.txInvUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INV_ID },
        data: expect.objectContaining({ quantity: 25 }),
      })
    )
    // negativna diff → brez lastRestocked (samo dostava/restock jo nastavi)
    expect(mocks.txInvUpdate.mock.calls[0][0].data.lastRestocked).toBeUndefined()
  })

  it('B4: metadata-only PUT (brez quantity) → brez tx, brez ključavnice', async () => {
    mocks.invDbUpdate.mockResolvedValue(makeItem())
    const res = await invPUT(jsonReq(INV_URL, 'PUT', { name: 'Kava 1kg Novo ime' }), params(INV_ID))
    expect(res.status).toBe(200)
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.invDbUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: INV_ID }, data: expect.objectContaining({ name: 'Kava 1kg Novo ime' }) })
    )
  })
})

// ════════════════════════════════════════════════════════════════
// C. POST /api/inventory/restock — kanon + skupni lock ključ
// ════════════════════════════════════════════════════════════════
describe('R106 C: restock — kanon + skupni per-item lock', () => {
  it('C1: restock → advisory lock + Serializable', async () => {
    const res = await restockPost(jsonReq(RESTOCK_URL, 'POST', {
      inventoryItemId: INV_ID, quantity: 5, reason: 'Dostava',
    }))
    expect(res.status).toBe(200)
    expect(String(mocks.txExecuteRaw.mock.calls[0][0])).toContain('pg_advisory_xact_lock')
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    )
  })

  it('C2: tx-fresh 404 (P2025 → 500 razred izničen) → strukturirana 404, zero pisanj', async () => {
    mocks.txInvFindFirst.mockResolvedValue(null)
    const res = await restockPost(jsonReq(RESTOCK_URL, 'POST', {
      inventoryItemId: INV_ID, quantity: 5, reason: 'Dostava',
    }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Zalogov artikel ni najden')
    expect(mocks.txInvUpdate).not.toHaveBeenCalled()
    expect(mocks.txStockTxCreate).not.toHaveBeenCalled()
  })

  it('C3: restock uspešen → increment + lastRestocked + costPerServing + sveža veriga', async () => {
    mocks.txInvFindFirst.mockResolvedValue(makeItem({ quantity: 20 }))
    const res = await restockPost(jsonReq(RESTOCK_URL, 'POST', {
      inventoryItemId: INV_ID, quantity: 5, reason: 'Dostava', supplierDoc: 'OT-2026-77',
    }))
    expect(res.status).toBe(200)
    expect(mocks.txInvUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INV_ID },
        data: expect.objectContaining({
          quantity: { increment: 5 },
          lastRestocked: expect.any(Date),
          costPerServing: 2, // 8 / 4 porcije
        }),
      })
    )
    expect(mocks.txStockTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'procurement',
        quantity: 5,
        previousQty: 20,
        newQty: 25,
        totalCost: 40,
        supplierDoc: 'OT-2026-77',
      }),
    })
  })

  it('C4: SKUPNI lock ključ čez adjust/restock/PUT — vsi pisci na istem hashtext', async () => {
    // adjust
    await adjustPost(jsonReq(ADJUST_URL, 'POST', {
      inventoryItemId: INV_ID, quantity: 1, type: 'write-off', reason: 'Odpis',
    }))
    // $executeRaw(templateStrings, value) — vrednost na indexu 1
    const adjustLock = mocks.txExecuteRaw.mock.calls[0][1]
    // restock
    await restockPost(jsonReq(RESTOCK_URL, 'POST', { inventoryItemId: INV_ID, quantity: 1, reason: 'Dostava' }))
    const restockLock = mocks.txExecuteRaw.mock.calls[1][1]
    // PUT [id]
    await invPUT(jsonReq(INV_URL, 'PUT', { quantity: 25 }), params(INV_ID))
    const putLock = mocks.txExecuteRaw.mock.calls[2][1]
    expect(adjustLock).toBe(`inv-stock:${INV_ID}`)
    expect(restockLock).toBe(`inv-stock:${INV_ID}`)
    expect(putLock).toBe(`inv-stock:${INV_ID}`)
  })

  it('C5: fast-path scope 404 — brez tx (WRITE IDOR politika ohranjena)', async () => {
    mocks.invDbFindFirst.mockResolvedValue(null)
    const res = await restockPost(jsonReq(RESTOCK_URL, 'POST', {
      inventoryItemId: INV_ID, quantity: 5, reason: 'Dostava',
    }))
    expect(res.status).toBe(404)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// D. fs-guardi — vir pini (kanon MORA biti v produkcijskih datotekah)
// ════════════════════════════════════════════════════════════════
describe('R106 D: fs-guardi — kanon pini v viru', () => {
  const ROOT = join(process.cwd(), 'src', 'app', 'api', 'inventory')
  const kanonSrc = readFileSync(join(ROOT, '_helpers', 'stock-mutations.ts'), 'utf8')
  const adjustSrc = readFileSync(join(ROOT, 'adjust', 'route.ts'), 'utf8')
  const restockSrc = readFileSync(join(ROOT, 'restock', 'route.ts'), 'utf8')
  const idSrc = readFileSync(join(ROOT, '[id]', 'route.ts'), 'utf8')

  it('D1: kanon vsebuje lock + Serializable + gte guard + strukturirane throw-e', () => {
    expect(kanonSrc).toContain('pg_advisory_xact_lock')
    expect(kanonSrc).toContain('Prisma.TransactionIsolationLevel.Serializable')
    expect(kanonSrc).toContain('quantity: { gte')
    expect(kanonSrc).toContain("status: 404")
    expect(kanonSrc).toContain('inventoryStockLockKey')
  })

  it('D2: rute uporabljajo kanon + structuredErrorResponse + P2034 catch', () => {
    expect(adjustSrc).toContain('adjustInventoryItemStock')
    expect(adjustSrc).toContain('structuredErrorResponse')
    expect(adjustSrc).toContain("code === 'P2034'")
    expect(restockSrc).toContain('restockInventoryItem')
    expect(restockSrc).toContain('structuredErrorResponse')
    expect(restockSrc).toContain("code === 'P2034'")
    expect(idSrc).toContain('setInventoryItemQuantity')
    expect(idSrc).toContain('structuredErrorResponse')
    expect(idSrc).toContain("code === 'P2034'")
  })

  it('D3: stari ranljivi vzorci IZBRISANI iz rut (unconditional stale-set kanon)', () => {
    // PUT/PATCH [id]: NE SME več imeti lastnega $transaction absolutnega set-a
    // iz stale diff-a (kanon ga je zamenjal)
    expect(idSrc).not.toContain('const diff = newQty - toNum(previousQty)')
    // adjust POST: NE SME več imeti NEPOGODJENEGA decrementa v lastnem tx telesu
    expect(adjustSrc).not.toContain('decrement: Math.abs(delta)')
    // restock: NE SME več imeti raw tx update brez scope-a
    expect(restockSrc).not.toContain('quantity: { increment: data.quantity }')
  })
})
