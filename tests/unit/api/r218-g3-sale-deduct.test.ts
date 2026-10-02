// ============================================
// #152 korak 2 (R218) — G3 QR/ONLINE/GLOVO/WOLT ODVODNI TOKOVI NA KANON PARITETI
// ============================================
// Vrzel G3 (docs/INVENTORY-CHAIN.md §5): štirje odvodni pisci (QR public/order,
// online public/online-order, glovo/wolt webhook) so bili pre-R182 kanon izjema —
// BREZ advisory ključavnic (inv-stock:<itemId>), QR dodatno BREZ FEFO
// recordBatchConsumption (unbatched uhajanje) in BREZ orderId na sale StockTx
// (G2 createdAt fallback — neskladno z ostalimi tremi sale pisci).
//
// FIX (kanon pariteta): vsi štirje pisci acquireInvStockLocks (sortirano +
// dedup, PRED prvo mutacijo InventoryItem.quantity — deadlock nemogoč; sale
// path ostane Read Committed po locks.ts kanonu — Serializable bi dodal P2034
// retry-noise na vroči prodajni poti); QR dobi recordBatchConsumption (FEFO,
// R120 hook) + orderId (G2 kanon pariteta, usklajeno z R216). Kiosk pot
// (public/kiosk — 5. pisec prek istega deductInventoryInTx) podeduje fix.
//
// Tukaj fs-pini + runtime call-order pini. Kanonski EFEKT (realna baza —
// FEFO razporeditev po serijah, orderId na StockTx, roll-back pri 409) v IT
// drillu (tests/integration/r209-inventory-chain-drill.test.ts — R218 G3
// describe).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const m = vi.hoisted(() => ({
  acquireLocks: vi.fn().mockResolvedValue(undefined),
  recordConsumption: vi.fn().mockResolvedValue(undefined),
  txExecuteRaw: vi.fn(),
  menuItemFindUnique: vi.fn(),
  invItemFindUnique: vi.fn(),
  invItemUpdateMany: vi.fn(),
  stockTxCreate: vi.fn(),
  orderUpdate: vi.fn(),
  txTransaction: vi.fn(),
}))

vi.mock('@/lib/stock-deduction/locks', () => ({
  acquireInvStockLocks: m.acquireLocks,
  inventoryStockLockKey: (id: string) => `inv-stock:${id}`,
}))
vi.mock('@/lib/stock-deduction/batch-allocation', () => ({
  recordBatchConsumption: m.recordConsumption,
}))
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: m.txTransaction,
  },
}))

import { deductInventoryInTx } from '@/app/api/public/order/_helpers/order-calculations'
import { deductInventoryForOrder as glovoDeduct } from '@/app/api/delivery/webhook/glovo/_helpers/glovo-inventory'

const REPO_ROOT = process.cwd()
const SRC = {
  qr: 'src/app/api/public/order/_helpers/order-calculations.ts',
  online: 'src/app/api/public/online-order/_helpers/deduct-inventory.ts',
  glovo: 'src/app/api/delivery/webhook/glovo/_helpers/glovo-inventory.ts',
  wolt: 'src/app/api/delivery/webhook/wolt/_helpers/wolt-inventory.ts',
  kiosk: 'src/app/api/public/kiosk/route.ts',
}
const read = (p: string) => readFileSync(join(REPO_ROOT, p), 'utf-8')

const G3_WRITERS = [SRC.qr, SRC.online, SRC.glovo, SRC.wolt] as const

describe('R218 G3: fs-pini — vsi 4 odvodni pisci na kanon pariteti', () => {
  it('vsak od 4 pisci importira in kliče acquireInvStockLocks (kanon R182)', () => {
    for (const p of G3_WRITERS) {
      const src = read(p)
      expect(src, p).toContain("from '@/lib/stock-deduction/locks'")
      expect(src, p).toContain('acquireInvStockLocks(')
    }
  })

  it('ključavnice so PRED prvo mutacijo InventoryItem.quantity (indexOf red — deadlock nemogoč)', () => {
    for (const p of G3_WRITERS) {
      const src = read(p)
      const lockIdx = src.indexOf('await acquireInvStockLocks(')
      const firstDecrement = src.indexOf('quantity: { decrement: deductQty }')
      expect(lockIdx, p).toBeGreaterThan(-1)
      expect(firstDecrement, p).toBeGreaterThan(-1)
      expect(lockIdx, `${p}: acquireInvStockLocks MORA biti pred prvim decrementom`).toBeLessThan(firstDecrement)
    }
  })

  it('QR: FEFO recordBatchConsumption je povezan (unbatched uhajanje zaprto — §5 G3)', () => {
    const src = read(SRC.qr)
    expect(src).toContain("from '@/lib/stock-deduction/batch-allocation'")
    expect(src).toContain('recordBatchConsumption(tx, {')
    // FEFO klic je ZUNAJ pogojnega decrementa (v .then na StockTx createju — R120 vzorec)
    expect(src.indexOf('recordBatchConsumption(tx, {')).toBeGreaterThan(src.indexOf('quantity: { decrement: deductQty }'))
  })

  it('QR: sale StockTx nosi orderId (G2 kanon pariteta — prej edini sale pisec brez njega)', () => {
    const src = read(SRC.qr)
    // orderId je v StockTx create data (deductInventoryInTx) — pin kot parametriziran nosilec
    expect(src).toContain('orderId,')
    // klicna pot route posreduje newOrder.id
    const route = read('src/app/api/public/order/route.ts')
    expect(route).toContain('deductInventoryInTx(tx, items, menuItemMap, nextOrderNumber, newOrder.id)')
  })

  it('kiosk (5. pisec prek deductInventoryInTx): posreduje newOrder.id (G2 pariteta + podedovan fix)', () => {
    const src = read(SRC.kiosk)
    expect(src).toContain('deductInventoryInTx(tx, data!.orderItems, new Map(menuItems.map(mi => [mi.id, mi])), nextOrderNumber, newOrder.id)')
  })

  it('glovo/wolt mirror ostaja sinhroniziran (oba pre-fetch + locks pred zanko)', () => {
    const glovo = read(SRC.glovo)
    const wolt = read(SRC.wolt)
    for (const src of [glovo, wolt]) {
      expect(src).toContain('const loadMenuItem = (id: string) =>')
      expect(src.indexOf('await acquireInvStockLocks(')).toBeGreaterThan(src.indexOf('const menuMap = new Map'))
      expect(src.indexOf('await acquireInvStockLocks(')).toBeLessThan(src.indexOf('for (const item of orderItems) {\n      const menuItem = menuMap.get(item.menuItemId)'))
    }
  })
})

describe('R218 G3: runtime call-order — QR deductInventoryInTx', () => {
  const menuItemMap = new Map([
    ['mi-1', {
      id: 'mi-1',
      name: 'G3 Artikel',
      recipeItems: [{
        quantityPerServing: 0.25,
        yieldPercent: 50,
        inventoryItem: { id: 'inv-b', quantity: 5, costPerUnit: 2, unit: 'kg' },
      }],
    }],
  ])
  const items = [{ menuItemId: 'mi-1', quantity: 2 }]

  function makeTx(updateCount: number) {
    return {
      inventoryItem: {
        findUnique: m.invItemFindUnique,
        updateMany: m.invItemUpdateMany,
      },
      stockTransaction: { create: m.stockTxCreate },
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    m.acquireLocks.mockResolvedValue(undefined)
    m.recordConsumption.mockResolvedValue(undefined)
    m.invItemFindUnique.mockResolvedValue({ quantity: 5, costPerUnit: 2, unit: 'kg' })
    m.invItemUpdateMany.mockResolvedValue({ count: 1 })
    m.stockTxCreate.mockResolvedValue({ id: 'stx-g3' })
  })

  it('uspeh: locks → tx-fresh read → pogojni decrement → StockTx (orderId!) → FEFO', async () => {
    const tx = makeTx(1)
    await deductInventoryInTx(tx as never, items, menuItemMap, 77, 'ord-g3')

    // locks: dedup + sortiran seznam (helper pin — vsi receptni artikli)
    expect(m.acquireLocks).toHaveBeenCalledTimes(1)
    expect(m.acquireLocks).toHaveBeenCalledWith(tx, ['inv-b'])

    // red: acquireInvStockLocks < findUnique < updateMany < create < recordBatchConsumption
    const lockOrder = m.acquireLocks.mock.invocationCallOrder[0]
    expect(m.invItemFindUnique.mock.invocationCallOrder[0]).toBeGreaterThan(lockOrder)
    expect(m.invItemUpdateMany.mock.invocationCallOrder[0]).toBeGreaterThan(m.invItemFindUnique.mock.invocationCallOrder[0])
    expect(m.stockTxCreate.mock.invocationCallOrder[0]).toBeGreaterThan(m.invItemUpdateMany.mock.invocationCallOrder[0])
    expect(m.recordConsumption.mock.invocationCallOrder[0]).toBeGreaterThan(m.stockTxCreate.mock.invocationCallOrder[0])

    // StockTx data: sale, negativen quantity, orderId (G2 pariteta)
    expect(m.stockTxCreate).toHaveBeenCalledTimes(1)
    const data = m.stockTxCreate.mock.calls[0][0].data
    expect(data.type).toBe('sale')
    expect(data.orderId).toBe('ord-g3')
    expect(Number(data.quantity)).toBe(-1) // 2 × 0.5 RAW
    expect(Number(data.previousQty)).toBe(5)
    expect(Number(data.newQty)).toBe(4)
    expect(data.reason).toContain('QR naročilo #77')

    // FEFO: pozitiven deductQty + StockTx povezava
    expect(m.recordConsumption).toHaveBeenCalledWith(tx, {
      inventoryItemId: 'inv-b',
      quantity: 1,
      stockTransactionId: 'stx-g3',
    })
  })

  it('nezadostna zaloga: locks SREDA kliče, decrement count 0 → INSUFFICIENT_STOCK throw, brez StockTx/FEFO', async () => {
    const tx = makeTx(1)
    m.invItemUpdateMany.mockResolvedValue({ count: 0 })

    await expect(deductInventoryInTx(tx as never, items, menuItemMap, 78, 'ord-g3-fail'))
      .rejects.toThrow('INSUFFICIENT_STOCK')

    // ključavnice so pridobljene (kanon — locks pred prvim poskusom mutacije)
    expect(m.acquireLocks).toHaveBeenCalledTimes(1)
    // pogojni decrement je poskušan, StockTx in FEFO pa ne (tx roll-back pri callerju)
    expect(m.invItemUpdateMany).toHaveBeenCalledTimes(1)
    expect(m.stockTxCreate).not.toHaveBeenCalled()
    expect(m.recordConsumption).not.toHaveBeenCalled()
  })

  it('več receptnih artiklov: lock prejme VSE receptne id-je (dedup + sort je helper kontrakt — r182 group B)', async () => {
    const map2 = new Map([
      ['mi-2', {
        id: 'mi-2',
        name: 'G3 Dvojček',
        recipeItems: [
          { quantityPerServing: 0.1, yieldPercent: null, inventoryItem: { id: 'inv-z', quantity: 9, costPerUnit: 1 } },
          { quantityPerServing: 0.1, yieldPercent: null, inventoryItem: { id: 'inv-a', quantity: 9, costPerUnit: 1 } },
          { quantityPerServing: 0.1, yieldPercent: null, inventoryItem: { id: 'inv-z', quantity: 9, costPerUnit: 1 } },
        ],
      }],
    ])
    m.invItemUpdateMany.mockResolvedValue({ count: 1 })
    const tx = makeTx(1)
    await deductInventoryInTx(tx as never, [{ menuItemId: 'mi-2', quantity: 1 }], map2, 79, 'ord-g3-multi')

    expect(m.acquireLocks).toHaveBeenCalledWith(tx, ['inv-z', 'inv-a', 'inv-z'])
  })
})

describe('R218 G3: runtime call-order — glovo deductInventoryForOrder (wolt je byte-mirror)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.acquireLocks.mockResolvedValue(undefined)
    m.recordConsumption.mockResolvedValue(undefined)
    m.menuItemFindUnique.mockResolvedValue({
      id: 'mi-g',
      name: 'G3 Glovo Artikel',
      recipeItems: [{ quantityPerServing: 0.25, yieldPercent: 50, inventoryItem: { id: 'inv-g', quantity: 4, costPerUnit: 3, unit: 'kg' } }],
    })
    m.invItemFindUnique.mockResolvedValue({ quantity: 4, costPerUnit: 3, unit: 'kg' })
    m.invItemUpdateMany.mockResolvedValue({ count: 1 })
    m.stockTxCreate.mockResolvedValue({ id: 'stx-gl' })
    m.orderUpdate.mockResolvedValue({})
    m.txTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      const tx = {
        menuItem: { findUnique: m.menuItemFindUnique },
        inventoryItem: { findUnique: m.invItemFindUnique, updateMany: m.invItemUpdateMany },
        stockTransaction: { create: m.stockTxCreate },
        order: { update: m.orderUpdate },
      }
      return cb(tx)
    })
  })

  it('pre-fetch menuMap → locks → decrement → StockTx (orderId) → FEFO → inventoryDeducted', async () => {
    await glovoDeduct('ord-gl-1', 33, [{ menuItemId: 'mi-g', quantity: 2 } as never], 'Glovo')

    // locks dedup + sortiran (tx-fresh menuMap vir)
    expect(m.acquireLocks).toHaveBeenCalledTimes(1)
    expect(m.acquireLocks.mock.calls[0][1]).toEqual(['inv-g'])
    // menuItem fetch ENKRAT (N+1 odpravljen — 1 klic za 1 item)
    expect(m.menuItemFindUnique).toHaveBeenCalledTimes(1)

    const lockOrder = m.acquireLocks.mock.invocationCallOrder[0]
    expect(m.invItemUpdateMany.mock.invocationCallOrder[0]).toBeGreaterThan(lockOrder)
    expect(m.stockTxCreate.mock.invocationCallOrder[0]).toBeGreaterThan(m.invItemUpdateMany.mock.invocationCallOrder[0])
    expect(m.recordConsumption.mock.invocationCallOrder[0]).toBeGreaterThan(m.stockTxCreate.mock.invocationCallOrder[0])
    expect(m.orderUpdate.mock.invocationCallOrder[0]).toBeGreaterThan(m.recordConsumption.mock.invocationCallOrder[0])

    const data = m.stockTxCreate.mock.calls[0][0].data
    expect(data.orderId).toBe('ord-gl-1')
    expect(data.reason).toContain('Glovo naročilo #33')
    expect(m.orderUpdate).toHaveBeenCalledWith({ where: { id: 'ord-gl-1' }, data: { inventoryDeducted: true } })
    expect(m.recordConsumption).toHaveBeenCalledWith(expect.anything(), {
      inventoryItemId: 'inv-g',
      quantity: 1, // 2 × 0.5 RAW
      stockTransactionId: 'stx-gl',
    })
  })

  it('nezadostna zaloga: throw INSUFFICIENT_STOCK → order.update NI izveden (tx roll-back)', async () => {
    m.invItemUpdateMany.mockResolvedValue({ count: 0 })
    await expect(glovoDeduct('ord-gl-2', 34, [{ menuItemId: 'mi-g', quantity: 99 } as never], 'Glovo'))
      .rejects.toThrow('INSUFFICIENT_STOCK')
    expect(m.orderUpdate).not.toHaveBeenCalled()
    expect(m.recordConsumption).not.toHaveBeenCalled()
  })
})
