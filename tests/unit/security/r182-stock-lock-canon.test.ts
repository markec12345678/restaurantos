// ============================================
// R182 — A2: ENOTEN ZALOGOVNI LOCK KANON
//        acquireInvStockLocks čez prodajo / vračilo / prevzem
// ============================================
//
// Forenzika (A2 iz docs/BUSINESS-CHAIN.md): trije zalogovni pisalni tokovi
// so mutirali InventoryItem.quantity MIMO R106 ključa 'inv-stock:<itemId>':
//   - deduct-order (prodaja): SPLOH brez advisory ključavnice,
//   - return-stock: samo entitetna 'stock-return:<orderId>',
//   - PO receive: samo entitetna 'hashtext(poId)'.
// Cross-domena sočasnost (prodaja ∥ odpis, vračilo ∥ prevzem) se NI
// serializirala → preplet StockTransaction revizijskih vrstic (previousQty
// → newQty NI bil brezvsnežna veriga) + SSI abort-noise na R106 straneh.
//
// KANON (R182): acquireInvStockLocks (sortirano + dedup, listi grafa,
// POI entitetni ključavnici / CAS claim-u) v VSEH treh tokovih; R106
// re-export iz src/lib/stock-deduction/locks.ts (enoten vir).
//
// Pokritje: A runtime kanon (claim → locks(sorted) → mutacije; lost claim
// = brez ključavnic) · B helper enota (sort/dedup/null-filter/ključ) ·
// C fs-pini (vir pini + negativni pini stare divergentne vzorca).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { acquireInvStockLocks, inventoryStockLockKey } from '@/lib/stock-deduction/locks'

// --- Mocki (vi.hoisted) ---
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  dbOrderFindUnique: vi.fn(),
  txExecuteRaw: vi.fn(),
  txOrderUpdateMany: vi.fn(),
  txRecipeItemFindMany: vi.fn(),
  txInventoryItemFindFirst: vi.fn(),
  txInventoryItemFindUnique: vi.fn(),
  txInventoryItemUpdateMany: vi.fn(),
  txStockTransactionCreate: vi.fn(),
  recordBatchConsumption: vi.fn(),
}))

// Privzeti tx klient — kanon kliče db.$transaction(fn)
const txClient = {
  $executeRaw: mocks.txExecuteRaw,
  order: { updateMany: mocks.txOrderUpdateMany },
  recipeItem: { findMany: mocks.txRecipeItemFindMany },
  inventoryItem: {
    findFirst: mocks.txInventoryItemFindFirst,
    findUnique: mocks.txInventoryItemFindUnique,
    updateMany: mocks.txInventoryItemUpdateMany,
  },
  stockTransaction: { create: mocks.txStockTransactionCreate },
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mocks.transaction,
    order: { findUnique: mocks.dbOrderFindUnique },
  },
}))

vi.mock('@/lib/stock-deduction/batch-allocation', () => ({
  recordBatchConsumption: mocks.recordBatchConsumption,
  restoreBatchesFromAllocations: vi.fn(),
}))

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

// Testni tx klient je namerna podmnožica TransactionClient (mock) — cast za
// klice REALNEGA acquireInvStockLocks helperja (B skupina).
type TxClient = Parameters<typeof acquireInvStockLocks>[0]
const txAsClient = txClient as unknown as TxClient

const ORDER = {
  id: 'ord-1',
  locationId: 'loc-1',
  inventoryDeducted: false,
}

const ITEMS = [
  { menuItemId: 'm-pizza', quantity: 2, voided: false },
  { menuItemId: 'm-solata', quantity: 1, voided: true },
  { menuItemId: 'm-wine', quantity: 1, voided: false },
]

const RECIPE_ROWS = [
  { inventoryItemId: 'ing-b', quantityPerServing: 0.5, yieldPercent: 100 },
  { inventoryItemId: 'ing-a', quantityPerServing: 0.2, yieldPercent: 100 },
]

function defaultTx() {
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient))
  mocks.dbOrderFindUnique.mockResolvedValue(ORDER)
  mocks.txOrderUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txRecipeItemFindMany.mockImplementation(async (args: { where: { menuItemId: string } }) =>
    args.where.menuItemId === 'm-pizza' ? RECIPE_ROWS : []
  )
  mocks.txInventoryItemFindFirst.mockResolvedValue({
    id: 'dir-c', name: 'Wine', quantity: 10, minQuantity: 1,
    costPerUnit: 2, servingsPerUnit: 1.5, locationId: 'loc-1',
  })
  mocks.txInventoryItemFindUnique.mockResolvedValue({
    id: 'ing-x', name: 'Ing', quantity: 10, minQuantity: 2,
    costPerUnit: 1, servingsPerUnit: 1, locationId: 'loc-1',
  })
  mocks.txInventoryItemUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txStockTransactionCreate.mockResolvedValue({ id: 'stx-1' })
  mocks.recordBatchConsumption.mockResolvedValue(undefined)
}

/** Izvleči inv-stock ključe iz tagged-template $executeRaw klicev. */
function capturedLockKeys(): string[] {
  return mocks.txExecuteRaw.mock.calls.map((c: unknown[]) => c[1] as string)
}

describe('R182 · A — deduct-order runtime kanon (claim → locks → mutacije)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    defaultTx()
  })

  it('A1: ključavnice so SORTIRANE + deduplicirane, med claimom in prvo mutacijo', async () => {
    const { deductStockForOrder } = await import('@/lib/stock-deduction/deduct-order')
    const result = await deductStockForOrder('ord-1', 7, ITEMS)

    // pre-pass: voided preskočen; recipe artikli ('ing-a','ing-b') + direct ('dir-c')
    expect(capturedLockKeys()).toEqual(['inv-stock:dir-c', 'inv-stock:ing-a', 'inv-stock:ing-b'])

    // VRSTNI RED: CAS claim → inv-stock ključavnice → prva zaloga mutacija
    const claimOrder = mocks.txOrderUpdateMany.mock.invocationCallOrder[0]
    const firstLock = Math.min(...mocks.txExecuteRaw.mock.invocationCallOrder)
    const firstMutation = Math.min(...mocks.txInventoryItemUpdateMany.mock.invocationCallOrder)
    expect(claimOrder).toBeLessThan(firstLock)
    expect(firstLock).toBeLessThan(firstMutation)

    // dedukcijska semantika NI spremenjena: 2 recipe + 1 direct vrstica
    expect(result.deducted).toHaveLength(3)
    expect(result.deducted.filter((d) => d.method === 'recipe')).toHaveLength(2)
    expect(result.deducted.filter((d) => d.method === 'direct')).toHaveLength(1)
  })

  it('A2: izgubljen CAS claim (count=0) → NI ključavnic, NI mutacij (no-op tx)', async () => {
    mocks.txOrderUpdateMany.mockResolvedValue({ count: 0 })
    const { deductStockForOrder } = await import('@/lib/stock-deduction/deduct-order')
    const result = await deductStockForOrder('ord-1', 7, ITEMS)

    expect(mocks.txExecuteRaw).not.toHaveBeenCalled()
    expect(mocks.txInventoryItemUpdateMany).not.toHaveBeenCalled()
    expect(result.deducted).toHaveLength(0)
  })

  it('A3: že razknjiženo (inventoryDeducted) → zgodnji izhod brez tx ključavnic', async () => {
    mocks.dbOrderFindUnique.mockResolvedValue({ ...ORDER, inventoryDeducted: true })
    const { deductStockForOrder } = await import('@/lib/stock-deduction/deduct-order')
    await deductStockForOrder('ord-1', 7, ITEMS)

    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.txExecuteRaw).not.toHaveBeenCalled()
  })
})

describe('R182 · B — acquireInvStockLocks enota', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('B1: sortira, deduplicira in filtrira null/undefined id-je', async () => {
    await acquireInvStockLocks(txAsClient, ['b', null, 'a', 'b', undefined])
    expect(capturedLockKeys()).toEqual(['inv-stock:a', 'inv-stock:b'])
  })

  it('B2: prazen vnos → nič klicev', async () => {
    await acquireInvStockLocks(txAsClient, [])
    expect(mocks.txExecuteRaw).not.toHaveBeenCalled()
  })

  it('B3: ključni format = R106 kanon', () => {
    expect(inventoryStockLockKey('inv-42')).toBe('inv-stock:inv-42')
  })
})

describe('R182 · C — fs-pini (enoten lock vesolj + negativni pini)', () => {
  it('C1: locks.ts — kanon struktura (advisory lock + sort + dedup + oba eksporta)', () => {
    const src = read('src/lib/stock-deduction/locks.ts')
    expect(src).toContain('pg_advisory_xact_lock')
    expect(src).toContain(".sort()")
    expect(src).toContain('new Set(')
    expect(src).toContain('export function inventoryStockLockKey')
    expect(src).toContain('export async function acquireInvStockLocks')
    // listi grafa: null/undefined filter (PO postavke brez zalogo povezave)
    expect(src).toContain('!!id')
  })

  it('C2: stock-mutations.ts — ključ ŽIVI v locks.ts (re-export, ne lokalna definicija)', () => {
    const src = read('src/app/api/inventory/_helpers/stock-mutations.ts')
    expect(src).toContain("export { inventoryStockLockKey }")
    expect(src).toContain("from '@/lib/stock-deduction/locks'")
    expect(src).not.toContain('export function inventoryStockLockKey')
  })

  it('C3: deduct-order — pre-pass resolucija + ključavnice PRED deductRecipeItems', () => {
    const src = read('src/lib/stock-deduction/deduct-order.ts')
    expect(src).toContain('acquireInvStockLocks')
    expect(src).toContain('recipeItem.findMany')
    // pre-pass mirror direktne resolucije (lokacija naročila + servings guard)
    expect(src).toContain('servingsPerUnit')
    expect(src.indexOf('acquireInvStockLocks(tx')).toBeLessThan(src.indexOf('deductRecipeItems('))
    // NEGATIVNI pin: orchestrator NE mutira zaloge direktno (samo prek helperjev)
    expect(src).not.toContain('inventoryItem.update(')
  })

  it('C4: return-stock — ključavnice PRED prvo mutacijo, v OBEH poteh (snapshot + legacy)', () => {
    const src = read('src/lib/stock-deduction/return-stock.ts')
    const firstLock = src.indexOf('acquireInvStockLocks')
    const firstMutation = src.indexOf('inventoryItem.update(')
    expect(src).toContain('stock-return:')
    expect(firstLock).toBeGreaterThan(-1)
    expect(firstMutation).toBeGreaterThan(firstLock)
    // snapshot pot + legacy pot = vsaj 2 klica
    expect(src.split('acquireInvStockLocks').length - 1).toBeGreaterThanOrEqual(2)
  })

  it('C5: PO receive — ključavnice PRED item zanko (po poId entitetni ključavnici)', () => {
    const src = read('src/app/api/purchase-orders/[id]/_helpers.ts')
    expect(src).toContain('acquireInvStockLocks')
    expect(src.indexOf('acquireInvStockLocks')).toBeLessThan(
      src.indexOf('for (const receivedItem of receivedItems)')
    )
    // entitetna ključavnica ostane PRVA (listi grafa prihajajo za njo) —
    // primerjava KLIČEV (ne import vrstice)
    expect(src.indexOf('hashtext(${poId})')).toBeLessThan(src.indexOf('await acquireInvStockLocks('))
  })

  it('C6: atomarni pogojni decrement GUARD je ohranjen (updateMany gte) v obeh helperjih', () => {
    expect(read('src/lib/stock-deduction/deduct-recipe.ts')).toContain('quantity: { gte:')
    expect(read('src/lib/stock-deduction/deduct-direct.ts')).toContain('quantity: { gte:')
  })

  it('C7: enoten lock vesolj — R106 konzumenti še vedno referencirajo isti ključ', () => {
    expect(read('src/app/api/waste/_helpers/waste-mutations.ts')).toContain('inventoryStockLockKey')
    expect(read('src/app/api/stocktakes/_helpers/stocktake-mutations.ts')).toContain('inventoryStockLockKey')
    expect(read('src/app/api/batch-preparations/_helpers/batch-preparation-mutations.ts')).toContain('inventoryStockLockKey')
  })
})
