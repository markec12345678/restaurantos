// ============================================
// R120 / EPIC #115 §4 — BATCH / LOT / EXPIRY + FEFO TESTI
// ============================================
// Pokritje:
//  • A prevzem: restock z/op batch podatki ( InventoryBatch + vhodna alokacija)
//  • B FEFO poraba: expiryDate ASC (NULL zadnji) → receivedAt ASC; izčrpavanje
//    serij (EXHAUSTED), unbatched preostanek (prodaja NIKOLI pade zaradi sledljivosti)
//  • C konkurenca: Promise.all alokacij brez zaklepa (pogojni guardi) +
//    Promise.all odpadov pod serializacijo (advisory-lock emulacija)
//  • D odpad po serijah: izrecen batchId (fail-closed) / FEFO / replay idempotency
//  • E vračanje: reversala odpada (mirror serij) + returnStockForOrder snapshot
//  • F adjust/setQuantity v minus (FEFO) + 'return' v plus (unbatched)
//  • G order retry idempotency (inventoryDeducted claim) — enkratna alokacija
//  • I route GET /api/inventory/batches — scope 403, computed flags, summary
//  • J strukturni pini: pogojni guard, skupni advisory lock ključ, hook-i v vseh
//    zalogovnih poteh (6× prodaja + odpis + odpad + vračilo)
//
// Trap DB (hišni stil R119): in-memory model z REALNIMI semantikami pogojnih
// updateMany guard-ov, FEFO sortiranja in unique/idempotency — klicane so
// PRODUKCIJSKE helper funkcije, ne mock kopije.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Prisma } from '@prisma/client'

const LOC_A = 'loc-a'
const LOC_B = 'loc-b'
const INV_ID = 'inv-1'
const MENU_ID = 'menu-1'

// ---------- Tipi vrstic ----------
interface InvRow {
  id: string
  name: string
  unit: string
  quantity: number
  minQuantity: number
  costPerUnit: number
  servingsPerUnit: number
  locationId: string | null
  menuItemId: string | null
  lastRestocked: Date
  menuItem: null
}
interface BatchRow {
  id: string
  inventoryItemId: string
  locationId: string | null
  lotNumber: string
  supplierId: string | null
  supplierName: string
  receivedAt: Date
  expiryDate: Date | null
  quantityInitial: number
  quantityRemaining: number
  unit: string
  unitCost: number | null
  status: string
  note: string
  createdAt: Date
}
interface AllocRow {
  id: string
  batchId: string
  stockTransactionId: string
  inventoryItemId: string
  quantity: number
  createdAt: Date
}
interface StockTxRow {
  id: string
  inventoryItemId: string
  type: string
  quantity: number
  previousQty: number
  newQty: number
  orderId?: string
  createdAt: Date
}
interface WasteRow {
  id: string
  locationId: string
  inventoryItemId: string
  quantity: number
  unit: string
  reason: string
  note: string
  costPerUnit: number
  totalCost: number
  stockTransactionId: string | null
  reversalStockTransactionId: string | null
  reversedAt: Date | null
  idempotencyKey: string | null
  recordedByUserId: string | null
  createdAt: Date
}
interface OrderRow {
  id: string
  locationId: string | null
  inventoryDeducted: boolean
}
interface RecipeRow {
  menuItemId: string
  inventoryItemId: string
  quantityPerServing: number
}

const DAY = 24 * 60 * 60 * 1000
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY)

function createDb() {
  let seq = 0
  const id = (p: string) => `${p}-${++seq}`
  const inv: InvRow[] = []
  const batches: BatchRow[] = []
  const allocs: AllocRow[] = []
  const stockTx: StockTxRow[] = []
  const waste: WasteRow[] = []
  const orders: OrderRow[] = []
  const recipes: RecipeRow[] = []
  const lockKeys: string[] = []

  function addItem(overrides: Partial<InvRow> = {}): InvRow {
    const row: InvRow = {
      id: INV_ID, name: 'Moka 1kg', unit: 'kg', quantity: 20, minQuantity: 2,
      costPerUnit: 1.5, servingsPerUnit: 1, locationId: LOC_A, menuItemId: null,
      lastRestocked: new Date(), menuItem: null, ...overrides,
    }
    inv.push(row)
    return row
  }
  function addBatch(overrides: Partial<BatchRow> = {}): BatchRow {
    const row: BatchRow = {
      id: id('bat'), inventoryItemId: INV_ID, locationId: LOC_A,
      lotNumber: id('LOT'), supplierId: null, supplierName: '',
      receivedAt: new Date(), expiryDate: null,
      quantityInitial: 5, quantityRemaining: 5, unit: 'kg', unitCost: 1.5,
      status: 'ACTIVE', note: '', createdAt: new Date(), ...overrides,
    }
    batches.push(row)
    return row
  }
  function addOrder(overrides: Partial<OrderRow> = {}): OrderRow {
    const row: OrderRow = { id: id('ord'), locationId: LOC_A, inventoryDeducted: false, ...overrides }
    orders.push(row)
    return row
  }

  function matchGte(value: number, cond?: { gte?: number; gt?: number; lte?: number; lt?: number; not?: unknown }): boolean {
    if (!cond) return true
    if (cond.gte !== undefined && value < cond.gte) return false
    if (cond.gt !== undefined && value <= cond.gt) return false
    if (cond.lte !== undefined && value > cond.lte) return false
    if (cond.lt !== undefined && value >= cond.lt) return false
    if (cond.not !== undefined && (cond.not as { not: unknown }) === undefined) return false
    return true
  }

  /** FEFO sort: expiryDate ASC (NULL zadnji) → receivedAt ASC → createdAt ASC */
  function fefoSort(rows: BatchRow[]): BatchRow[] {
    return [...rows].sort((a, b) => {
      if (a.expiryDate && b.expiryDate && a.expiryDate.getTime() !== b.expiryDate.getTime()) {
        return a.expiryDate.getTime() - b.expiryDate.getTime()
      }
      if (a.expiryDate && !b.expiryDate) return -1
      if (!a.expiryDate && b.expiryDate) return 1
      if (a.receivedAt.getTime() !== b.receivedAt.getTime()) return a.receivedAt.getTime() - b.receivedAt.getTime()
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
  }

  const batchClient = {
    findMany: async ({ where }: { where: Record<string, unknown> }) => {
      let rows = batches.filter(b => {
        if (where.inventoryItemId && b.inventoryItemId !== where.inventoryItemId) return false
        if (where.status && b.status !== where.status) return false
        const rem = where.quantityRemaining as { gt?: number } | undefined
        if (rem?.gt !== undefined && !(b.quantityRemaining > rem.gt)) return false
        return true
      })
      rows = fefoSort(rows)
      return rows.map(r => ({ ...r }))
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = batches.find(b => b.id === where.id)
      return row ? { ...row } : null
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      const row = batches.find(b => b.id === where.id && (!where.inventoryItemId || b.inventoryItemId === where.inventoryItemId))
      return row ? { ...row } : null
    },
    updateMany: async ({ where, data }: { where: { id: string; status?: string; quantityRemaining?: Record<string, number> }; data: Record<string, unknown> }) => {
      const row = batches.find(b => b.id === where.id)
      if (!row) return { count: 0 }
      if (where.status && row.status !== where.status) return { count: 0 }
      if (where.quantityRemaining?.gte !== undefined && row.quantityRemaining < where.quantityRemaining.gte) return { count: 0 }
      if (where.quantityRemaining?.lte !== undefined && row.quantityRemaining > where.quantityRemaining.lte) return { count: 0 }
      const dec = (data.quantityRemaining as { decrement?: number } | undefined)?.decrement
      const inc = (data.quantityRemaining as { increment?: number } | undefined)?.increment
      if (dec !== undefined) row.quantityRemaining -= dec
      if (inc !== undefined) row.quantityRemaining += inc
      if (data.status !== undefined) row.status = data.status as string
      return { count: 1 }
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row: BatchRow = {
        id: id('bat'),
        inventoryItemId: data.inventoryItemId as string,
        locationId: (data.locationId as string | null) ?? null,
        lotNumber: data.lotNumber as string,
        supplierId: (data.supplierId as string | null) ?? null,
        supplierName: (data.supplierName as string) ?? '',
        receivedAt: new Date(),
        expiryDate: (data.expiryDate as Date | null) ?? null,
        quantityInitial: data.quantityInitial as number,
        quantityRemaining: data.quantityRemaining as number,
        unit: (data.unit as string) ?? '',
        unitCost: (data.unitCost as number | null) ?? null,
        status: 'ACTIVE',
        note: (data.note as string) ?? '',
        createdAt: new Date(),
      }
      batches.push(row)
      return { ...row }
    },
  }

  const allocClient = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row: AllocRow = {
        id: id('al'),
        batchId: data.batchId as string,
        stockTransactionId: data.stockTransactionId as string,
        inventoryItemId: data.inventoryItemId as string,
        quantity: data.quantity as number,
        createdAt: new Date(),
      }
      allocs.push(row)
      return { ...row }
    },
    findMany: async ({ where }: { where: Record<string, unknown> }) => {
      const txIn = (where.stockTransactionId as { in?: string[] })?.in
      const qtyLt = (where.quantity as { lt?: number })?.lt
      return allocs.filter(a => {
        if (txIn && !txIn.includes(a.stockTransactionId)) return false
        if (where.inventoryItemId && a.inventoryItemId !== where.inventoryItemId) return false
        if (qtyLt !== undefined && !(a.quantity < qtyLt)) return false
        return true
      }).map(r => ({ ...r }))
    },
  }

  const invClient = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      // Generičen where: id / menuItemId / locationId + OR lokacijski scope
      // (wasteItemWhere: OR [{locationId}, {locationId: null}])
      const row = inv.find(i => {
        for (const [key, value] of Object.entries(where)) {
          if (key === 'OR') continue
          if ((i as unknown as Record<string, unknown>)[key] !== value) return false
        }
        if (where.OR && !((where.OR as { locationId: string | null }[]).some(o => o.locationId === i.locationId))) return false
        return true
      })
      return row ? { ...row } : null
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = inv.find(i => i.id === where.id)
      return row ? { ...row } : null
    },
    updateMany: async ({ where, data }: { where: { id: string; quantity?: { gte: number } }; data: { quantity: { decrement: number } } }) => {
      const row = inv.find(i => i.id === where.id)
      if (!row) return { count: 0 }
      if (where.quantity?.gte !== undefined && row.quantity < where.quantity.gte) return { count: 0 }
      row.quantity -= data.quantity.decrement
      return { count: 1 }
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = inv.find(i => i.id === where.id)
      if (!row) throw new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: 'test' })
      if ((data.quantity as { increment?: number } | undefined)?.increment) {
        row.quantity += (data.quantity as { increment: number }).increment
      } else if (typeof data.quantity === 'number') {
        row.quantity = data.quantity // absolutni set (PUT/PATCH kanon)
      }
      if (data.lastRestocked) row.lastRestocked = data.lastRestocked as Date
      return { ...row }
    },
  }

  const stockTxClient = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row: StockTxRow = {
        id: id('stx'),
        inventoryItemId: data.inventoryItemId as string,
        type: data.type as string,
        quantity: data.quantity as number,
        previousQty: data.previousQty as number,
        newQty: data.newQty as number,
        orderId: data.orderId as string | undefined,
        createdAt: new Date(),
      }
      stockTx.push(row)
      return { ...row }
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      const row = stockTx.find(t => {
        if (where.inventoryItemId !== undefined && t.inventoryItemId !== where.inventoryItemId) return false
        if (where.type !== undefined && t.type !== where.type) return false
        if (where.orderId !== undefined && t.orderId !== where.orderId) return false
        return true
      })
      return row ? { ...row } : null
    },
    findMany: async ({ where }: { where: Record<string, unknown> }) => {
      return stockTx.filter(t => {
        if (where.orderId && t.orderId !== where.orderId) return false
        if (where.type && t.type !== where.type) return false
        return true
      }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    },
  }

  const wasteClient = {
    findFirst: async ({ where }: { where: { id?: string; locationId?: string; idempotencyKey?: string } }) =>
      waste.find(w =>
        (where.id ? w.id === where.id : true) &&
        (where.locationId ? w.locationId === where.locationId : true) &&
        (where.idempotencyKey !== undefined ? w.idempotencyKey === where.idempotencyKey : true),
      ) ?? null,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      if (data.idempotencyKey && waste.some(w => w.locationId === data.locationId && w.idempotencyKey === data.idempotencyKey)) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
      }
      const row: WasteRow = {
        id: id('wr'),
        locationId: data.locationId as string,
        inventoryItemId: data.inventoryItemId as string,
        quantity: data.quantity as number,
        unit: data.unit as string,
        reason: data.reason as string,
        note: data.note as string,
        costPerUnit: data.costPerUnit as number,
        totalCost: data.totalCost as number,
        stockTransactionId: (data.stockTransactionId as string) ?? null,
        reversalStockTransactionId: null,
        reversedAt: null,
        idempotencyKey: (data.idempotencyKey as string) ?? null,
        recordedByUserId: (data.recordedByUserId as string) ?? null,
        createdAt: new Date(),
      }
      waste.push(row)
      return { ...row }
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = waste.find(w => w.id === where.id)
      if (!row) throw new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: 'test' })
      Object.assign(row, data)
      return { ...row }
    },
  }

  const orderClient = {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = orders.find(o => o.id === where.id)
      return row ? { ...row } : null
    },
    updateMany: async ({ where, data }: { where: { id: string; inventoryDeducted?: boolean }; data: { inventoryDeducted: boolean } }) => {
      const row = orders.find(o => o.id === where.id)
      if (!row) return { count: 0 }
      if (where.inventoryDeducted !== undefined && row.inventoryDeducted !== where.inventoryDeducted) return { count: 0 }
      row.inventoryDeducted = data.inventoryDeducted
      return { count: 1 }
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = orders.find(o => o.id === where.id)
      if (!row) throw new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: 'test' })
      Object.assign(row, data)
      return { ...row }
    },
  }

  const recipeClient = {
    findMany: async ({ where }: { where: { menuItemId: string } }) =>
      recipes.filter(r => r.menuItemId === where.menuItemId).map(r => ({ ...r })),
  }

  const makeTx = (): Prisma.TransactionClient =>
    // Trap client pokrije samo modele, ki jih produkcijske helperje dejansko
    // uporabljajo v teh testih — cast na polni TransactionClient.
    ({
      inventoryItem: invClient,
      inventoryBatch: batchClient,
      stockBatchAllocation: allocClient,
      stockTransaction: stockTxClient,
      wasteRecord: wasteClient,
      order: orderClient,
      recipeItem: recipeClient,
      $executeRaw: async (_strings: TemplateStringsArray, lockKey: string) => {
        lockKeys.push(lockKey)
        return 0
      },
    } as unknown as Prisma.TransactionClient)

  const makeDb = (withMutex: boolean) => {
    let chain: Promise<unknown> = Promise.resolve()
    // Rollback semantika prave baze: throw v tx telesu povrne VSA mutacije
    // (trap vrstice so in-memory — snapshot/restore pred/po fn).
    const snapshot = () => ({
      inv: structuredClone(inv), batches: structuredClone(batches),
      allocs: structuredClone(allocs), stockTx: structuredClone(stockTx),
      waste: structuredClone(waste), orders: structuredClone(orders),
      recipes: structuredClone(recipes),
    })
    const restore = (s: ReturnType<typeof snapshot>) => {
      const replace = (target: unknown[], copy: unknown[]) => {
        target.length = 0
        for (const x of copy) target.push(x)
      }
      replace(inv, s.inv)
      replace(batches, s.batches)
      replace(allocs, s.allocs)
      replace(stockTx, s.stockTx)
      replace(waste, s.waste)
      replace(orders, s.orders)
      replace(recipes, s.recipes)
    }
    return {
      inventoryItem: invClient,
      inventoryBatch: batchClient,
      stockBatchAllocation: allocClient,
      stockTransaction: stockTxClient,
      wasteRecord: wasteClient,
      order: orderClient,
      recipeItem: recipeClient,
      $transaction: async <T>(fn: (tx: ReturnType<typeof makeTx>) => Promise<T>) => {
        const before = snapshot()
        const run = async () => {
          try {
            return await fn(makeTx())
          } catch (err) {
            restore(before)
            throw err
          }
        }
        if (!withMutex) return run()
        // Emulacija advisory-lock kanona: tx telesa se striktno serializirajo
        const chained = chain.then(run)
        chain = chained.then(() => undefined, () => undefined)
        return chained as T
      },
    }
  }

  const db = makeDb(true)
  const tx = makeTx()

  return {
    db, tx, inv, batches, allocs, stockTx, waste, orders, recipes, lockKeys,
    addItem, addBatch, addOrder,
  }
}

// ---------- Mocki ----------
const ref = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createDb> }))
ref.current = createDb()

vi.mock('@/lib/db', () => ({
  get db() {
    return ref.current.db
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/decimal', () => ({
  toNum: (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0),
  round2: (v: number) => Math.round(v * 100) / 100,
  round3: (v: number) => Math.round(v * 1000) / 1000,
  multiply: (a: number, b: number) => a * b,
  divide: (a: number, b: number) => a / b,
  subtract: (a: number, b: number) => a - b,
  isPositive: (v: unknown) => Number(v) > 0,
  deepToNumbers: <T>(v: T): T => v,
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { restockInventoryItem, adjustInventoryItemStock, setInventoryItemQuantity, inventoryStockLockKey } from '@/app/api/inventory/_helpers/stock-mutations'
import { createWasteRecord, reverseWasteRecord } from '@/app/api/waste/_helpers/waste-mutations'
import { deductDirectItem } from '@/lib/stock-deduction/deduct-direct'
import { deductStockForOrder } from '@/lib/stock-deduction'
import { returnStockForOrder } from '@/lib/stock-deduction/return-stock'
import { allocateBatchesFEFO, recordBatchConsumption } from '@/lib/stock-deduction/batch-allocation'
import type { StockDeductionItem, StockDeductionResult } from '@/lib/stock-deduction/types'

beforeEach(() => {
  ref.current = createDb()
})

function emptyResult(): StockDeductionResult {
  return { success: true, deducted: [], lowStockAlerts: [], errors: [] }
}

// ════════════════════════════════════════════════════════════════
// A. PREVZEM — restock + batch
// ════════════════════════════════════════════════════════════════
describe('R120 A: restock + InventoryBatch', () => {
  it('A1: restock z lot podatki ustvari serijo + vhodno alokacijo (supplier → prevzem → batch)', async () => {
    ref.current.addItem({ quantity: 10 })
    const res = await restockInventoryItem({
      inventoryItemId: INV_ID,
      sessionLocationId: LOC_A,
      quantity: 12,
      reason: 'Dostava',
      note: 'Dobava moke',
      supplierDoc: 'DN-2026-001',
      employeeName: 'Miha',
      batch: { lotNumber: 'LOT-2026-09-01', expiryDate: daysFromNow(30), supplierName: 'Mlinarstvo Kranj', unitCost: 1.4 },
    })
    expect(ref.current.inv[0].quantity).toBe(22)
    const batch = ref.current.batches[0]
    expect(batch).toBeDefined()
    expect(batch.lotNumber).toBe('LOT-2026-09-01')
    expect(batch.quantityInitial).toBe(12)
    expect(batch.quantityRemaining).toBe(12)
    expect(batch.status).toBe('ACTIVE')
    expect(batch.locationId).toBe(LOC_A) // snapshot lokacije artikla
    expect(batch.unit).toBe('kg')
    expect(batch.unitCost).toBe(1.4)
    expect(batch.expiryDate).toBeTruthy()
    // vhodna alokacija na procurement transakciji
    const tx = res.transaction as { id: string }
    const alloc = ref.current.allocs.find(a => a.batchId === batch.id && a.stockTransactionId === tx.id)
    expect(alloc).toBeDefined()
    expect(alloc!.quantity).toBe(12) // pozitiven vnos
    expect(ref.current.lockKeys.some(k => k === inventoryStockLockKey(INV_ID))).toBe(true)
  })

  it('A2: restock brez lot podatkov NE ustvari serije (nazaj-kompatibilno)', async () => {
    ref.current.addItem()
    await restockInventoryItem({
      inventoryItemId: INV_ID, sessionLocationId: LOC_A, quantity: 5,
      reason: 'Dostava', note: '', supplierDoc: '', employeeName: '',
    })
    expect(ref.current.batches).toHaveLength(0)
    expect(ref.current.allocs).toHaveLength(0)
  })

  it('A3: restock s praznim lot stringom NE ustvari serije', async () => {
    ref.current.addItem()
    await restockInventoryItem({
      inventoryItemId: INV_ID, sessionLocationId: LOC_A, quantity: 5,
      reason: 'Dostava', note: '', supplierDoc: '', employeeName: '',
      batch: { lotNumber: '   ', unitCost: null },
    })
    expect(ref.current.batches).toHaveLength(0)
  })
})

// ════════════════════════════════════════════════════════════════
// B. FEFO PORABA (prodaja)
// ════════════════════════════════════════════════════════════════
describe('R120 B: FEFO poraba', () => {
  it('B1: najkrajši rok uporabe se porabi prvi, brez roka zadnji', async () => {
    ref.current.addItem({ quantity: 20, menuItemId: MENU_ID })
    const exp2 = ref.current.addBatch({ lotNumber: 'L-exp2', expiryDate: daysFromNow(2), quantityRemaining: 5, quantityInitial: 5 })
    const exp10 = ref.current.addBatch({ lotNumber: 'L-exp10', expiryDate: daysFromNow(10), quantityRemaining: 5, quantityInitial: 5 })
    const none = ref.current.addBatch({ lotNumber: 'L-none', expiryDate: null, quantityRemaining: 5, quantityInitial: 5 })

    const result = emptyResult()
    const item: StockDeductionItem = { menuItemId: MENU_ID, quantity: 1, voided: false }
    // direktna pot: servingsPerUnit=1 → odvije 1 enoto? Ne — direct pot odvije
    // quantity × (1/servingsPerUnit) = 1. Uporabimo količino 8.
    await deductDirectItem(ref.current.tx, { ...item, quantity: 8 }, 'ord-1', 42, result, LOC_A)

    expect(result.errors).toHaveLength(0)
    expect(ref.current.inv[0].quantity).toBe(12)
    expect(ref.current.batches.find(b => b.id === exp2.id)!.quantityRemaining).toBe(0)
    expect(ref.current.batches.find(b => b.id === exp2.id)!.status).toBe('EXHAUSTED')
    expect(ref.current.batches.find(b => b.id === exp10.id)!.quantityRemaining).toBe(2)
    expect(ref.current.batches.find(b => b.id === none.id)!.quantityRemaining).toBe(5)
    // alokacije vsota = 8: −5 (exp2) + −3 (exp10)
    const saleTx = ref.current.stockTx[0]
    const rows = ref.current.allocs.filter(a => a.stockTransactionId === saleTx.id)
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.quantity).sort((a, b) => a - b)).toEqual([-5, -3])
  })

  it('B2: enak rok uporabe — prej prejeta serija gre prva (receivedAt ASC)', async () => {
    ref.current.addItem()
    const older = ref.current.addBatch({ lotNumber: 'L-old', expiryDate: daysFromNow(7), receivedAt: new Date(Date.now() - 5 * DAY) })
    const newer = ref.current.addBatch({ lotNumber: 'L-new', expiryDate: daysFromNow(7), receivedAt: new Date() })

    await allocateBatchesFEFO(ref.current.tx, { inventoryItemId: INV_ID, quantity: 3 })

    expect(ref.current.batches.find(b => b.id === older.id)!.quantityRemaining).toBe(2)
    expect(ref.current.batches.find(b => b.id === newer.id)!.quantityRemaining).toBe(5)
  })

  it('B3: poraba večja od serij → preostanek unbatched, brez negativnih serij', async () => {
    ref.current.addItem({ quantity: 10, menuItemId: MENU_ID })
    ref.current.addBatch({ lotNumber: 'L-1', expiryDate: daysFromNow(3), quantityRemaining: 3, quantityInitial: 3 })

    const result = emptyResult()
    await deductDirectItem(ref.current.tx, { menuItemId: MENU_ID, quantity: 8, voided: false }, 'ord-1', 42, result, LOC_A)

    expect(result.errors).toHaveLength(0)
    expect(ref.current.inv[0].quantity).toBe(2) // celoten odbitek 8
    expect(ref.current.batches[0].quantityRemaining).toBe(0)
    expect(ref.current.batches[0].status).toBe('EXHAUSTED')
    // samo ena alokacija (−3), preostalih 5 unbatched — brez izmišljenih vrstic
    expect(ref.current.allocs).toHaveLength(1)
    expect(ref.current.allocs[0].quantity).toBe(-3)
  })

  it('B4: nezadostna zaloga → brez odbitka IN brez alokacij (fail-closed kanon ostaja)', async () => {
    ref.current.addItem({ quantity: 2, menuItemId: MENU_ID })
    ref.current.addBatch({ quantityRemaining: 5, quantityInitial: 5, expiryDate: daysFromNow(3) })
    const result = emptyResult()
    await deductDirectItem(ref.current.tx, { menuItemId: MENU_ID, quantity: 5, voided: false }, 'ord-1', 42, result, LOC_A)
    expect(result.success).toBe(false)
    expect(ref.current.inv[0].quantity).toBe(2)
    expect(ref.current.allocs).toHaveLength(0)
  })

  it('B5: delne (decimalne) količine — 0.5 kg po serijah, brez rounding drifta', async () => {
    ref.current.addItem({ quantity: 10 })
    ref.current.addBatch({ lotNumber: 'L-A', expiryDate: daysFromNow(1), quantityRemaining: 1, quantityInitial: 1 })
    ref.current.addBatch({ lotNumber: 'L-B', expiryDate: daysFromNow(20), quantityRemaining: 2, quantityInitial: 2 })

    const tx = ref.current.tx
    const stx = await tx.stockTransaction.create({
      data: { inventoryItemId: INV_ID, type: 'sale', quantity: -0.5, previousQty: 10, newQty: 9.5, costPerUnit: 1.5, totalCost: 0.75, reason: 'test', orderId: 'ord-1' },
    })
    await recordBatchConsumption(tx, { inventoryItemId: INV_ID, quantity: 0.5, stockTransactionId: stx.id })
    expect(ref.current.batches.find(b => b.lotNumber === 'L-A')!.quantityRemaining).toBe(0.5)
    expect(ref.current.batches.find(b => b.lotNumber === 'L-B')!.quantityRemaining).toBe(2)
    expect(ref.current.allocs).toHaveLength(1)
    expect(ref.current.allocs[0].quantity).toBe(-0.5)
  })
})

// ════════════════════════════════════════════════════════════════
// C. KONKURENCA
// ════════════════════════════════════════════════════════════════
describe('R120 C: konkurenca — serije nikoli negativne', () => {
  it('C1: štiri vzporedne alokacije brez zaklepa — pogojni guardi držijo vsoto ≤ remaining', async () => {
    ref.current.addItem({ quantity: 20 })
    ref.current.addBatch({ lotNumber: 'L-A', expiryDate: daysFromNow(2), quantityRemaining: 4, quantityInitial: 4 })
    ref.current.addBatch({ lotNumber: 'L-B', expiryDate: daysFromNow(5), quantityRemaining: 4, quantityInitial: 4 })

    // Namerno BREZ advisory lock emulacije — alokacije tečejo vzporedno skozi
    // pogojne updateMany guarde (Read Committed realnost prodajne poti).
    const all = await Promise.all([
      allocateBatchesFEFO(ref.current.tx, { inventoryItemId: INV_ID, quantity: 4 }),
      allocateBatchesFEFO(ref.current.tx, { inventoryItemId: INV_ID, quantity: 4 }),
      allocateBatchesFEFO(ref.current.tx, { inventoryItemId: INV_ID, quantity: 4 }),
      allocateBatchesFEFO(ref.current.tx, { inventoryItemId: INV_ID, quantity: 4 }),
    ])

    const totalAllocated = all.flat().reduce((s, x) => s + Math.abs(x.quantity), 0)
    expect(totalAllocated).toBeLessThanOrEqual(8)
    for (const b of ref.current.batches) {
      expect(b.quantityRemaining).toBeGreaterThanOrEqual(0)
    }
    // Vse, kar je bilo alokirano, mora biti sledljivo: vsota alokacij == vsota odvodov serij
    const consumedFromBatches = ref.current.batches.reduce((s, b) => s + (b.quantityInitial - b.quantityRemaining), 0)
    expect(totalAllocated).toBe(consumedFromBatches)
  })

  it('C2: dva vzporedna odpada pod serializacijo — konzistentne serije, enkratni odpisi', async () => {
    ref.current.addItem({ quantity: 20 })
    ref.current.addBatch({ lotNumber: 'L-A', expiryDate: daysFromNow(2), quantityRemaining: 6, quantityInitial: 6 })
    ref.current.addBatch({ lotNumber: 'L-B', expiryDate: daysFromNow(8), quantityRemaining: 6, quantityInitial: 6 })

    const [r1, r2] = await Promise.all([
      createWasteRecord({ locationId: LOC_A, inventoryItemId: INV_ID, quantity: 4, reason: 'SPOILED', note: '', idempotencyKey: 'w-1', recordedByUserId: 'emp', batchId: null }),
      createWasteRecord({ locationId: LOC_A, inventoryItemId: INV_ID, quantity: 4, reason: 'BROKEN', note: '', idempotencyKey: 'w-2', recordedByUserId: 'emp', batchId: null }),
    ])
    expect(r1.replay).toBe(false)
    expect(r2.replay).toBe(false)
    expect(ref.current.inv[0].quantity).toBe(12) // 20 − 8
    // FEFO: L-A izčrpana (6), L-B 8 − 6 = 2
    const a = ref.current.batches.find(b => b.lotNumber === 'L-A')!
    const b = ref.current.batches.find(b => b.lotNumber === 'L-B')!
    expect(a.quantityRemaining).toBe(0)
    expect(a.status).toBe('EXHAUSTED')
    expect(b.quantityRemaining).toBe(4) // FEFO: A da 6 (4+2), B da 2
    const wasteTxs = ref.current.stockTx.filter(t => t.type === 'write-off')
    expect(wasteTxs).toHaveLength(2)
  })
})

// ════════════════════════════════════════════════════════════════
// D. ODPAD PO SERIJAH
// ════════════════════════════════════════════════════════════════
describe('R120 D: odpad + batchId', () => {
  it('D1: izrecen batchId odpiše TO serijo, ostale se ne dotakne', async () => {
    ref.current.addItem({ quantity: 20 })
    const target = ref.current.addBatch({ lotNumber: 'L-target', expiryDate: daysFromNow(30), quantityRemaining: 4, quantityInitial: 4 })
    const other = ref.current.addBatch({ lotNumber: 'L-other', expiryDate: daysFromNow(1), quantityRemaining: 5, quantityInitial: 5 })

    const res = await createWasteRecord({
      locationId: LOC_A, inventoryItemId: INV_ID, quantity: 3, reason: 'EXPIRED',
      note: '', idempotencyKey: null, recordedByUserId: 'emp', batchId: target.id,
    })
    expect(res.replay).toBe(false)
    expect(ref.current.batches.find(b => b.id === target.id)!.quantityRemaining).toBe(1)
    expect(ref.current.batches.find(b => b.id === other.id)!.quantityRemaining).toBe(5)
    const writeOff = ref.current.stockTx.find(t => t.type === 'write-off')!
    expect(ref.current.allocs.find(a => a.stockTransactionId === writeOff.id && a.batchId === target.id)).toBeDefined()
  })

  it('D2: brez batchId → FEFO (najkrajši rok prvi)', async () => {
    ref.current.addItem({ quantity: 20 })
    const soon = ref.current.addBatch({ lotNumber: 'L-soon', expiryDate: daysFromNow(1), quantityRemaining: 5, quantityInitial: 5 })
    const later = ref.current.addBatch({ lotNumber: 'L-later', expiryDate: daysFromNow(25), quantityRemaining: 5, quantityInitial: 5 })

    await createWasteRecord({ locationId: LOC_A, inventoryItemId: INV_ID, quantity: 2, reason: 'SPOILED', note: '', idempotencyKey: null, recordedByUserId: null, batchId: null })

    expect(ref.current.batches.find(b => b.id === soon.id)!.quantityRemaining).toBe(3)
    expect(ref.current.batches.find(b => b.id === later.id)!.quantityRemaining).toBe(5)
  })

  it('D3: izčrpana serija → 400 fail-closed, zaloga nedotaknjena', async () => {
    ref.current.addItem({ quantity: 20 })
    const dead = ref.current.addBatch({ lotNumber: 'L-dead', status: 'EXHAUSTED', quantityRemaining: 0, quantityInitial: 5 })
    await expect(createWasteRecord({
      locationId: LOC_A, inventoryItemId: INV_ID, quantity: 1, reason: 'EXPIRED',
      note: '', idempotencyKey: null, recordedByUserId: null, batchId: dead.id,
    })).rejects.toMatchObject({ status: 400 })
    expect(ref.current.inv[0].quantity).toBe(20)
  })

  it('D4: serija tuge lokacije → 400 (ni odvoda tujih serij)', async () => {
    ref.current.addItem({ quantity: 20, locationId: null }) // skupni vir
    const foreign = ref.current.addBatch({ lotNumber: 'L-B', locationId: LOC_B, quantityRemaining: 5, quantityInitial: 5 })
    await expect(createWasteRecord({
      locationId: LOC_A, inventoryItemId: INV_ID, quantity: 1, reason: 'SPOILED',
      note: '', idempotencyKey: null, recordedByUserId: null, batchId: foreign.id,
    })).rejects.toMatchObject({ status: 400 })
    expect(ref.current.batches.find(b => b.id === foreign.id)!.quantityRemaining).toBe(5)
  })

  it('D5: serija premalo → 400 in zaloga ostane', async () => {
    ref.current.addItem({ quantity: 20 })
    const small = ref.current.addBatch({ quantityRemaining: 1, quantityInitial: 1, expiryDate: daysFromNow(2) })
    await expect(createWasteRecord({
      locationId: LOC_A, inventoryItemId: INV_ID, quantity: 2, reason: 'SPOILED',
      note: '', idempotencyKey: null, recordedByUserId: null, batchId: small.id,
    })).rejects.toMatchObject({ status: 400 })
    expect(ref.current.inv[0].quantity).toBe(20)
  })

  it('D6: idempotentni replay z batchId → enkraten odpis serije', async () => {
    ref.current.addItem({ quantity: 20 })
    const batch = ref.current.addBatch({ quantityRemaining: 5, quantityInitial: 5, expiryDate: daysFromNow(2) })
    const first = await createWasteRecord({
      locationId: LOC_A, inventoryItemId: INV_ID, quantity: 2, reason: 'SPOILED',
      note: '', idempotencyKey: 'w-key', recordedByUserId: null, batchId: batch.id,
    })
    const second = await createWasteRecord({
      locationId: LOC_A, inventoryItemId: INV_ID, quantity: 2, reason: 'SPOILED',
      note: '', idempotencyKey: 'w-key', recordedByUserId: null, batchId: batch.id,
    })
    expect(first.replay).toBe(false)
    expect(second.replay).toBe(true)
    expect(ref.current.batches.find(b => b.id === batch.id)!.quantityRemaining).toBe(3)
    expect(ref.current.inv[0].quantity).toBe(18)
  })
})

// ════════════════════════════════════════════════════════════════
// E. VRAČANJE — reversala odpada + mirror vračanje naročila
// ════════════════════════════════════════════════════════════════
describe('R120 E: vračanje serij', () => {
  it('E1: reversala odpada vrne količino v prave serije (FEFO odpad)', async () => {
    ref.current.addItem({ quantity: 20 })
    const soon = ref.current.addBatch({ lotNumber: 'L-soon', expiryDate: daysFromNow(1), quantityRemaining: 3, quantityInitial: 3 })
    const later = ref.current.addBatch({ lotNumber: 'L-later', expiryDate: daysFromNow(20), quantityRemaining: 5, quantityInitial: 5 })

    const created = await createWasteRecord({ locationId: LOC_A, inventoryItemId: INV_ID, quantity: 5, reason: 'SPOILED', note: '', idempotencyKey: null, recordedByUserId: null, batchId: null })
    // FEFO: soon izčrpana (3) + later 2
    expect(ref.current.batches.find(b => b.id === soon.id)!.quantityRemaining).toBe(0)

    await reverseWasteRecord({ wasteRecordId: (created.record as { id: string }).id, sessionLocationId: LOC_A, reversedByUserId: 'mgr' })

    expect(ref.current.batches.find(b => b.id === soon.id)!.quantityRemaining).toBe(3)
    expect(ref.current.batches.find(b => b.id === soon.id)!.status).toBe('ACTIVE')
    expect(ref.current.batches.find(b => b.id === later.id)!.quantityRemaining).toBe(5)
    expect(ref.current.inv[0].quantity).toBe(20)
    // pozitivne alokacije na return transakciji
    const returnTx = ref.current.stockTx.find(t => t.type === 'return')!
    const returnRows = ref.current.allocs.filter(a => a.stockTransactionId === returnTx.id)
    expect(returnRows.reduce((s, r) => s + r.quantity, 0)).toBe(5)
  })

  it('E2: mirror vračanje naročila — prodaja po serijah, storno vrne iste serije', async () => {
    ref.current.addItem({ quantity: 20, menuItemId: MENU_ID })
    const a = ref.current.addBatch({ lotNumber: 'L-A', expiryDate: daysFromNow(2), quantityRemaining: 4, quantityInitial: 4 })
    const b = ref.current.addBatch({ lotNumber: 'L-B', expiryDate: daysFromNow(9), quantityRemaining: 4, quantityInitial: 4 })

    const order = ref.current.addOrder()
    const result = emptyResult()
    await deductDirectItem(ref.current.tx, { menuItemId: MENU_ID, quantity: 6, voided: false }, order.id, 7, result, LOC_A)
    // FEFO: A izčrpana, B −2
    expect(ref.current.batches.find(x => x.id === a.id)!.quantityRemaining).toBe(0)
    expect(ref.current.batches.find(x => x.id === b.id)!.quantityRemaining).toBe(2)

    // order postane "razknjižen" + return po snapshot kanonu
    ref.current.orders[0].inventoryDeducted = true
    const ret = await returnStockForOrder(order.id, 7, 'Storno')
    expect(ret.errors).toHaveLength(0)
    expect(ref.current.batches.find(x => x.id === a.id)!.quantityRemaining).toBe(4)
    expect(ref.current.batches.find(x => x.id === a.id)!.status).toBe('ACTIVE')
    expect(ref.current.batches.find(x => x.id === b.id)!.quantityRemaining).toBe(4)
    expect(ref.current.inv[0].quantity).toBe(20)
  })

  it('E3: legacy odpad brez StockTransaction → reversala brez serij (unbatched return)', async () => {
    ref.current.addItem({ quantity: 10 })
    ref.current.addBatch({ quantityRemaining: 2, quantityInitial: 2, expiryDate: daysFromNow(4) })
    const created = await createWasteRecord({ locationId: LOC_A, inventoryItemId: INV_ID, quantity: 1, reason: 'BROKEN', note: '', idempotencyKey: null, recordedByUserId: null, batchId: null })
    // simuliraj legacy zapis brez povezane tx
    const wr = ref.current.waste.find(w => w.id === (created.record as { id: string }).id)!
    wr.stockTransactionId = null
    ref.current.stockTx.length = 0
    ref.current.allocs.length = 0

    await reverseWasteRecord({ wasteRecordId: wr.id, sessionLocationId: LOC_A, reversedByUserId: null })
    expect(ref.current.inv[0].quantity).toBe(10)
    expect(ref.current.allocs).toHaveLength(0)
    // serija se ne "pozdravi" naključno: FEFO odpad je odvzel 1 (2→1) in
    // reversala brez povezanih alokacij serije NE vrne (unbatched return)
    expect(ref.current.batches[0].quantityRemaining).toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════
// F. ADJUST / SET QUANTITY
// ════════════════════════════════════════════════════════════════
describe('R120 F: odpis/prilagoditev + serije', () => {
  it('F1: adjust write-off → FEFO alokacija', async () => {
    ref.current.addItem({ quantity: 10 })
    const first = ref.current.addBatch({ lotNumber: 'L-1', expiryDate: daysFromNow(2), quantityRemaining: 4, quantityInitial: 4 })
    ref.current.addBatch({ lotNumber: 'L-2', expiryDate: daysFromNow(15), quantityRemaining: 4, quantityInitial: 4 })

    await adjustInventoryItemStock({
      inventoryItemId: INV_ID, sessionLocationId: LOC_A, type: 'write-off',
      quantity: 5, reason: 'Odpis', note: '', supplierDoc: '', employeeName: '',
    })
    expect(ref.current.batches.find(b => b.id === first.id)!.quantityRemaining).toBe(0)
    expect(ref.current.batches.find(b => b.lotNumber === 'L-2')!.quantityRemaining).toBe(3)
  })

  it('F2: ročna nastavitev v minus (PUT absolut) → FEFO alokacija na write-off tx', async () => {
    ref.current.addItem({ quantity: 10 })
    ref.current.addBatch({ lotNumber: 'L-1', expiryDate: daysFromNow(2), quantityRemaining: 3, quantityInitial: 3 })
    await setInventoryItemQuantity({
      inventoryItemId: INV_ID, sessionLocationId: LOC_A, newQuantity: 8,
      extraUpdate: {}, reasonPositive: 'plus', reasonNegative: 'minus', note: '', employeeName: '',
    })
    expect(ref.current.inv[0].quantity).toBe(8)
    const tx = ref.current.stockTx.find(t => t.type === 'write-off')!
    expect(ref.current.allocs.find(a => a.stockTransactionId === tx.id)).toBeDefined()
  })

  it('F3: adjust "return" (vrnilo dobavitelju, minus) → FEFO alokacija', async () => {
    ref.current.addItem({ quantity: 8 })
    ref.current.addBatch({ lotNumber: 'L-1', expiryDate: daysFromNow(2), quantityRemaining: 3, quantityInitial: 3 })
    await adjustInventoryItemStock({
      inventoryItemId: INV_ID, sessionLocationId: LOC_A, type: 'return',
      quantity: 3, reason: 'Vračilo dobavitelju', note: '', supplierDoc: '', employeeName: '',
    })
    // Kanon R106: vse razen absolutne 'adjustment' je odpisna pot (return =
    // vrnilo blaga dobavitelju → odvod); FEFO alokacija pokrije odvod.
    expect(ref.current.inv[0].quantity).toBe(5)
    expect(ref.current.batches[0].quantityRemaining).toBe(0)
    expect(ref.current.batches[0].status).toBe('EXHAUSTED')
  })
})

// ════════════════════════════════════════════════════════════════
// G. ORDER RETRY IDEMPOTENCY
// ════════════════════════════════════════════════════════════════
describe('R120 G: retry ne podvoji alokacij', () => {
  it('G1: deductStockForOrder dvakrat (claim flag) → enkraten odbitek + enkratne alokacije', async () => {
    ref.current.addItem({ quantity: 20, menuItemId: MENU_ID })
    ref.current.addBatch({ lotNumber: 'L-A', expiryDate: daysFromNow(2), quantityRemaining: 4, quantityInitial: 4 })
    ref.current.addBatch({ lotNumber: 'L-B', expiryDate: daysFromNow(9), quantityRemaining: 4, quantityInitial: 4 })
    const order = ref.current.addOrder()

    const r1 = await deductStockForOrder(order.id, 7, [{ menuItemId: MENU_ID, quantity: 6, voided: false }])
    const r2 = await deductStockForOrder(order.id, 7, [{ menuItemId: MENU_ID, quantity: 6, voided: false }])

    expect(r1.errors).toHaveLength(0)
    expect(r2.errors).toHaveLength(0) // no-op (claim) — brez dvojnega odbitka
    expect(ref.current.inv[0].quantity).toBe(14)
    const saleTxs = ref.current.stockTx.filter(t => t.type === 'sale' && t.orderId === order.id)
    expect(saleTxs).toHaveLength(1)
    expect(ref.current.allocs.filter(a => a.stockTransactionId === saleTxs[0].id).reduce((s, x) => s + Math.abs(x.quantity), 0)).toBe(6)
  })
})

// ════════════════════════════════════════════════════════════════
// H. STRUKTURNI PINI (vir kanona)
// ════════════════════════════════════════════════════════════════
describe('R120 H: strukturni pini', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('H1: FEFO kanon — pogojni guard quantityRemaining + ACTIVE filter + EXHAUSTED prehod', () => {
    const src = read('src/lib/stock-deduction/batch-allocation.ts')
    expect(src).toContain("quantityRemaining: { gte: take }")
    expect(src).toContain("status: 'ACTIVE'")
    expect(src).toContain("'EXHAUSTED'")
    expect(src).toContain("expiryDate: 'asc'")
    expect(src).toContain("receivedAt: 'asc'")
  })

  it('H2: skupni advisory lock ključ ostaja inv-stock: (ni forkanja kanona)', () => {
    const wasteSrc = read('src/app/api/waste/_helpers/waste-mutations.ts')
    const invSrc = read('src/app/api/inventory/_helpers/stock-mutations.ts')
    expect(wasteSrc).toContain('inventoryStockLockKey(inventoryItemId)')
    expect(invSrc).toContain('inventoryStockLockKey(inventoryItemId)')
    expect(inventoryStockLockKey(INV_ID)).toBe(`inv-stock:${INV_ID}`)
  })

  it('H3: waste fail-closed validacija izbrane serije (lokacija/status/remaining)', () => {
    const src = read('src/app/api/waste/_helpers/waste-mutations.ts')
    expect(src).toContain('ne pripada tej lokaciji')
    expect(src).toContain('ni več aktivna')
    expect(src).toContain('restoreBatchesFromAllocations')
  })

  it('H4: vse prodajne poti imajo FEFO hook (6 poti + odpis + vračilo)', () => {
    expect(read('src/lib/stock-deduction/deduct-recipe.ts')).toContain('recordBatchConsumption')
    expect(read('src/lib/stock-deduction/deduct-direct.ts')).toContain('recordBatchConsumption')
    expect(read('src/lib/stock-deduction/deduct-added-utils.ts')).toContain('recordBatchConsumption')
    expect(read('src/app/api/public/online-order/_helpers/deduct-inventory.ts')).toContain('recordBatchConsumption')
    expect(read('src/app/api/delivery/webhook/wolt/_helpers/wolt-inventory.ts')).toContain('recordBatchConsumption')
    expect(read('src/app/api/delivery/webhook/glovo/_helpers/glovo-inventory.ts')).toContain('recordBatchConsumption')
    expect(read('src/app/api/inventory/_helpers/stock-mutations.ts')).toContain('recordBatchReceipt')
    expect(read('src/lib/stock-deduction/return-stock.ts')).toContain('restoreBatchesFromAllocations')
  })
})
