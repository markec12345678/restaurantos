// ============================================
// R158-6 (epic #115): sočasna poraba ZADNJIH 2 ENOT — ni namenskega testa
// ============================================
// Kanon (verificiran ×2 na HEAD, read+grep neodvisno):
//  • deduct-order.ts:11  deductStockForOrder(orderId, orderNumber, items)
//    — :24 pre-read (fast path), :31 idempotenca, :49-51 ATOMARNI CLAIM
//      updateMany({ where: { id, inventoryDeducted: false } }) znotraj tx,
//      :53-57 count=0 → no-op izstop (druga tx je že prevzela)
//  • deduct-direct.ts:55-63 — DB-POGOJNI stock guard:
//      updateMany({ where: { id, quantity: { gte: N } }, data: { decrement: N } })
//      count=0 → 'Premalo zaloge' napaka (:68-93), BREZ negative stock
//  • batch-allocation.ts:54  allocateBatchesFEFO(tx, { inventoryItemId, quantity })
//      — FEFO orderBy [{expiryDate:'asc'},{receivedAt:'asc'},{createdAt:'asc'}]
//        (:74), where { status:'ACTIVE', quantityRemaining:{gt:0} } (:68-73),
//      pogojni per-batch guard quantityRemaining:{gte:take} (:88-95),
//      :96 count=0 → preskoči serijo (stale-read varnost),
//      :104-109 izčrpana serija → status EXHAUSTED (pogojno lte:0)
//
// Trap DB izvaja DEJANSKE pogoje (gte/lte/false→true) nad stanjem — test pina
// produkcijo WHERE-pogoje, ne mock vedenja. Vsi mocki so eno-mikrotaskovski,
// kar pomeni, da se klici izmenjujejo po await točkah (stale branja so realna).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

// ---------- Trap DB stanje ----------
const trap = vi.hoisted(() => {
  const state = {
    // per-order inventoryDeducted zastavice
    orderFlags: {} as Record<string, boolean>,
    // zaloga (notranje število; snapshoti nosijo Prisma.Decimal)
    invQuantity: 2,
    inv: {
      id: 'inv-1',
      menuItemId: 'mi-1',
      locationId: 'loc-1',
      name: 'Testni artikel',
      servingsPerUnit: 1,
      costPerUnit: 2.5,
      minQuantity: 0,
    },
    // serije (FEFO)
    batches: [
      { id: 'lot-A', expiryDate: new Date('2025-06-01'), receivedAt: new Date('2025-01-01'), status: 'ACTIVE', quantityRemaining: 1 },
      { id: 'lot-B', expiryDate: new Date('2025-12-01'), receivedAt: new Date('2025-01-02'), status: 'ACTIVE', quantityRemaining: 1 },
    ] as Array<Record<string, unknown>>,
  }
  const captured = {
    orderFindUnique: [] as Array<Record<string, unknown>>,
    claimUpdateMany: [] as Array<Record<string, unknown>>,
    invFindFirst: [] as Array<Record<string, unknown>>,
    invUpdateMany: [] as Array<Record<string, unknown>>,
    batchFindMany: [] as Array<Record<string, unknown>>,
    batchUpdateMany: [] as Array<Record<string, unknown>>,
    stockTxCreate: [] as Array<Record<string, unknown>>,
  }
  let stxSeq = 0
  return {
    state,
    captured,
    reset: () => {
      stxSeq = 0
    },
    nextStxId: () => `stx-${++stxSeq}`,
  }
})

function invSnapshot() {
  return { ...trap.state.inv, quantity: new Prisma.Decimal(trap.state.invQuantity) }
}
function batchSnapshots() {
  // DB semantika: snapshot ob branju + FEFO sortiranje (expiry ASC, NULL zadnji)
  const rows = trap.state.batches.map((b) => ({
    ...(b as { id: string; expiryDate: Date | null; receivedAt: Date | null; status: string }),
    quantityRemaining: new Prisma.Decimal(b.quantityRemaining as number),
  }))
  rows.sort((a, b) => {
    const ea = a.expiryDate as Date | null
    const eb = b.expiryDate as Date | null
    if (ea && eb) return ea.getTime() - eb.getTime()
    if (ea) return -1
    if (eb) return 1
    return 0
  })
  return rows
}

// En skupni tx mock — implementira DB-pogojne predikate nad stanjem
function makeTx() {
  return {
    order: {
      updateMany: vi.fn(async (args: Record<string, unknown>) => {
        trap.captured.claimUpdateMany.push(args)
        const where = args.where as { id: string; inventoryDeducted: boolean }
        // flags start EMPTY — manjkajoči ključ = false (DB stolpec
        // inventoryDeducted je false ob pre-readu :24); — false bi
        // spodletel na undefined in vsak claim vrnil count=0 (no-op)
        if (!trap.state.orderFlags[where.id]) {
          trap.state.orderFlags[where.id] = true
          return { count: 1 }
        }
        return { count: 0 }
      }),
    },
    recipeItem: {
      findMany: vi.fn(async () => []), // → direct pot
    },
    inventoryItem: {
      findFirst: vi.fn(async (args: Record<string, unknown>) => {
        trap.captured.invFindFirst.push(args)
        return invSnapshot()
      }),
      updateMany: vi.fn(async (args: Record<string, unknown>) => {
        trap.captured.invUpdateMany.push(args)
        const where = args.where as { id: string; quantity?: { gte: number } }
        const data = args.data as { quantity?: { decrement: number } }
        const need = where.quantity?.gte
        if (need != null && trap.state.invQuantity < need) return { count: 0 }
        if (data.quantity?.decrement != null) trap.state.invQuantity -= data.quantity.decrement
        return { count: 1 }
      }),
      findUnique: vi.fn(async () => invSnapshot()),
    },
    inventoryBatch: {
      findMany: vi.fn(async (args: Record<string, unknown>) => {
        trap.captured.batchFindMany.push(args)
        return batchSnapshots()
      }),
      updateMany: vi.fn(async (args: Record<string, unknown>) => {
        trap.captured.batchUpdateMany.push(args)
        const where = args.where as {
          id: string
          status?: string
          quantityRemaining?: { gte?: number; lte?: number }
        }
        const data = args.data as { quantityRemaining?: { decrement?: number }; status?: string }
        const row = trap.state.batches.find((b) => b.id === where.id)
        if (!row) return { count: 0 }
        if (where.status != null && row.status !== where.status) return { count: 0 }
        if (where.quantityRemaining?.gte != null && (row.quantityRemaining as number) < where.quantityRemaining.gte)
          return { count: 0 }
        if (where.quantityRemaining?.lte != null && (row.quantityRemaining as number) > where.quantityRemaining.lte)
          return { count: 0 }
        if (data.quantityRemaining?.decrement != null) {
          row.quantityRemaining = (row.quantityRemaining as number) - data.quantityRemaining.decrement
        }
        if (data.status != null) row.status = data.status
        return { count: 1 }
      }),
      findUnique: vi.fn(async (args: Record<string, unknown>) => {
        const where = args.where as { id: string }
        const row = trap.state.batches.find((b) => b.id === where.id)
        if (!row) return null
        return { quantityRemaining: new Prisma.Decimal(row.quantityRemaining as number) }
      }),
    },
    stockTransaction: {
      create: vi.fn(async (args: Record<string, unknown>) => {
        trap.captured.stockTxCreate.push(args.data as Record<string, unknown>)
        return { id: trap.nextStxId() }
      }),
    },
  }
}

type Tx = ReturnType<typeof makeTx>

vi.mock('@/lib/db', () => {
  const shared: { tx: Tx | null } = { tx: null }
  return {
    db: {
      order: {
        findUnique: vi.fn(async (args: Record<string, unknown>) => {
          trap.captured.orderFindUnique.push(args)
          const where = args.where as { id: string }
          return {
            id: where.id,
            inventoryDeducted: trap.state.orderFlags[where.id] ?? false,
            locationId: 'loc-1',
          }
        }),
      },
      $transaction: vi.fn(async (fn: (tx: Tx) => Promise<unknown>) => {
        if (!shared.tx) shared.tx = makeTx()
        return fn(shared.tx)
      }),
    },
  }
})

// Import PO mockih (produkcija)
import { deductStockForOrder } from '@/lib/stock-deduction/deduct-order'
import { allocateBatchesFEFO } from '@/lib/stock-deduction/batch-allocation'

const ITEM_1 = [{ menuItemId: 'mi-1', quantity: 1 }]
type FefoTx = Parameters<typeof allocateBatchesFEFO>[0]

beforeEach(() => {
  trap.state.orderFlags = {}
  trap.state.invQuantity = 2
  trap.state.batches = [
    { id: 'lot-A', expiryDate: new Date('2025-06-01'), receivedAt: new Date('2025-01-01'), status: 'ACTIVE', quantityRemaining: 1 },
    { id: 'lot-B', expiryDate: new Date('2025-12-01'), receivedAt: new Date('2025-01-02'), status: 'ACTIVE', quantityRemaining: 1 },
  ]
  trap.captured.orderFindUnique.length = 0
  trap.captured.claimUpdateMany.length = 0
  trap.captured.invFindFirst.length = 0
  trap.captured.invUpdateMany.length = 0
  trap.captured.batchFindMany.length = 0
  trap.captured.batchUpdateMany.length = 0
  trap.captured.stockTxCreate.length = 0
  trap.reset()
})

describe('R158-6 [P3]: sočasna poraba zadnjih 2 enot (DB-pogojni kanon)', () => {
  it('V1a: dve vzporedni porabi po 1 enoti na 2 enotah — obe uspešni, končno stanje točno 0, brez dvojne porabe', async () => {
    const [r1, r2] = await Promise.all([
      deductStockForOrder('o-1', 101, ITEM_1),
      deductStockForOrder('o-2', 102, ITEM_1),
    ])

    // Obe uspešni, vsaka točno 1 enota (skupaj 2 = celotna zaloga)
    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    const total =
      r1.deducted.reduce((s, d) => s + d.quantityDeducted, 0) +
      r2.deducted.reduce((s, d) => s + d.quantityDeducted, 0)
    expect(total).toBe(2)
    expect(r1.errors).toHaveLength(0)
    expect(r2.errors).toHaveLength(0)

    // Končno stanje: točno 0 — ne negativno (ni oversella)
    expect(trap.state.invQuantity).toBe(0)

    // Oba order-claima uspela (različna naročila — vsak svoj atomic claim)
    expect(trap.captured.claimUpdateMany).toHaveLength(2)
    for (const args of trap.captured.claimUpdateMany) {
      const where = args.where as { inventoryDeducted: boolean }
      expect(where.inventoryDeducted).toBe(false)
    }

    // DB-POGOJNI stock guard pin — gte v where (atomarni check, deduct-direct :58)
    expect(trap.captured.invUpdateMany).toHaveLength(2)
    for (const args of trap.captured.invUpdateMany) {
      const where = args.where as { quantity?: { gte: number } }
      expect(where.quantity).toEqual({ gte: 1 })
    }

    // 2 prodajne vrstici (po ena na naročilo), vsaka −1
    expect(trap.captured.stockTxCreate).toHaveLength(2)
    for (const data of trap.captured.stockTxCreate) {
      expect(data.type).toBe('sale')
      expect(data.quantity).toBe(-1)
    }
  })

  it('V1b: tretja vzporedna poraba na izčrpani zalogi — count=0, brez oversella (0 ostane 0, ne negativno), audit vrstica z 0', async () => {
    const [r1, r2, r3] = await Promise.all([
      deductStockForOrder('o-1', 201, ITEM_1),
      deductStockForOrder('o-2', 202, ITEM_1),
      deductStockForOrder('o-3', 203, ITEM_1),
    ])

    // Natanko 2 uspešni (zaloga 2), tretja zavrnjena s count=0
    const ok = [r1, r2, r3].filter((r) => r.success)
    const fail = [r1, r2, r3].filter((r) => !r.success)
    expect(ok).toHaveLength(2)
    expect(fail).toHaveLength(1)

    // Zavrnitev: 'Premalo zaloge' napaka (deduct-direct :76), brez dedukcije
    expect(fail[0].errors.length).toBeGreaterThan(0)
    expect(fail[0].errors.some((e) => e.error.includes('Premalo zaloge'))).toBe(true)
    expect(fail[0].deducted.reduce((s, d) => s + d.quantityDeducted, 0)).toBe(0)

    // Ni oversella: končno 0, skupaj odbito točno 2
    expect(trap.state.invQuantity).toBe(0)
    const totalDeducted = [r1, r2, r3]
      .flatMap((r) => r.deducted)
      .reduce((s, d) => s + d.quantityDeducted, 0)
    expect(totalDeducted).toBe(2)

    // 3 vrstice: 2 uspešni (−1) + 1 poskus (0, deduct-direct :85)
    expect(trap.captured.stockTxCreate).toHaveLength(3)
    const quantities = trap.captured.stockTxCreate
      .map((d) => d.quantity as number)
      .sort((a, b) => a - b)
    expect(quantities).toEqual([-1, -1, 0])
  })

  it('V2: 2 seriji × 1 enota, 2 vzporedni porabi — FEFO izhaja iz GUARDA (stale read + count=0 → naslednja serija), brez negativcev, obe izčrpani', async () => {
    // Hišni vzorec: allocateBatchesFEFO direktno (batch-allocation.ts:54)
    const [s1, s2] = await Promise.all([
      allocateBatchesFEFO(makeTx() as unknown as FefoTx, { inventoryItemId: 'inv-1', quantity: 1 }),
      allocateBatchesFEFO(makeTx() as unknown as FefoTx, { inventoryItemId: 'inv-1', quantity: 1 }),
    ])

    // Vsak klic dobi točno 1 rezino; starejša serija (lot-A) porabljena prva
    // (FEFO prek pogojnega guarda, ne prek branja)
    expect(s1).toEqual([{ batchId: 'lot-A', quantity: -1 }])
    expect(s2).toEqual([{ batchId: 'lot-B', quantity: -1 }])

    // Končno stanje: obe seriji točno 0 — ne negativno
    const a = trap.state.batches.find((b) => b.id === 'lot-A')!
    const b = trap.state.batches.find((b) => b.id === 'lot-B')!
    expect(a.quantityRemaining).toBe(0)
    expect(b.quantityRemaining).toBe(0)

    // FEFO orderBy pin (batch-allocation :74) + aktivne serije z ostankom (where :68-73)
    const findManyArgs = trap.captured.batchFindMany as unknown as Array<{
      where: Record<string, unknown>
      orderBy: Array<Record<string, string>>
    }>
    expect(findManyArgs.length).toBeGreaterThanOrEqual(1)
    expect(findManyArgs[0].orderBy).toEqual([
      { expiryDate: 'asc' },
      { receivedAt: 'asc' },
      { createdAt: 'asc' },
    ])
    expect(findManyArgs[0].where).toMatchObject({
      inventoryItemId: 'inv-1',
      status: 'ACTIVE',
      quantityRemaining: { gt: 0 },
    })

    // Guard pin: vsak uspešen odvod šel skozi pogojni updateMany z gte
    const decrementGuards = trap.captured.batchUpdateMany.filter(
      (args) =>
        (args.data as { quantityRemaining?: { decrement?: number } }).quantityRemaining?.decrement != null,
    )
    // 3 poskusi: 2 uspešna odvoda (lot-A, lot-B) + 1 ZAVRJEN stale poskus na
    // lot-A (count=0 → FEFO preskok na naslednjo serijo — TO je dokaz
    // race-varovalke; zavrnjen poskus še vedno nosi decrement v data).
    expect(decrementGuards).toHaveLength(3)
    for (const args of decrementGuards) {
      const where = args.where as { quantityRemaining?: { gte: number } }
      expect(where.quantityRemaining).toEqual({ gte: 1 })
    }

    // Izčrpani status: obe seriji preklopljeni v EXHAUSTED (pogojno lte:0, :105-109)
    expect(a.status).toBe('EXHAUSTED')
    expect(b.status).toBe('EXHAUSTED')
  })
})
