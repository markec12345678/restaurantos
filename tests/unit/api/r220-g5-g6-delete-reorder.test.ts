// ============================================
// #152 korak 2 (R220) — G5 DELETE ARTIKLA + G6 REORDER AUTO-PREVZEM NA KANON PARITETI
// ============================================
// Vrzel G5 (docs/INVENTORY-CHAIN.md §5): DELETE /api/inventory/[id] (soft-delete,
// quantity → 0 + write-off StockTx) je bil 6. zalogovni pisec MIMO R182 kanona —
// BREZ advisory ključavnice, stale pre-tx quantity na previousQty (sočasna prodaja
// med readom in tx = prekinjena §21 ledger kontinuiteta) in BREZ audit vnosa.
//
// Vrzel G6: reorder create-order (avto-prevzem) je bil 7. pisec mimo kanona —
// increment je kvantiteto varen, ampak BREZ ključavnice se revizijski vrstici
// dveh sočasnih prevzemov ISTEGA artikla lahko prepleteta (update A → update B →
// create B → create A → §21 veriga prelomljena).
//
// FIX (kanon pariteta — R214 G4 / R218 G3 vzorec): G5 dobi acquireInvStockLocks
// PRED tx-fresh scoped re-read in CAS updateMany (where quantity == tx-fresh
// vrednost; 0 vrstic → strukturirani 409) + INVENTORY_DELETE audit + P2002/P2034
// → 409 error kontrakt + Serializable TX_OPTS; G6 dobi acquireInvStockLocks za
// VSE validne artikle PRED prvim incrementom (sort+dedup v helperju).
//
// Tukaj fs-pini + runtime call-order pini. Kanonski EFEKT (realna baza —
// write-off chain, audit vrstica, procurement chain) v IT drillu
// (tests/integration/r209-inventory-chain-drill.test.ts — R220 G5+G6 describe).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const m = vi.hoisted(() => ({
  acquireLocks: vi.fn().mockResolvedValue(undefined),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  requireAuth: vi.fn(),
  resolveScope: vi.fn(),
  preInvFindFirst: vi.fn(),
  menuItemFindUnique: vi.fn(),
  recipeFindMany: vi.fn(),
  preInvFindMany: vi.fn(),
  dbTransaction: vi.fn().mockResolvedValue(undefined),
  txFindFirst: vi.fn(),
  txUpdateMany: vi.fn(),
  txStockTxCreate: vi.fn(),
  txUpdate: vi.fn(),
  txStockTxCreateReorder: vi.fn(),
}))

// realne implementacije ohranjene za canonical sort+dedup pin (G6 test)
const locksActual = vi.hoisted(() => ({
  real: null as null | { acquireInvStockLocks: unknown; inventoryStockLockKey: unknown },
}))

vi.mock('@/lib/stock-deduction/locks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stock-deduction/locks')>()
  locksActual.real = actual as { acquireInvStockLocks: unknown; inventoryStockLockKey: unknown }
  return {
    ...actual,
    acquireInvStockLocks: m.acquireLocks,
  }
})
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: m.dbTransaction,
    inventoryItem: { findFirst: m.preInvFindFirst, findMany: m.preInvFindMany },
    menuItem: { findUnique: m.menuItemFindUnique },
    recipeItem: { findMany: m.recipeFindMany },
  },
  createAuditLog: m.createAuditLog,
}))
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: m.requireAuth,
  resolveTenantLocationIdOrThrow: m.resolveScope,
}))

import { handleDeleteInventory } from '@/app/api/inventory/[id]/_helpers'
import { createReorderOrder } from '@/app/api/inventory/reorder/_helpers/create-order'

const REPO_ROOT = process.cwd()
const SRC = {
  g5: 'src/app/api/inventory/[id]/_helpers.ts',
  g6: 'src/app/api/inventory/reorder/_helpers/create-order.ts',
}
const read = (p: string) => readFileSync(join(REPO_ROOT, p), 'utf-8')

// ---------- G5: fs-pini ----------
describe('R220 G5: fs-pini — DELETE artikel na kanon pariteti', () => {
  const src = () => read(SRC.g5)

  it('importira in kliče acquireInvStockLocks (kanon R182 — prej 6. pisec mimo vesolja)', () => {
    const s = src()
    expect(s).toContain("from '@/lib/stock-deduction/locks'")
    expect(s).toContain('acquireInvStockLocks(tx, [id])')
  })

  it('red v tx telesu: ključavnica → tx-fresh re-read → CAS updateMany (deadlock nemogoč, stale read izločen)', () => {
    const s = src()
    const lockIdx = s.indexOf('await acquireInvStockLocks(tx, [id])')
    const freshIdx = s.indexOf('await tx.inventoryItem.findFirst(')
    const casIdx = s.indexOf('await tx.inventoryItem.updateMany(')
    expect(lockIdx).toBeGreaterThan(-1)
    expect(freshIdx).toBeGreaterThan(-1)
    expect(casIdx).toBeGreaterThan(-1)
    expect(lockIdx, 'ključavnica MORA biti pred tx-fresh re-readom').toBeLessThan(freshIdx)
    expect(freshIdx, 'tx-fresh re-read MORA biti pred CAS mutacijo').toBeLessThan(casIdx)
    // stale pre-tx read ni več vir previousQty (tx-fresh `fresh.quantity`)
    expect(s).toContain('const previousQty = toNum(fresh.quantity)')
  })

  it('CAS equality (where quantity == tx-fresh vrednost) + 0 vrstic → strukturirani 409', () => {
    const s = src()
    expect(s).toContain('where: { id, quantity: fresh.quantity }')
    expect(s).toContain("status: 409")
    expect(s).toContain('Brisanje zaloge je v obdelavi (sočasen dostop)')
  })

  it('Serializable TX_OPTS (pariteta s stock-mutations / R214 G4) — redka operacija, brez vroče poti', () => {
    const s = src()
    expect(s).toContain('Prisma.TransactionIsolationLevel.Serializable')
    expect(s).toContain('}, TX_OPTS)')
  })

  it('audit INVENTORY_DELETE + error kontrakt P2002/P2034 → 409 (pariteta s stockRaceErrorResponse)', () => {
    const s = src()
    expect(s).toContain("action: 'INVENTORY_DELETE'")
    expect(s).toContain('createAuditLog({')
    expect(s).toContain("error.code === 'P2002' || error.code === 'P2034'")
    expect(s).toContain("structuredErrorResponse(error, 'DELETE /api/inventory/[id]'")
  })
})

// ---------- G5: runtime call-order ----------
describe('R220 G5: runtime call-order — handleDeleteInventory', () => {
  const ITEM_ID = 'inv-del-1'
  const txClient = {
    inventoryItem: {
      findFirst: m.txFindFirst,
      updateMany: m.txUpdateMany,
    },
    stockTransaction: { create: m.txStockTxCreate },
  }

  function primeBase() {
    m.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'OWNER', locationId: 'loc-1', permissions: ['manage_inventory'] },
      error: null,
    })
    m.resolveScope.mockReturnValue({ locationId: 'loc-1' })
    m.dbTransaction.mockImplementation(async (fn: (tx: typeof txClient) => Promise<unknown>) => fn(txClient))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    m.acquireLocks.mockResolvedValue(undefined)
    m.createAuditLog.mockResolvedValue(undefined)
    m.txFindFirst.mockResolvedValue({ id: ITEM_ID, name: 'Test artikel', quantity: 5, costPerUnit: 3 })
    m.txUpdateMany.mockResolvedValue({ count: 1 })
    m.txStockTxCreate.mockResolvedValue({ id: 'stx-1' })
  })

  it('uspeh: locks → tx-fresh re-read → CAS → write-off StockTx z tx-fresh previousQty → INVENTORY_DELETE audit', async () => {
    primeBase()
    m.preInvFindFirst.mockResolvedValue({
      id: ITEM_ID, name: 'Test artikel', quantity: 4, costPerUnit: 3, menuItemId: null, transactions: [],
    })
    m.recipeFindMany.mockResolvedValue([])

    const res = await handleDeleteInventory(
      new Request(`http://local/api/inventory/${ITEM_ID}`, { method: 'DELETE' }),
      ITEM_ID
    )
    expect(res.status).toBe(200)

    // ključavnica: EN klic, [id], PRED re-readom in mutacijo
    expect(m.acquireLocks).toHaveBeenCalledTimes(1)
    expect(m.acquireLocks).toHaveBeenCalledWith(txClient, [ITEM_ID])
    const lockOrder = m.acquireLocks.mock.invocationCallOrder[0]
    expect(m.txFindFirst.mock.invocationCallOrder[0]).toBeGreaterThan(lockOrder)
    expect(m.txUpdateMany.mock.invocationCallOrder[0]).toBeGreaterThan(m.txFindFirst.mock.invocationCallOrder[0])
    expect(m.txStockTxCreate.mock.invocationCallOrder[0]).toBeGreaterThan(m.txUpdateMany.mock.invocationCallOrder[0])
    expect(m.createAuditLog.mock.invocationCallOrder[0]).toBeGreaterThan(m.txStockTxCreate.mock.invocationCallOrder[0])

    // CAS equality nad tx-fresh vrednostjo 5 (ne stale pre-tx 4)
    expect(m.txUpdateMany).toHaveBeenCalledTimes(1)
    const cas = m.txUpdateMany.mock.calls[0][0]
    expect(cas.where).toEqual({ id: ITEM_ID, quantity: 5 })
    expect(cas.data).toEqual({ quantity: 0, menuItemId: null })

    // write-off StockTx: tx-fresh previousQty 5 (prej bi bil stale 4), newQty 0
    expect(m.txStockTxCreate).toHaveBeenCalledTimes(1)
    const data = m.txStockTxCreate.mock.calls[0][0].data
    expect(data.type).toBe('write-off')
    expect(Number(data.quantity)).toBe(-5)
    expect(Number(data.previousQty)).toBe(5)
    expect(Number(data.newQty)).toBe(0)
    expect(Number(data.totalCost)).toBe(15) // 5 × 3.00
    expect(data.reason).toBe('Izbris artikla iz zaloge')
    expect(data.employeeId).toBe('emp-1')

    // audit: INVENTORY_DELETE z tx-fresh details ( isti shape kot INVENTORY_ADJUST)
    expect(m.createAuditLog).toHaveBeenCalledTimes(1)
    const audit = m.createAuditLog.mock.calls[0][0]
    expect(audit.action).toBe('INVENTORY_DELETE')
    expect(audit.entityType).toBe('InventoryItem')
    expect(audit.entityId).toBe(ITEM_ID)
    expect(Number(audit.details.previousQty)).toBe(5)
    expect(Number(audit.details.newQty)).toBe(0)
    expect(Number(audit.details.quantity)).toBe(-5)
    expect(audit.details.itemName).toBe('Test artikel')

    // Serializable TX_OPTS podan $transaction klicu
    expect(m.dbTransaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' })
  })

  it('CAS 0 vrstic → 409, BREZ StockTx in BREZ audita (nikoli tiho prepisovanje)', async () => {
    primeBase()
    m.preInvFindFirst.mockResolvedValue({ id: ITEM_ID, quantity: 5, costPerUnit: 3, menuItemId: null })
    m.recipeFindMany.mockResolvedValue([])
    m.txUpdateMany.mockResolvedValue({ count: 0 })

    const res = await handleDeleteInventory(
      new Request(`http://local/api/inventory/${ITEM_ID}`, { method: 'DELETE' }),
      ITEM_ID
    )
    expect(res.status).toBe(409)
    expect(m.txStockTxCreate).not.toHaveBeenCalled()
    expect(m.createAuditLog).not.toHaveBeenCalled()
  })

  it('tx-fresh 404 (sočasna sprememba) → strukturirani 404, brez mutacije', async () => {
    primeBase()
    m.preInvFindFirst.mockResolvedValue({ id: ITEM_ID, quantity: 5, costPerUnit: 3, menuItemId: null })
    m.recipeFindMany.mockResolvedValue([])
    m.txFindFirst.mockResolvedValue(null)

    const res = await handleDeleteInventory(
      new Request(`http://local/api/inventory/${ITEM_ID}`, { method: 'DELETE' }),
      ITEM_ID
    )
    expect(res.status).toBe(404)
    expect(m.txUpdateMany).not.toHaveBeenCalled()
    expect(m.txStockTxCreate).not.toHaveBeenCalled()
    expect(m.createAuditLog).not.toHaveBeenCalled()
  })

  it('aktivna meni povezava → 400 PRED tx (brez ključavnic, brez mutacije — entitetni kontekst)', async () => {
    primeBase()
    m.preInvFindFirst.mockResolvedValue({ id: ITEM_ID, quantity: 5, costPerUnit: 3, menuItemId: 'mi-1' })
    m.menuItemFindUnique.mockResolvedValue({ id: 'mi-1', isAvailable: true })

    const res = await handleDeleteInventory(
      new Request(`http://local/api/inventory/${ITEM_ID}`, { method: 'DELETE' }),
      ITEM_ID
    )
    expect(res.status).toBe(400)
    expect(m.dbTransaction).not.toHaveBeenCalled()
    expect(m.acquireLocks).not.toHaveBeenCalled()
  })
})

// ---------- G6: fs-pini + runtime ----------
describe('R220 G6: reorder auto-prevzem na kanon pariteti', () => {
  it('fs-pin: acquireInvStockLocks PRED prvim incrementom (prej 7. pisec mimo vesolja)', () => {
    const s = read(SRC.g6)
    expect(s).toContain("from '@/lib/stock-deduction/locks'")
    const lockIdx = s.indexOf('await acquireInvStockLocks(tx, validItems.map(')
    const incIdx = s.indexOf('quantity: { increment: item.quantity }')
    expect(lockIdx).toBeGreaterThan(-1)
    expect(incIdx).toBeGreaterThan(-1)
    expect(lockIdx, 'ključavnice MORAJO biti pred prvim incrementom').toBeLessThan(incIdx)
    // znotraj $transaction telesa (entity kontekst — scoped findMany — ostaja pred tx)
    const txIdx = s.indexOf('await db.$transaction(')
    expect(lockIdx).toBeGreaterThan(txIdx)
  })

  it('runtime: locks (sortiran seznam) → increment → procurement StockTx z odvedenim previousQty (§21 veriga)', async () => {
    const txClient = {
      inventoryItem: { update: m.txUpdate },
      stockTransaction: { create: m.txStockTxCreateReorder },
    }
    vi.clearAllMocks()
    m.acquireLocks.mockResolvedValue(undefined)
    m.dbTransaction.mockImplementation(async (fn: (tx: typeof txClient) => Promise<unknown>) => fn(txClient))
    m.preInvFindMany.mockResolvedValue([
      { id: 'inv-b', name: 'B artikel', quantity: 2, costPerUnit: 2 },
      { id: 'inv-a', name: 'A artikel', quantity: 1, costPerUnit: 1 },
    ])
    // update vrača post-increment vrednost: inv-b 2+3=5, inv-a 1+4=5
    m.txUpdate.mockResolvedValueOnce({ quantity: 5 }).mockResolvedValueOnce({ quantity: 5 })
    m.txStockTxCreateReorder.mockResolvedValue({ id: 'stx-ro-1' })

    const out = await createReorderOrder(
      [
        { inventoryItemId: 'inv-b', quantity: 3, costPerUnit: 2 },
        { inventoryItemId: 'inv-a', quantity: 4, costPerUnit: 1 },
      ],
      'farmacevt',
      'loc-1',
      'emp-1'
    )
    expect(out.errors).toHaveLength(0)
    expect(out.results).toHaveLength(2)

    // ključavnice: seznam VSEH validnih artiklov (input order — sortiranje je
    // delo REALNEGA helperja, piniranega v canonical testu spodaj), PRED prvim updateom
    expect(m.acquireLocks).toHaveBeenCalledTimes(1)
    expect(m.acquireLocks).toHaveBeenCalledWith(txClient, ['inv-b', 'inv-a'])
    const lockOrder = m.acquireLocks.mock.invocationCallOrder[0]
    expect(m.txUpdate.mock.invocationCallOrder[0]).toBeGreaterThan(lockOrder)

    // StockTx: previousQty odveden iz post-vrednosti − delta (aritmetično točen
    // ne glede na concurrency), pod ključavnico pa je tudi chain-continuous
    expect(m.txStockTxCreateReorder).toHaveBeenCalledTimes(2)
    const first = m.txStockTxCreateReorder.mock.calls[0][0].data
    expect(first.type).toBe('procurement')
    expect(Number(first.quantity)).toBe(3)
    expect(Number(first.previousQty)).toBe(2)
    expect(Number(first.newQty)).toBe(5)
    expect(first.reason).toContain('Samodejno naročilo')
    expect(first.employeeId).toBe('emp-1')
    const second = m.txStockTxCreateReorder.mock.calls[1][0].data
    expect(Number(second.quantity)).toBe(4)
    expect(Number(second.previousQty)).toBe(1)
    expect(Number(second.newQty)).toBe(5)

    // results shape (itemName iz pre-check mape, round2 totalCost)
    expect(out.results[0]).toMatchObject({ inventoryItemId: 'inv-b', itemName: 'B artikel', quantity: 3 })
    expect(Number(out.results[0].totalCost)).toBe(6) // 3 × 2.00
    expect(Number(out.results[1].totalCost)).toBe(4) // 4 × 1.00
  })

  it('runtime: artikel izven scope-a → error, IZKLJUČEN iz ključavnic (null-skip pariteta, fail-closed)', async () => {
    const txClient = {
      inventoryItem: { update: m.txUpdate },
      stockTransaction: { create: m.txStockTxCreateReorder },
    }
    vi.clearAllMocks()
    m.acquireLocks.mockResolvedValue(undefined)
    m.dbTransaction.mockImplementation(async (fn: (tx: typeof txClient) => Promise<unknown>) => fn(txClient))
    // scoped pre-check: tuji artikel NI vrnjen (fail-closed, R85-4c)
    m.preInvFindMany.mockResolvedValue([{ id: 'inv-a', name: 'A artikel', quantity: 1, costPerUnit: 1 }])
    m.txUpdate.mockResolvedValueOnce({ quantity: 3 })
    m.txStockTxCreateReorder.mockResolvedValue({ id: 'stx-ro-2' })

    const out = await createReorderOrder(
      [
        { inventoryItemId: 'inv-foreign', quantity: 1, costPerUnit: 9 },
        { inventoryItemId: 'inv-a', quantity: 2, costPerUnit: 1 },
      ],
      '',
      'loc-1',
      'emp-1'
    )
    expect(out.errors).toEqual([{ inventoryItemId: 'inv-foreign', error: 'Artikel ni najden' }])
    expect(out.results).toHaveLength(1)

    // ključavnice SAMO za validne artikle (tuji id ne pride v vesolj)
    expect(m.acquireLocks).toHaveBeenCalledWith(txClient, ['inv-a'])
    expect(m.txUpdate).toHaveBeenCalledTimes(1)
    expect(m.txStockTxCreateReorder).toHaveBeenCalledTimes(1)
  })

  it('canonical: REALNI acquireInvStockLocks sortira + dedupira + preskoči null (kanon R182 — G6 seznam gre skozi vesolj)', async () => {
    const real = locksActual.real as {
      acquireInvStockLocks: (tx: unknown, ids: (string | null | undefined)[]) => Promise<void>
      inventoryStockLockKey: (id: string) => string
    }
    expect(real).not.toBeNull()
    const exec = vi.fn().mockResolvedValue(undefined)
    const tx = { $executeRaw: exec }

    await real.acquireInvStockLocks(tx, ['inv-b', 'inv-a', 'inv-b', null, undefined])

    // dedup: 3 vnosa → 2 unikatna id-ja; null/undefined tiho preskočena
    expect(exec).toHaveBeenCalledTimes(2)
    // sortiran globalni vrstni red: inv-a PRED inv-b (deadlock nemogoč);
    // interpoliran argument = kanonski ključ inv-stock:<id> (R106)
    expect(exec.mock.calls[0][1]).toBe('inv-stock:inv-a')
    expect(exec.mock.calls[1][1]).toBe('inv-stock:inv-b')
  })
})
