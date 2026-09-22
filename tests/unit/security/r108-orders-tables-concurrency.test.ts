// ============================================
// R108 — ORDERS/TABLES WRITE KANON (add-items, transfer, merge)
//        + OUTBOX RETRY CAS — CONCURRENCY & ERROR KONTRAKT
//        (TOCTOU razred R100–R107)
// ============================================
//
// Forenzika (bug-hunt val: "naročila/mize — pisalni tokovi, ki jih R100–R107
// niso pokrili" — glej order-mutations.ts / table-ops.ts R108 header):
//
//   OR-1 (HIGH, POST /api/orders/[id]/add-items): recalc totals iz
//      TX-FRESH seznama, ampak BREZ izolacije/ključavnice → dva sočasna
//      add-items = lost update na totals (PODRAČUNAVANJE). Status check
//      tx-fresh, tx pa brez CAS → sočasen complete med branjem in pisanjem
//      = artikli na zaključenem naročilu.
//   OR-1b (HIGH): stale status check izven tx je edina zaščita (prej).
//   OR-2 (HIGH, POST /api/orders/[id]/transfer): NEPOGOJEN update tableId
//      brez tx-fresh re-reada/status preverbe → completed naročilo prenešeno,
//      mizna stanja prepišana nad sočasen merge.
//   OR-3 (HIGH, add-items): razknjižba zaloge v LOČENI tx PO commit-u
//      naročila → crash = artikli brez odbitka zaloge.
//   OR-4 (HIGH, POST /api/tables/transfer): stale seznam naročil izven tx →
//      plačano/preklicano naročilo prenešeno; source miza 'available' z
//      odprtim naročilom (tloris pokvarjen).
//   OR-5 (HIGH, POST /api/tables/merge): stale items/orders izven tx →
//      (a) orphaned revenue (artikli na preklicanem naročilu), (b) NEPOGOJEN
//      cancel → plačano naročilo preklicano, (c) recalc iz stale discount/tip
//      → lost update na totals.
//   OR-6 (MEDIUM, POST /api/outbox/[id]/retry): NEPOGOJEN reset na pending →
//      sent/processing event ponovno dostavljen (dupli FURS/SMS/webhook).
//
// Pokritje: A add-items kanon (lock/CAS/fresh totals/in-tx razknjižba) ·
// B order transfer kanon (lock graf order→table/status CAS/mizna stanja) ·
// C table-ops kanon (sorted locks/tx-fresh/CAS cancel/recalc/prenos) ·
// D outbox retry CAS · E route error kontrakt (P2034→409, strukturirani 400)
// · F fs-pini (vir pini).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Prisma } from '@prisma/client'

const LOC_A = 'loc-tenant-a'
const ORD = 'ord-1'
const TBL_SRC = 'tbl-a'
const TBL_TGT = 'tbl-b'

// --- Mocki (vi.hoisted) ---
const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  // route fast-path (db top-level)
  dbOrderFindFirst: vi.fn(),
  dbTableFindFirst: vi.fn(),
  dbOutboxFindFirst: vi.fn(),
  dbOutboxUpdateMany: vi.fn(),
  // $transaction (kanon)
  transaction: vi.fn(),
  // tx-level — skupni tx klient za order-mutations + table-ops
  txExecuteRaw: vi.fn(),
  txOrderFindFirst: vi.fn(),
  txOrderFindMany: vi.fn(),
  txOrderFindUnique: vi.fn(),
  txOrderUpdate: vi.fn(),
  txOrderUpdateMany: vi.fn(),
  txOrderCount: vi.fn(),
  txOrderItemCreate: vi.fn(),
  txOrderItemFindMany: vi.fn(),
  txOrderItemUpdate: vi.fn(),
  txMenuItemFindFirst: vi.fn(),
  txModGroupFindMany: vi.fn(),
  txTableFindFirst: vi.fn(),
  txTableUpdate: vi.fn(),
  txRecipeFindMany: vi.fn(),
  txInvFindFirst: vi.fn(),
  txInvFindUnique: vi.fn(),
  txInvUpdateMany: vi.fn(),
  txStockTxCreate: vi.fn(),
}))

// Privzeti tx klient — kanon kliče db.$transaction(fn, options)
const txClient = {
  $executeRaw: mocks.txExecuteRaw,
  order: {
    findFirst: mocks.txOrderFindFirst,
    findMany: mocks.txOrderFindMany,
    findUnique: mocks.txOrderFindUnique,
    update: mocks.txOrderUpdate,
    updateMany: mocks.txOrderUpdateMany,
    count: mocks.txOrderCount,
  },
  orderItem: {
    create: mocks.txOrderItemCreate,
    findMany: mocks.txOrderItemFindMany,
    update: mocks.txOrderItemUpdate,
  },
  menuItem: { findFirst: mocks.txMenuItemFindFirst },
  menuItemModifierGroup: { findMany: mocks.txModGroupFindMany },
  table: { findFirst: mocks.txTableFindFirst, update: mocks.txTableUpdate },
  recipeItem: { findMany: mocks.txRecipeFindMany },
  inventoryItem: {
    findFirst: mocks.txInvFindFirst,
    findUnique: mocks.txInvFindUnique,
    updateMany: mocks.txInvUpdateMany,
  },
  stockTransaction: { create: mocks.txStockTxCreate },
}

function defaultTxImpl(fn: (tx: unknown) => Promise<unknown>) {
  return fn(txClient)
}

vi.mock('@/lib/db', () => ({
  db: {
    order: { findFirst: mocks.dbOrderFindFirst },
    table: { findFirst: mocks.dbTableFindFirst },
    outboxEvent: {
      findFirst: mocks.dbOutboxFindFirst,
      updateMany: mocks.dbOutboxUpdateMany,
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

vi.mock('@/lib/ws-server-broadcast', () => ({
  wsBroadcastEvent: vi.fn(),
}))

vi.mock('@/lib/stock-deduction', () => ({
  deductStockForAddedItems: vi.fn(),
  broadcastLowStockAlert: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// --- Helperji ---
function session(locationId: string | null = LOC_A, role = 'staff') {
  return {
    session: {
      token: 'tok',
      employeeId: 'emp-1',
      role,
      permissions: ['take_orders'],
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      absoluteExpiry: Date.now() + 86400000,
      locationId,
    },
    error: null,
  }
}

function makeReq(url: string, method = 'POST', body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// Standarden tx-fresh order (in-progress, na mizi tbl-a)
function freshOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORD,
    orderNumber: 42,
    status: 'in-progress',
    paymentStatus: 'unpaid',
    locationId: LOC_A,
    tableId: TBL_SRC,
    table: { id: TBL_SRC, number: 1 },
    discount: 0,
    subtotal: 100,
    tax: 22,
    total: 122,
    tip: 5,
    orderItems: [
      { id: 'oi-old', price: 100, quantity: 1, vatRate: 22, vatAmount: 22, menuItem: { id: 'mi-0' } },
    ],
    ...overrides,
  }
}

const MENU_ITEM = { id: 'mi-1', price: 10, vatRate: 22, name: 'Testni artikel' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue(session())
  mocks.transaction.mockImplementation(defaultTxImpl)
  mocks.txExecuteRaw.mockResolvedValue(undefined)
  mocks.txOrderUpdate.mockResolvedValue({})
  mocks.txOrderUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txOrderCount.mockResolvedValue(0)
  mocks.txOrderItemCreate.mockResolvedValue({ id: 'oi-new', price: 10, quantity: 1, vatRate: 22, vatAmount: 2.2, menuItem: MENU_ITEM })
  mocks.txOrderItemUpdate.mockResolvedValue({})
  mocks.txModGroupFindMany.mockResolvedValue([]) // brez modifierjev
  mocks.txTableUpdate.mockResolvedValue({})
  mocks.txRecipeFindMany.mockResolvedValue([])
  mocks.txInvUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txStockTxCreate.mockResolvedValue({})
  mocks.dbOutboxFindFirst.mockResolvedValue({ id: 'ev-1' })
  mocks.dbOutboxUpdateMany.mockResolvedValue({ count: 1 })
})

// ════════════════════════════════════════════════════════════════
// A. ADD-ITEMS KANON (addItemsToOrder)
// ════════════════════════════════════════════════════════════════
describe('R108 A: add-items kanon — lock + Serializable + tx-fresh + in-tx razknjižba', () => {
  it('A1: Serializable izolacija + advisory lock na order-write ključu', async () => {
    const { addItemsToOrder } = await import('@/app/api/orders/[id]/_helpers/order-mutations')
    mocks.txOrderFindFirst.mockResolvedValue(freshOrder())
    mocks.txMenuItemFindFirst.mockResolvedValue(MENU_ITEM)

    await addItemsToOrder({ orderId: ORD, locationId: LOC_A, orderItems: [{ menuItemId: 'mi-1', quantity: 1 }] })

    // Serializable podan kot opcija $transaction
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    const options = mocks.transaction.mock.calls[0][1]
    expect(options).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    // Advisory lock — prvi klic v tx, ključ 'order-write:'+orderId
    // (tagged template: mock.calls[i] = [strings, ...substitutions])
    expect(mocks.txExecuteRaw).toHaveBeenCalledTimes(1)
    expect(mocks.txExecuteRaw.mock.calls[0][1]).toBe('order-write:' + ORD)
  })

  it('A2: tx-fresh scoped re-read — locationId v where', async () => {
    const { addItemsToOrder } = await import('@/app/api/orders/[id]/_helpers/order-mutations')
    mocks.txOrderFindFirst.mockResolvedValue(freshOrder())
    mocks.txMenuItemFindFirst.mockResolvedValue(MENU_ITEM)

    await addItemsToOrder({ orderId: ORD, locationId: LOC_A, orderItems: [{ menuItemId: 'mi-1', quantity: 1 }] })

    const where = mocks.txOrderFindFirst.mock.calls[0][0].where
    expect(where.id).toBe(ORD)
    expect(where.locationId).toBe(LOC_A)
  })

  it('A3: super-admin (null scope) → brez locationId ključa (nikoli { locationId: null })', async () => {
    const { addItemsToOrder } = await import('@/app/api/orders/[id]/_helpers/order-mutations')
    mocks.txOrderFindFirst.mockResolvedValue(freshOrder())
    mocks.txMenuItemFindFirst.mockResolvedValue(MENU_ITEM)

    await addItemsToOrder({ orderId: ORD, locationId: null, orderItems: [{ menuItemId: 'mi-1', quantity: 1 }] })

    const where = mocks.txOrderFindFirst.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })

  it('A4: naročilo izven scope-a → strukturirana 404 (nikoli 500)', async () => {
    const { addItemsToOrder } = await import('@/app/api/orders/[id]/_helpers/order-mutations')
    mocks.txOrderFindFirst.mockResolvedValue(null)

    await expect(
      addItemsToOrder({ orderId: ORD, locationId: LOC_A, orderItems: [{ menuItemId: 'mi-1', quantity: 1 }] }),
    ).rejects.toMatchObject({ error: 'Naročilo ni najdeno', status: 404 })
  })

  it('A5 (OR-1b): completed naročilo → CAS 400, NI create/order.update', async () => {
    const { addItemsToOrder } = await import('@/app/api/orders/[id]/_helpers/order-mutations')
    mocks.txOrderFindFirst.mockResolvedValue(freshOrder({ status: 'completed' }))

    await expect(
      addItemsToOrder({ orderId: ORD, locationId: LOC_A, orderItems: [{ menuItemId: 'mi-1', quantity: 1 }] }),
    ).rejects.toMatchObject({ status: 400 })
    expect(mocks.txOrderItemCreate).not.toHaveBeenCalled()
    expect(mocks.txOrderUpdate).not.toHaveBeenCalled()
  })

  it('A6 (OR-1): totals iz TX-FRESH seznama (stari artikli + novi) — lost update nemogoč', async () => {
    const { addItemsToOrder } = await import('@/app/api/orders/[id]/_helpers/order-mutations')
    // stale outer stanje bi računalo subtotal=100; fresh ima TUJI artikl
    // (sočasen add-items druge seje) → recalc MORA vključiti 50 tujega
    mocks.txOrderFindFirst.mockResolvedValue(freshOrder({
      orderItems: [
        { id: 'oi-old', price: 100, quantity: 1, vatRate: 22, vatAmount: 22, menuItem: { id: 'mi-0' } },
        { id: 'oi-other', price: 50, quantity: 1, vatRate: 22, vatAmount: 11, menuItem: { id: 'mi-0' } },
      ],
    }))
    mocks.txMenuItemFindFirst.mockResolvedValue(MENU_ITEM)

    await addItemsToOrder({ orderId: ORD, locationId: LOC_A, orderItems: [{ menuItemId: 'mi-1', quantity: 1 }] })

    const data = mocks.txOrderUpdate.mock.calls[0][0].data
    // subtotal = 100 (stari) + 50 (tuj, TX-FRESH) + 10 (nov) = 160
    expect(data.subtotal).toBe(160)
    // tax = 22 (stari vatAmount) + 11 (tuj vatAmount) + 2.2 (nov) = 35.2
    expect(data.tax).toBeCloseTo(35.2, 2)
    // total = 160 + 35.2 − 0 = 195.2; totalWithTip = +5
    expect(data.total).toBeCloseTo(195.2, 2)
    expect(data.totalWithTip).toBeCloseTo(200.2, 2)
  })

  it('A7 (OR-3): razknjižba zaloge v ISTI tx (recipe pot) — updateMany gte guard + StockTransaction', async () => {
    const { addItemsToOrder } = await import('@/app/api/orders/[id]/_helpers/order-mutations')
    mocks.txOrderFindFirst.mockResolvedValue(freshOrder())
    mocks.txMenuItemFindFirst.mockResolvedValue(MENU_ITEM)
    mocks.txRecipeFindMany.mockResolvedValue([{ inventoryItemId: 'inv-1', quantityPerServing: 2 }])
    mocks.txInvFindUnique
      .mockResolvedValueOnce({ id: 'inv-1', name: 'Govedina', quantity: 10, costPerUnit: 2, minQuantity: 3, locationId: LOC_A })
      .mockResolvedValueOnce({ id: 'inv-1', quantity: 8 })

    const result = await addItemsToOrder({ orderId: ORD, locationId: LOC_A, orderItems: [{ menuItemId: 'mi-1', quantity: 1 }] })

    // Atomarni gte decrement guard (P2 pariteta)
    expect(mocks.txInvUpdateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', quantity: { gte: 2 } },
      data: { quantity: { decrement: 2 } },
    })
    // StockTransaction v ISTEM tx klientu — veriga previousQty → newQty
    expect(mocks.txStockTxCreate).toHaveBeenCalledTimes(1)
    const stData = mocks.txStockTxCreate.mock.calls[0][0].data
    expect(stData).toMatchObject({ inventoryItemId: 'inv-1', quantity: -2, previousQty: 10, newQty: 8 })
    expect(result.stockResult.deducted).toHaveLength(1)
    expect(result.stockResult.deducted[0]).toMatchObject({ method: 'recipe', quantityDeducted: 2 })
  })

  it('A8: nezadostna zaloga → NI odbitka, POSKUS zapis, success=false (brez napake 500)', async () => {
    const { addItemsToOrder } = await import('@/app/api/orders/[id]/_helpers/order-mutations')
    mocks.txOrderFindFirst.mockResolvedValue(freshOrder())
    mocks.txMenuItemFindFirst.mockResolvedValue(MENU_ITEM)
    mocks.txRecipeFindMany.mockResolvedValue([{ inventoryItemId: 'inv-1', quantityPerServing: 99 }])
    mocks.txInvFindUnique.mockResolvedValue({ id: 'inv-1', name: 'Govedina', quantity: 10, costPerUnit: 2, minQuantity: 3, locationId: LOC_A })
    mocks.txInvUpdateMany.mockResolvedValue({ count: 0 })

    const result = await addItemsToOrder({ orderId: ORD, locationId: LOC_A, orderItems: [{ menuItemId: 'mi-1', quantity: 1 }] })

    expect(result.stockResult.success).toBe(false)
    expect(result.stockResult.errors).toHaveLength(1)
    expect(mocks.txStockTxCreate.mock.calls[0][0].data.quantity).toBe(0)
  })

  it('A9: MODEL A scope chain — artikel mora pripadati lokaciji naročila', async () => {
    const { addItemsToOrder } = await import('@/app/api/orders/[id]/_helpers/order-mutations')
    mocks.txOrderFindFirst.mockResolvedValue(freshOrder())
    mocks.txMenuItemFindFirst.mockResolvedValue(MENU_ITEM)

    await addItemsToOrder({ orderId: ORD, locationId: LOC_A, orderItems: [{ menuItemId: 'mi-1', quantity: 1 }] })

    const where = mocks.txMenuItemFindFirst.mock.calls[0][0].where
    expect(where.id).toBe('mi-1')
    expect(where.category.menu.locationId).toBe(LOC_A)
  })
})

// ════════════════════════════════════════════════════════════════
// B. ORDER TRANSFER KANON (transferOrderToTable)
// ════════════════════════════════════════════════════════════════
describe('R108 B: order transfer kanon — lock graf order→table + status CAS', () => {
  it('B1: Serializable + lock vrstni red (order-write → table-ops old → table-ops new)', async () => {
    const { transferOrderToTable } = await import('@/app/api/orders/[id]/_helpers/order-mutations')
    mocks.txOrderFindFirst.mockResolvedValue(freshOrder())
    mocks.txTableFindFirst.mockResolvedValue({ id: TBL_TGT, number: 2, locationId: LOC_A })

    await transferOrderToTable({ orderId: ORD, locationId: LOC_A, newTableId: TBL_TGT })

    expect(mocks.transaction.mock.calls[0][1]).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    const keys = mocks.txExecuteRaw.mock.calls.map(c => c[1])
    expect(keys).toHaveLength(3)
    expect(keys[0]).toBe('order-write:' + ORD)
    expect(keys[1]).toBe('table-ops:' + TBL_SRC)
    expect(keys[2]).toBe('table-ops:' + TBL_TGT)
  })

  it('B2 (OR-2): completed naročilo → 400, NI update naročila/miz', async () => {
    const { transferOrderToTable } = await import('@/app/api/orders/[id]/_helpers/order-mutations')
    mocks.txOrderFindFirst.mockResolvedValue(freshOrder({ status: 'completed' }))

    await expect(
      transferOrderToTable({ orderId: ORD, locationId: LOC_A, newTableId: TBL_TGT }),
    ).rejects.toMatchObject({ status: 400 })
    expect(mocks.txOrderUpdate).not.toHaveBeenCalled()
    expect(mocks.txTableUpdate).not.toHaveBeenCalled()
  })

  it('B3: naročilo izven scope-a → 404; ciljna miza izven scope-a → 404', async () => {
    const { transferOrderToTable } = await import('@/app/api/orders/[id]/_helpers/order-mutations')
    mocks.txOrderFindFirst.mockResolvedValue(null)
    await expect(
      transferOrderToTable({ orderId: ORD, locationId: LOC_A, newTableId: TBL_TGT }),
    ).rejects.toMatchObject({ status: 404 })

    mocks.txOrderFindFirst.mockResolvedValue(freshOrder())
    mocks.txTableFindFirst.mockResolvedValue(null)
    await expect(
      transferOrderToTable({ orderId: ORD, locationId: LOC_A, newTableId: TBL_TGT }),
    ).rejects.toMatchObject({ error: 'Ciljna miza ni najdena', status: 404 })
  })

  it('B4: ista miza → 400 (zgodnja stopnica pod ključavnico)', async () => {
    const { transferOrderToTable } = await import('@/app/api/orders/[id]/_helpers/order-mutations')
    mocks.txOrderFindFirst.mockResolvedValue(freshOrder({ tableId: TBL_TGT }))
    mocks.txTableFindFirst.mockResolvedValue({ id: TBL_TGT, number: 2, locationId: LOC_A })

    await expect(
      transferOrderToTable({ orderId: ORD, locationId: LOC_A, newTableId: TBL_TGT }),
    ).rejects.toMatchObject({ error: 'Naročilo je že na tej mizi', status: 400 })
  })

  it('B5 (OR-2): mizna stanja pod ključavnicama — old free (če prazna) + new occupied', async () => {
    const { transferOrderToTable } = await import('@/app/api/orders/[id]/_helpers/order-mutations')
    mocks.txOrderFindFirst.mockResolvedValue(freshOrder())
    mocks.txTableFindFirst.mockResolvedValue({ id: TBL_TGT, number: 2, locationId: LOC_A })
    mocks.txOrderCount.mockResolvedValue(0) // stara miza brez aktivih naročil

    await transferOrderToTable({ orderId: ORD, locationId: LOC_A, newTableId: TBL_TGT })

    expect(mocks.txOrderUpdate).toHaveBeenCalledWith({ where: { id: ORD }, data: { tableId: TBL_TGT }, include: { table: true } })
    expect(mocks.txOrderCount).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tableId: TBL_SRC }) }))
    expect(mocks.txTableUpdate).toHaveBeenCalledWith({ where: { id: TBL_SRC }, data: { status: 'available' } })
    expect(mocks.txTableUpdate).toHaveBeenCalledWith({ where: { id: TBL_TGT }, data: { status: 'occupied' } })
  })

  it('B6: stara miza ostane occupied, če ima še aktivna naročila', async () => {
    const { transferOrderToTable } = await import('@/app/api/orders/[id]/_helpers/order-mutations')
    mocks.txOrderFindFirst.mockResolvedValue(freshOrder())
    mocks.txTableFindFirst.mockResolvedValue({ id: TBL_TGT, number: 2, locationId: LOC_A })
    mocks.txOrderCount.mockResolvedValue(2)

    await transferOrderToTable({ orderId: ORD, locationId: LOC_A, newTableId: TBL_TGT })

    const tableUpdates = mocks.txTableUpdate.mock.calls.map(c => c[0])
    expect(tableUpdates).toHaveLength(1)
    expect(tableUpdates[0]).toEqual({ where: { id: TBL_TGT }, data: { status: 'occupied' } })
  })
})

// ════════════════════════════════════════════════════════════════
// C. TABLE-OPS KANON (transferTableOrders + mergeTables)
// ════════════════════════════════════════════════════════════════
describe('R108 C: table-ops kanon — sorted locks + tx-fresh + CAS cancel', () => {
  it('C1: transfer — ključavnici v SORTED vrstnem redu (A→B ∥ B→A deadlock nemogoč)', async () => {
    const { transferTableOrders } = await import('@/app/api/tables/_helpers/table-ops')
    // source id se sortira ZA target id → ključavnica target MORA biti prva
    mocks.txTableFindFirst.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, number: 1, locationId: LOC_A }))
    mocks.txOrderFindMany.mockResolvedValue([{ id: ORD, orderNumber: 5 }])

    await transferTableOrders({ sourceTableId: 'tbl-z', targetTableId: 'tbl-a', locationId: LOC_A })

    const keys = mocks.txExecuteRaw.mock.calls.map(c => c[1])
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe('table-ops:tbl-a')
    expect(keys[1]).toBe('table-ops:tbl-z')
  })

  it('C2 (OR-4): naročila prebrana TX-FRESH s scope-om + paymentStatus filtrom', async () => {
    const { transferTableOrders } = await import('@/app/api/tables/_helpers/table-ops')
    mocks.txTableFindFirst.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, number: 1, locationId: LOC_A }))
    mocks.txOrderFindMany.mockResolvedValue([{ id: ORD, orderNumber: 5 }])

    await transferTableOrders({ sourceTableId: TBL_SRC, targetTableId: TBL_TGT, locationId: LOC_A })

    const where = mocks.txOrderFindMany.mock.calls[0][0].where
    expect(where.tableId).toBe(TBL_SRC)
    expect(where.locationId).toBe(LOC_A)
    expect(where.status).toEqual({ in: ['pending', 'in-progress', 'ready'] })
    expect(where.paymentStatus).toEqual({ in: ['unpaid', 'partial'] })
  })

  it('C3: brez aktivih naročil → 400; tuja miza → 404 (fresh re-read)', async () => {
    const { transferTableOrders } = await import('@/app/api/tables/_helpers/table-ops')
    mocks.txTableFindFirst.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, number: 1, locationId: LOC_A }))
    mocks.txOrderFindMany.mockResolvedValue([])
    await expect(
      transferTableOrders({ sourceTableId: TBL_SRC, targetTableId: TBL_TGT, locationId: LOC_A }),
    ).rejects.toMatchObject({ error: 'Ni aktivnih naročil za prenos', status: 400 })

    mocks.txTableFindFirst
      .mockResolvedValueOnce(null) // source tuja
      .mockResolvedValueOnce({ id: TBL_TGT, number: 2, locationId: LOC_A })
    await expect(
      transferTableOrders({ sourceTableId: TBL_SRC, targetTableId: TBL_TGT, locationId: LOC_A }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('C4 (OR-4): transfer premika FRESH naročila; source freed samo pri count 0', async () => {
    const { transferTableOrders } = await import('@/app/api/tables/_helpers/table-ops')
    mocks.txTableFindFirst.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, number: 1, locationId: LOC_A }))
    mocks.txOrderFindMany.mockResolvedValue([{ id: ORD, orderNumber: 5 }, { id: 'ord-2', orderNumber: 6 }])

    const result = await transferTableOrders({ sourceTableId: TBL_SRC, targetTableId: TBL_TGT, locationId: LOC_A })

    expect(mocks.txOrderUpdate).toHaveBeenCalledTimes(2)
    expect(mocks.txOrderUpdate.mock.calls[0][0]).toEqual({ where: { id: ORD }, data: { tableId: TBL_TGT } })
    expect(result.sourceFreed).toBe(true)
    expect(mocks.txTableUpdate).toHaveBeenCalledWith({ where: { id: TBL_SRC }, data: { status: 'available' } })
    expect(mocks.txTableUpdate).toHaveBeenCalledWith({ where: { id: TBL_TGT }, data: { status: 'occupied' } })
  })

  it('C5 (OR-5b): merge CAS cancel — status+paymentStatus v where (plačano naročilo nikoli preklicano)', async () => {
    const { mergeTables } = await import('@/app/api/tables/_helpers/table-ops')
    mocks.txTableFindFirst
      .mockResolvedValueOnce({ id: TBL_SRC, number: 1, locationId: LOC_A })
      .mockResolvedValueOnce({ id: TBL_TGT, number: 2, locationId: LOC_A })
    mocks.txOrderFindMany
      .mockResolvedValueOnce([{ id: 'ord-src', paymentStatus: 'unpaid', orderItems: [{ id: 'oi-1' }] }]) // source
      .mockResolvedValueOnce([{ id: 'ord-tgt', paymentStatus: 'unpaid' }]) // target
    mocks.txOrderItemFindMany
      .mockResolvedValueOnce([{ id: 'oi-1' }]) // source items (tx-fresh)
      .mockResolvedValueOnce([{ price: 10, quantity: 2, vatAmount: 4.4 }]) // target recalc (tx-fresh)
    mocks.txOrderFindUnique.mockResolvedValue({ discount: 5, tip: 3 })

    await mergeTables({ sourceTableId: TBL_SRC, targetTableId: TBL_TGT, locationId: LOC_A })

    expect(mocks.txOrderUpdateMany).toHaveBeenCalledTimes(1)
    const cas = mocks.txOrderUpdateMany.mock.calls[0][0]
    expect(cas.where).toEqual({
      id: 'ord-src',
      status: { in: ['pending', 'in-progress', 'ready'] },
      paymentStatus: 'unpaid',
    })
    expect(cas.data).toMatchObject({ status: 'cancelled', paymentStatus: 'cancelled', tableId: null })
  })

  it('C6 (OR-5b): CAS race (count 0) → strukturirana 409, NI recalc-a', async () => {
    const { mergeTables } = await import('@/app/api/tables/_helpers/table-ops')
    mocks.txTableFindFirst
      .mockResolvedValueOnce({ id: TBL_SRC, number: 1, locationId: LOC_A })
      .mockResolvedValueOnce({ id: TBL_TGT, number: 2, locationId: LOC_A })
    mocks.txOrderFindMany
      .mockResolvedValueOnce([{ id: 'ord-src', paymentStatus: 'unpaid', orderItems: [{ id: 'oi-1' }] }])
      .mockResolvedValueOnce([{ id: 'ord-tgt', paymentStatus: 'unpaid' }])
    mocks.txOrderItemFindMany.mockResolvedValue([{ id: 'oi-1' }])
    mocks.txOrderUpdateMany.mockResolvedValue({ count: 0 }) // sočasen payment

    await expect(
      mergeTables({ sourceTableId: TBL_SRC, targetTableId: TBL_TGT, locationId: LOC_A }),
    ).rejects.toMatchObject({ status: 409 })
    expect(mocks.txOrderUpdate).not.toHaveBeenCalled() // NI recalc-a
  })

  it('C7 (OR-5c): merge recalc iz TX-FRESH items + ohrani fresh discount/tip target naročila', async () => {
    const { mergeTables } = await import('@/app/api/tables/_helpers/table-ops')
    mocks.txTableFindFirst
      .mockResolvedValueOnce({ id: TBL_SRC, number: 1, locationId: LOC_A })
      .mockResolvedValueOnce({ id: TBL_TGT, number: 2, locationId: LOC_A })
    mocks.txOrderFindMany
      .mockResolvedValueOnce([{ id: 'ord-src', paymentStatus: 'unpaid', orderItems: [{ id: 'oi-1' }, { id: 'oi-2' }] }])
      .mockResolvedValueOnce([{ id: 'ord-tgt', paymentStatus: 'unpaid' }])
    mocks.txOrderItemFindMany
      .mockResolvedValueOnce([{ id: 'oi-1' }, { id: 'oi-2' }])
      .mockResolvedValueOnce([{ price: 10, quantity: 2, vatAmount: 4.4 }])
    mocks.txOrderFindUnique.mockResolvedValue({ discount: 5, tip: 3 })

    const result = await mergeTables({ sourceTableId: TBL_SRC, targetTableId: TBL_TGT, locationId: LOC_A })

    // Artikli premaknjeni (tx-fresh seznam — oba)
    expect(mocks.txOrderItemUpdate).toHaveBeenCalledTimes(2)
    expect(mocks.txOrderItemUpdate).toHaveBeenCalledWith({ where: { id: 'oi-1' }, data: { orderId: 'ord-tgt' } })
    // recalc: subtotal = 20, tax = 4.4, discount = min(5, 20) = 5, total = 19.4, totalWithTip = 22.4
    const recalc = mocks.txOrderUpdate.mock.calls[0][0].data
    expect(recalc.subtotal).toBe(20)
    expect(recalc.tax).toBeCloseTo(4.4, 2)
    // discount se NE prepiše (ohranjen na naročilu) — total pa je izračunan z njim
    // total = 20 + 4.4 − 5 = 19.4; totalWithTip = 22.4
    expect(recalc.total).toBeCloseTo(19.4, 2)
    expect(recalc.totalWithTip).toBeCloseTo(22.4, 2)
    expect(result.targetOrderRecalculated).toBe(true)
    // target miza occupied, source available
    expect(mocks.txTableUpdate).toHaveBeenCalledWith({ where: { id: TBL_SRC }, data: { status: 'available' } })
    expect(mocks.txTableUpdate).toHaveBeenCalledWith({ where: { id: TBL_TGT }, data: { status: 'occupied' } })
  })

  it('C8: merge brez target naročila → prenos brez cancel/recalc (na mizo)', async () => {
    const { mergeTables } = await import('@/app/api/tables/_helpers/table-ops')
    mocks.txTableFindFirst
      .mockResolvedValueOnce({ id: TBL_SRC, number: 1, locationId: LOC_A })
      .mockResolvedValueOnce({ id: TBL_TGT, number: 2, locationId: LOC_A })
    mocks.txOrderFindMany
      .mockResolvedValueOnce([{ id: 'ord-src', paymentStatus: 'unpaid', orderItems: [{ id: 'oi-1' }] }])
      .mockResolvedValueOnce([]) // target PRAZEN

    const result = await mergeTables({ sourceTableId: TBL_SRC, targetTableId: TBL_TGT, locationId: LOC_A })

    expect(mocks.txOrderUpdate).toHaveBeenCalledWith({ where: { id: 'ord-src' }, data: { tableId: TBL_TGT } })
    expect(mocks.txOrderUpdateMany).not.toHaveBeenCalled() // NI cancel CAS
    expect(result.targetOrderRecalculated).toBe(false)
    expect(result.mergedOrderIds).toEqual(['ord-src'])
  })

  it('C9: partial plačilo na source → 400 (tx-fresh preverba)', async () => {
    const { mergeTables } = await import('@/app/api/tables/_helpers/table-ops')
    mocks.txTableFindFirst
      .mockResolvedValueOnce({ id: TBL_SRC, number: 1, locationId: LOC_A })
      .mockResolvedValueOnce({ id: TBL_TGT, number: 2, locationId: LOC_A })
    mocks.txOrderFindMany
      .mockResolvedValueOnce([{ id: 'ord-src', paymentStatus: 'partial', orderItems: [] }])

    await expect(
      mergeTables({ sourceTableId: TBL_SRC, targetTableId: TBL_TGT, locationId: LOC_A }),
    ).rejects.toMatchObject({ status: 400 })
  })
})

// ════════════════════════════════════════════════════════════════
// D. OUTBOX RETRY CAS (retryOutboxEvent)
// ════════════════════════════════════════════════════════════════
describe('R108 D: outbox retry — CAS state machine (samo failed/dead_letter)', () => {
  it('D1: failed event → CAS updateMany { status: { in: [failed, dead_letter] } } → true', async () => {
    const { retryOutboxEvent } = await import('@/lib/outbox')
    mocks.dbOutboxUpdateMany.mockResolvedValue({ count: 1 })

    const ok = await retryOutboxEvent('ev-1')

    expect(ok).toBe(true)
    expect(mocks.dbOutboxUpdateMany).toHaveBeenCalledWith({
      where: { id: 'ev-1', status: { in: ['failed', 'dead_letter'] } },
      data: expect.objectContaining({ status: 'pending', attempts: 0 }),
    })
  })

  it('D2 (OR-6): sent/processing event → count 0 → false (NI ponovne dostave)', async () => {
    const { retryOutboxEvent } = await import('@/lib/outbox')
    mocks.dbOutboxUpdateMany.mockResolvedValue({ count: 0 })

    const ok = await retryOutboxEvent('ev-sent')
    expect(ok).toBe(false)
  })

  it('D3: route — count 0 → 409 (klient osveži pogled)', async () => {
    const { POST } = await import('@/app/api/outbox/[id]/retry/route')
    mocks.dbOutboxUpdateMany.mockResolvedValue({ count: 0 })

    const res = await POST(
      makeReq('http://localhost/api/outbox/ev-1/retry'),
      { params: Promise.resolve({ id: 'ev-1' }) },
    )
    expect(res.status).toBe(409)
  })
})

// ════════════════════════════════════════════════════════════════
// E. ROUTE ERROR KONTRAKT (P2034→409, strukturirani 400/404)
// ════════════════════════════════════════════════════════════════
describe('R108 E: route error kontrakt', () => {
  it('E1: add-items — P2034 (sočasna modifikacija) → 409, nikoli 500', async () => {
    const { POST } = await import('@/app/api/orders/[id]/add-items/route')
    mocks.dbOrderFindFirst.mockResolvedValue(freshOrder())
    const p2034 = new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' })
    mocks.transaction.mockRejectedValue(p2034)

    const res = await POST(
      makeReq(`http://localhost/api/orders/${ORD}/add-items`, 'POST', { orderItems: [{ menuItemId: 'mi-1', quantity: 1 }] }),
      { params: Promise.resolve({ id: ORD }) },
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('sočasen dostop')
  })

  it('E2: add-items — completed naročilo (kanon 400) pride ven kot 400, ne 500', async () => {
    const { POST } = await import('@/app/api/orders/[id]/add-items/route')
    mocks.dbOrderFindFirst.mockResolvedValue(freshOrder())
    mocks.transaction.mockImplementation(defaultTxImpl)
    mocks.txOrderFindFirst.mockResolvedValue(freshOrder({ status: 'completed' }))

    const res = await POST(
      makeReq(`http://localhost/api/orders/${ORD}/add-items`, 'POST', { orderItems: [{ menuItemId: 'mi-1', quantity: 1 }] }),
      { params: Promise.resolve({ id: ORD }) },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('zaključeno')
  })

  it('E3: add-items — fast-path 404 za naročilo izven scope-a (WRITE IDOR stopnica ostaja)', async () => {
    const { POST } = await import('@/app/api/orders/[id]/add-items/route')
    mocks.dbOrderFindFirst.mockResolvedValue(null)

    const res = await POST(
      makeReq('http://localhost/api/orders/ord-foreign/add-items', 'POST', { orderItems: [{ menuItemId: 'mi-1', quantity: 1 }] }),
      { params: Promise.resolve({ id: 'ord-foreign' }) },
    )
    expect(res.status).toBe(404)
    const where = mocks.dbOrderFindFirst.mock.calls[0][0].where
    expect(where.locationId).toBe(LOC_A)
  })

  it('E4: order transfer — tuja ciljna miza → 404 (fast-path ostaja)', async () => {
    const { POST } = await import('@/app/api/orders/[id]/transfer/route')
    mocks.dbOrderFindFirst.mockResolvedValue(freshOrder())
    mocks.dbTableFindFirst.mockResolvedValue(null)

    const res = await POST(
      makeReq(`http://localhost/api/orders/${ORD}/transfer`, 'POST', { newTableId: TBL_TGT }),
      { params: Promise.resolve({ id: ORD }) },
    )
    expect(res.status).toBe(404)
    expect(mocks.dbTableFindFirst.mock.calls[0][0].where.locationId).toBe(LOC_A)
  })

  it('E5: tables/transfer — super-admin (null scope) → fast-path brez locationId ključa', async () => {
    const { POST } = await import('@/app/api/tables/transfer/route')
    mocks.requireAuth.mockResolvedValue(session(null, 'super_admin'))
    mocks.dbTableFindFirst.mockResolvedValue({ id: TBL_SRC, number: 1, locationId: LOC_A })
    mocks.txTableFindFirst.mockResolvedValue({ id: TBL_SRC, number: 1, locationId: LOC_A })
    mocks.txOrderFindMany.mockResolvedValue([{ id: ORD, orderNumber: 5 }])

    await POST(
      makeReq('http://localhost/api/tables/transfer', 'POST', { sourceTableId: TBL_SRC, targetTableId: TBL_TGT }),
    )

    const where = mocks.dbTableFindFirst.mock.calls[0][0].where
    expect(Object.prototype.hasOwnProperty.call(where, 'locationId')).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════
// F. FS-PINI — vir pini (prepreči regresijo na stale-read vzorec)
// ════════════════════════════════════════════════════════════════
describe('R108 F: fs-pini', () => {
  const ORDER_MUTATIONS = join(process.cwd(), 'src/app/api/orders/[id]/_helpers/order-mutations.ts')
  const TABLE_OPS = join(process.cwd(), 'src/app/api/tables/_helpers/table-ops.ts')
  const ADD_ITEMS_ROUTE = join(process.cwd(), 'src/app/api/orders/[id]/add-items/route.ts')
  const TRANSFER_ROUTE = join(process.cwd(), 'src/app/api/orders/[id]/transfer/route.ts')
  const TABLES_TRANSFER = join(process.cwd(), 'src/app/api/tables/transfer/route.ts')
  const TABLES_MERGE = join(process.cwd(), 'src/app/api/tables/merge/route.ts')
  const DEDUCT_ADDED = join(process.cwd(), 'src/lib/stock-deduction/deduct-added.ts')
  const OUTBOX = join(process.cwd(), 'src/lib/outbox/index.ts')

  it('F1: order-mutations kanon — Serializable + advisory lock + tx-fresh re-read', () => {
    const src = readFileSync(ORDER_MUTATIONS, 'utf8')
    expect(src).toContain('Prisma.TransactionIsolationLevel.Serializable')
    expect(src).toContain('pg_advisory_xact_lock')
    expect(src).toContain("orderWriteLockKey")
    expect(src).toContain("'order-write:' + orderId")
    // tx-fresh scoped re-read v OBEH kanonih
    expect(src.match(/tx\.order\.findFirst/g)?.length).toBeGreaterThanOrEqual(2)
    // strukturirani throw-i
    expect(src).toContain("fail('Naročilo ni najdeno', 404)")
  })

  it('F2: table-ops kanon — sorted deterministicne ključavnice + Serializable + CAS cancel', () => {
    const src = readFileSync(TABLE_OPS, 'utf8')
    expect(src).toContain('.sort()')
    expect(src).toContain("tableOpsLockKey")
    expect(src).toContain('Prisma.TransactionIsolationLevel.Serializable')
    expect(src).toContain("paymentStatus: 'unpaid'") // CAS cancel where
    expect(src).toContain("fail('Naročilo je bilo v medtem spremenjeno (plačilo/preklic) — združitev prekinjena', 409)")
  })

  it('F3: add-items route — structuredErrorResponse + P2034 → 409; string-matching handleRouteError odstranjen', () => {
    const src = readFileSync(ADD_ITEMS_ROUTE, 'utf8')
    expect(src).toContain('structuredErrorResponse')
    expect(src).toContain('P2034')
    // string-matching error kontrakt NI več v uporabi (import ali klic)
    expect(src).not.toMatch(/handleRouteError\s*\(/)
    expect(src).not.toMatch(/import\s*\{[^}]*handleRouteError/)
    // razknjižba ni več ločena tx v ruti (in-tx v kanonu)
    expect(src).not.toContain('deductStockForAddedItems')
    expect(src).toContain('addItemsToOrder')
  })

  it('F4: transfer/tables rute — P2034 → 409 + kanon klici', () => {
    for (const [path, kanon] of [
      [TRANSFER_ROUTE, 'transferOrderToTable'],
      [TABLES_TRANSFER, 'transferTableOrders'],
      [TABLES_MERGE, 'mergeTables'],
    ] as const) {
      const src = readFileSync(path, 'utf8')
      expect(src).toContain('structuredErrorResponse')
      expect(src).toContain('P2034')
      expect(src).toContain(kanon)
    }
  })

  it('F5: deduct-added izpostavi in-tx varianto (razknjižba pod tujo transakcijsko mejo)', () => {
    const src = readFileSync(DEDUCT_ADDED, 'utf8')
    expect(src).toContain('export async function deductStockForItemsInTx')
    expect(src).toContain('Prisma.TransactionClient')
  })

  it('F6: outbox retry — CAS updateMany (nikoli NEPOGOJEN update na pending)', () => {
    const src = readFileSync(OUTBOX, 'utf8')
    expect(src).toContain("status: { in: ['failed', 'dead_letter'] }")
    expect(src).toContain('Promise<boolean>')
    // retryOutboxEvent telo: updateMany CAS, NIKOLI NEPOGOJEN .update(
    const fnStart = src.indexOf('export async function retryOutboxEvent')
    const fnEnd = src.indexOf('export ', fnStart + 10)
    const fnSrc = src.slice(fnStart, fnEnd)
    expect(fnSrc).toContain('updateMany')
    expect(fnSrc).not.toMatch(/\.update\(/)
  })
})
