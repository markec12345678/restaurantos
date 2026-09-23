// ============================================
// R112-A — ORDER/KDS WRITE-PATH CAS KANON
//   (fire CAS + auto-KOT dedup lock + item-status tx kanon +
//    cancel kanon: plačano naročilo NI preklicano)
//   — CONCURRENCY & ERROR KONTRAKT (TOCTOU razred R100–R111)
// ============================================
//
// Forenzika (glej orders/[id]/webhooks/handle-fire-action.ts,
// handle-item-status.ts, perform-soft-delete.ts, order-items/[id]/route.ts):
//
//   ORD-1 (HIGH, PATCH fire): NEPOGOJEN order.update → fire na
//     'cancelled'/'completed' naročilo ga je OŽIVIL v KDS ('in-progress')
//     + artikli nazaj v 'preparing'. Plačano (paid) naročilo je bilo
//     prav tako oživljivo. Fix: CAS updateMany ({ status in
//     [pending, in-progress, ready], paymentStatus != paid }), count 0 → 409.
//   ORD-2 (MEDIUM, fire auto-KOT): check-then-act IZVEN tx → dva vzporedna
//     fire-a = DVA 'original' KOT-a. Fix: advisory lock 'kot-fire:{orderId}'
//     + tx-fresh dedup + counter ZNOTRAJ tx.
//   ORD-3 (MED-HIGH, PATCH item_status): stale cancelled guard + NEPOGOJEN
//     item update (prepir z void claimom) + auto-promotion regresija
//     'completed' → 'ready'. Fix: Serializable tx + advisory lock
//     'order-write:{orderId}' + tx-fresh guardi + CAS na artiklu IN naročilu.
//   ORD-4 (HIGH, DELETE soft-delete): NEPOGOJEN cancel → v race-u s plačilom
//     PREKLICAL PLAČANO naročilo (denar prejet, zaloga vrnjena). Fix:
//     Serializable tx + lock 'order-write:{orderId}' + tx-fresh guard
//     (status IN paymentStatus 'paid' → zavrnjeno) + CAS žig; stranski
//     učinki ŠELE po uspešnem žigu. Strukturiran { ok, reason } rezultat.
//   ORD-5/6 (MEDIUM, PUT /api/order-items/[id]): status/notes pot NEPOGOJEN
//     update prepiše void; auto-promotion NEPOGOJEN update regresira
//     plačano naročilo. Fix: CAS updateMany ({ voided: false, order.status
//     != cancelled }) + CAS promotion ({ status in [pending, in-progress] }).
//
// Pokritje: A fire kanon · B item-status kanon · C cancel kanon ·
// D fs-pini (vir pini).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Prisma } from '@prisma/client'

const ORD = 'ord-1'
const LOC_A = 'loc-tenant-a'

// --- Mocki (vi.hoisted) ---
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  // db-client (izven tx)
  orderUpdateMany: vi.fn(),
  orderFindUnique: vi.fn(),
  orderItemUpdateMany: vi.fn(),
  orderItemFindUnique: vi.fn(),
  orderItemFindMany: vi.fn(),
  // tx-client
  txExecuteRaw: vi.fn(),
  txOrderFindUnique: vi.fn(),
  txOrderUpdateMany: vi.fn(),
  txOrderItemFindFirst: vi.fn(),
  txOrderItemUpdateMany: vi.fn(),
  txOrderItemFindMany: vi.fn(),
  txKotFindFirst: vi.fn(),
  txKotCreate: vi.fn(),
  // infra
  getNextCounter: vi.fn(),
  broadcastWSEvent: vi.fn(),
  broadcastWS: vi.fn(),
  wsBroadcastEvent: vi.fn(),
  freeTableIfNoActiveOrders: vi.fn(),
  returnStockForOrder: vi.fn(),
}))

// Privzeti tx klient (deljen A/B/C — ločene mock funkcije)
const txClient = {
  $executeRaw: mocks.txExecuteRaw,
  order: { findUnique: mocks.txOrderFindUnique, updateMany: mocks.txOrderUpdateMany },
  orderItem: {
    findFirst: mocks.txOrderItemFindFirst,
    updateMany: mocks.txOrderItemUpdateMany,
    findMany: mocks.txOrderItemFindMany,
  },
  kotDocument: { findFirst: mocks.txKotFindFirst, create: mocks.txKotCreate },
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mocks.transaction,
    order: { updateMany: mocks.orderUpdateMany, findUnique: mocks.orderFindUnique },
    orderItem: {
      updateMany: mocks.orderItemUpdateMany,
      findUnique: mocks.orderItemFindUnique,
      findMany: mocks.orderItemFindMany,
    },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/counters', () => ({
  getNextCounter: mocks.getNextCounter,
}))

vi.mock('@/lib/websocket-client', () => ({
  broadcastWSEvent: mocks.broadcastWSEvent,
}))

vi.mock('@/lib/ws-server-broadcast', () => ({
  wsBroadcastEvent: mocks.wsBroadcastEvent,
}))

// '../_helpers' iz webhooks datotek se resolva na STARŠEVSKI _helpers mapo
// (orders/[id]/_helpers/index.ts) — broadcastWS + freeTableIfNoActiveOrders
vi.mock('@/app/api/orders/[id]/_helpers', () => ({
  broadcastWS: mocks.broadcastWS,
  freeTableIfNoActiveOrders: mocks.freeTableIfNoActiveOrders,
}))

vi.mock('@/lib/stock-deduction', () => ({
  returnStockForOrder: mocks.returnStockForOrder,
}))

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { handleFireAction } from '@/app/api/orders/[id]/webhooks/handle-fire-action'
import { handleItemStatusUpdate } from '@/app/api/orders/[id]/webhooks/handle-item-status'
import { performOrderSoftDelete } from '@/app/api/orders/[id]/webhooks/perform-soft-delete'

const STALE_ORDER = { id: ORD, status: 'in-progress', orderNumber: 42, locationId: LOC_A }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient))
  mocks.txExecuteRaw.mockResolvedValue(0)
  // C — cancel privzeti uspeh
  mocks.txOrderFindUnique.mockResolvedValue({ status: 'in-progress', paymentStatus: 'unpaid' })
  mocks.txOrderUpdateMany.mockResolvedValue({ count: 1 })
  mocks.freeTableIfNoActiveOrders.mockResolvedValue(undefined)
  mocks.returnStockForOrder.mockResolvedValue(undefined)
})

// ============================================
// A — FIRE KANON (ORD-1 + ORD-2)
// ============================================
describe('R112-A: fire kanon (CAS + KOT dedup)', () => {
  const fireOrder = {
    id: ORD, orderNumber: 42, type: 'dine-in', status: 'in-progress',
    locationId: LOC_A, notes: '', employeeId: 'emp-1', table: { number: 5 },
    orderItems: [],
  }

  it('veljaven fire: CAS žig { status in [pending,in-progress,ready], paymentStatus != paid }', async () => {
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 })
    mocks.orderItemUpdateMany.mockResolvedValue({ count: 2 })
    mocks.orderFindUnique.mockResolvedValue(fireOrder)
    mocks.txKotFindFirst.mockResolvedValue(null)
    mocks.txOrderFindUnique.mockResolvedValue(fireOrder)
    mocks.txKotCreate.mockResolvedValue({})
    mocks.getNextCounter.mockResolvedValue(7)

    const res = await handleFireAction(ORD)
    expect(res.status).toBe(200)
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: ORD,
          paymentStatus: { not: 'paid' },
        }),
        data: expect.objectContaining({ status: 'in-progress' }),
      }),
    )
    const where = mocks.orderUpdateMany.mock.calls[0][0].where
    expect([...where.status.in].sort()).toEqual(['in-progress', 'pending', 'ready'])
  })

  it('fire na cancelled/completed/paid naročilu → CAS count 0 → 409, KDS NI oživljen', async () => {
    mocks.orderUpdateMany.mockResolvedValue({ count: 0 })
    const res = await handleFireAction(ORD)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('preklicano, zaključeno ali plačano')
    expect(mocks.orderItemUpdateMany).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.broadcastWSEvent).not.toHaveBeenCalled()
  })

  it('pending artikli → preparing SAMO ne-voidani (voided: false v pogoju)', async () => {
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 })
    mocks.orderItemUpdateMany.mockResolvedValue({ count: 1 })
    mocks.orderFindUnique.mockResolvedValue(fireOrder)
    mocks.txKotFindFirst.mockResolvedValue({ id: 'kot-1' })
    await handleFireAction(ORD)
    expect(mocks.orderItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: ORD, status: 'pending', voided: false },
        data: expect.objectContaining({ status: 'preparing' }),
      }),
    )
  })

  it('ORD-2: auto-KOT pod advisory lockom kot-fire:{orderId} (tagged template param)', async () => {
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 })
    mocks.orderItemUpdateMany.mockResolvedValue({ count: 1 })
    mocks.orderFindUnique.mockResolvedValue(fireOrder)
    mocks.txKotFindFirst.mockResolvedValue(null)
    mocks.txOrderFindUnique.mockResolvedValue(fireOrder)
    mocks.txKotCreate.mockResolvedValue({})
    mocks.getNextCounter.mockResolvedValue(7)

    await handleFireAction(ORD)
    // Tagged template: (stringsArray, lockParam) — ključ VEDNO iz posameznega orderja
    expect(mocks.txExecuteRaw).toHaveBeenCalledTimes(1)
    expect(mocks.txExecuteRaw.mock.calls[0][1]).toBe(`kot-fire:${ORD}`)
  })

  it('ORD-2: obstoječ original KOT → create NI poklican (dedup, brez dvojnika)', async () => {
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 })
    mocks.orderItemUpdateMany.mockResolvedValue({ count: 1 })
    mocks.orderFindUnique.mockResolvedValue(fireOrder)
    mocks.txKotFindFirst.mockResolvedValue({ id: 'kot-existing' })

    await handleFireAction(ORD)
    expect(mocks.txKotCreate).not.toHaveBeenCalled()
    expect(mocks.getNextCounter).not.toHaveBeenCalled()
  })

  it('ORD-2: brez original KOT-a → create z type original + counter ZNOTRAJ tx', async () => {
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 })
    mocks.orderItemUpdateMany.mockResolvedValue({ count: 1 })
    mocks.orderFindUnique.mockResolvedValue(fireOrder)
    mocks.txKotFindFirst.mockResolvedValue(null)
    mocks.txOrderFindUnique.mockResolvedValue(fireOrder)
    mocks.txKotCreate.mockResolvedValue({})
    mocks.getNextCounter.mockResolvedValue(7)

    await handleFireAction(ORD)
    expect(mocks.getNextCounter).toHaveBeenCalledWith('kotNumber', txClient)
    expect(mocks.txKotCreate).toHaveBeenCalledTimes(1)
    expect(mocks.txKotCreate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ orderId: ORD, type: 'original', kotNumber: 7, status: 'pending' }),
    )
  })

  it('KOT dedup P2002/P2034 ne odpove fire-a (best-effort kontrakt ohranjen)', async () => {
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 })
    mocks.orderItemUpdateMany.mockResolvedValue({ count: 1 })
    mocks.orderFindUnique.mockResolvedValue(fireOrder)
    mocks.txExecuteRaw.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2002', clientVersion: 'test' }),
    )

    const res = await handleFireAction(ORD)
    expect(res.status).toBe(200)
    expect(mocks.broadcastWSEvent).toHaveBeenCalledWith(
      'ORDER_FIRED',
      expect.objectContaining({ orderId: ORD, locationId: LOC_A }),
    )
  })
})

// ============================================
// B — ITEM-STATUS KANON (ORD-3)
// ============================================
describe('R112-B: item-status kanon (tx-fresh guardi + CAS)', () => {
  it('tx pod advisory lockom order-write:{orderId} + Serializable', async () => {
    mocks.txOrderFindUnique.mockResolvedValue({ id: ORD, status: 'in-progress', orderNumber: 42, locationId: LOC_A })
    mocks.txOrderItemFindFirst.mockResolvedValue({ id: 'oi-1', orderId: ORD, voided: false, status: 'pending' })
    mocks.txOrderItemUpdateMany.mockResolvedValue({ count: 1 })
    mocks.txOrderItemFindMany.mockResolvedValue([{ status: 'preparing' }, { status: 'ready' }])
    mocks.orderItemFindUnique.mockResolvedValue(null)

    await handleItemStatusUpdate(ORD, 'oi-1', 'ready', STALE_ORDER)
    expect(mocks.txExecuteRaw.mock.calls[0][1]).toBe(`order-write:${ORD}`)
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  })

  it('tx-fresh cancelled guard: preklic med route read in tx → 400 (stale read NE uide)', async () => {
    // stale argument pravi 'in-progress', tx-fresh pa 'cancelled'
    mocks.txOrderFindUnique.mockResolvedValue({ id: ORD, status: 'cancelled', orderNumber: 42, locationId: LOC_A })
    const result = await handleItemStatusUpdate(ORD, 'oi-1', 'ready', STALE_ORDER)
    expect(result).toEqual({ error: 'Preklicano naročilo ni mogoče spreminjati', status: 400 })
    expect(mocks.txOrderItemUpdateMany).not.toHaveBeenCalled()
  })

  it('voidan artikel → 409 (KDS tap NE prepiše voida)', async () => {
    mocks.txOrderFindUnique.mockResolvedValue({ id: ORD, status: 'in-progress', orderNumber: 42, locationId: LOC_A })
    mocks.txOrderItemFindFirst.mockResolvedValue({ id: 'oi-1', orderId: ORD, voided: true, status: 'voided' })
    const result = await handleItemStatusUpdate(ORD, 'oi-1', 'ready', STALE_ORDER)
    expect(result).toEqual({ error: 'Voidan artikel ni mogoče spreminjati', status: 409 })
    expect(mocks.txOrderItemUpdateMany).not.toHaveBeenCalled()
  })

  it('CAS claim count 0 (void je pravkar zmagal) → 409', async () => {
    mocks.txOrderFindUnique.mockResolvedValue({ id: ORD, status: 'in-progress', orderNumber: 42, locationId: LOC_A })
    mocks.txOrderItemFindFirst.mockResolvedValue({ id: 'oi-1', orderId: ORD, voided: false, status: 'pending' })
    mocks.txOrderItemUpdateMany.mockResolvedValue({ count: 0 })
    const result = await handleItemStatusUpdate(ORD, 'oi-1', 'ready', STALE_ORDER)
    expect(result).toMatchObject({ status: 409 })
    expect(mocks.txOrderItemUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'oi-1', orderId: ORD, voided: false }),
      }),
    )
  })

  it('auto-promotion CAS: izključno iz pending/in-progress — completed se NE regresira', async () => {
    // vsi itemi ready, tx-fresh order pa ŽE 'completed' (plačano) → brez promotion
    mocks.txOrderFindUnique.mockResolvedValue({ id: ORD, status: 'completed', orderNumber: 42, locationId: LOC_A })
    mocks.txOrderItemFindFirst.mockResolvedValue({ id: 'oi-1', orderId: ORD, voided: false, status: 'ready' })
    mocks.txOrderItemUpdateMany.mockResolvedValue({ count: 1 })
    mocks.txOrderItemFindMany.mockResolvedValue([{ status: 'ready' }, { status: 'served' }])
    mocks.orderItemFindUnique.mockResolvedValue(null)

    await handleItemStatusUpdate(ORD, 'oi-1', 'served', STALE_ORDER)
    expect(mocks.txOrderUpdateMany).not.toHaveBeenCalled()
  })

  it('auto-promotion uspešen CAS: pending + vsi ready → updateMany { status in [pending,in-progress] }', async () => {
    mocks.txOrderFindUnique.mockResolvedValue({ id: ORD, status: 'in-progress', orderNumber: 42, locationId: LOC_A })
    mocks.txOrderItemFindFirst.mockResolvedValue({ id: 'oi-1', orderId: ORD, voided: false, status: 'pending' })
    mocks.txOrderItemUpdateMany.mockResolvedValue({ count: 1 })
    mocks.txOrderItemFindMany.mockResolvedValue([{ status: 'ready' }, { status: 'ready' }])
    mocks.txOrderUpdateMany.mockResolvedValue({ count: 1 })
    mocks.orderItemFindUnique.mockResolvedValue(null)

    const result = await handleItemStatusUpdate(ORD, 'oi-1', 'ready', STALE_ORDER)
    expect(result).toMatchObject({ success: true })
    expect(mocks.txOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: ORD }),
        data: { status: 'ready' },
      }),
    )
    const where = mocks.txOrderUpdateMany.mock.calls[0][0].where
    expect([...where.status.in].sort()).toEqual(['in-progress', 'pending'])
  })

  it('P2034 Serializable konflikt → strukturiran 409 (nikoli 500)', async () => {
    mocks.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' }),
    )
    const result = await handleItemStatusUpdate(ORD, 'oi-1', 'ready', STALE_ORDER)
    expect(result).toEqual({
      error: 'Naročilo je v obdelavi (sočasen dostop) — poskusite znova',
      status: 409,
    })
  })

  it('broadcast nosi tx-fresh orderNumber/locationId (ne zastarel argument)', async () => {
    mocks.txOrderFindUnique.mockResolvedValue({ id: ORD, status: 'in-progress', orderNumber: 99, locationId: 'loc-fresh' })
    mocks.txOrderItemFindFirst.mockResolvedValue({ id: 'oi-1', orderId: ORD, voided: false, status: 'preparing' })
    mocks.txOrderItemUpdateMany.mockResolvedValue({ count: 1 })
    mocks.txOrderItemFindMany.mockResolvedValue([{ status: 'preparing' }])
    mocks.orderItemFindUnique.mockResolvedValue(null)

    await handleItemStatusUpdate(ORD, 'oi-1', 'ready', STALE_ORDER)
    expect(mocks.broadcastWS).toHaveBeenCalledWith(
      'ITEM_STATUS_UPDATE',
      expect.objectContaining({ orderId: ORD, orderNumber: 99, locationId: 'loc-fresh', itemId: 'oi-1', status: 'ready' }),
    )
  })
})

// ============================================
// C — CANCEL KANON (ORD-4)
// ============================================
describe('R112-C: cancel kanon (plačano naročilo NI preklicano)', () => {
  const baseOrder = {
    tableId: 'tbl-1', orderNumber: 42, inventoryDeducted: true,
    receipt: [], locationId: LOC_A,
  }

  it('uspešen cancel: CAS žig { id, status: fresh, paymentStatus != paid } + stranski učinki ŠELE po žigu', async () => {
    const sideEffects: string[] = []
    mocks.freeTableIfNoActiveOrders.mockImplementation(async () => { sideEffects.push('table') })
    mocks.returnStockForOrder.mockImplementation(async () => { sideEffects.push('stock') })
    // CAS žig preveri VRSTNI RED: žig se zgodi v tx (transakcija) — stranski
    // učinki ŠELE po njej. Zaporedje zapišemo tudi v tx mocku.
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const r = await fn(txClient)
      sideEffects.push('tx-done')
      return r
    })

    const result = await performOrderSoftDelete(ORD, baseOrder, 'emp-1')
    expect(result).toEqual({ ok: true })
    expect(mocks.txOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORD, status: 'in-progress', paymentStatus: { not: 'paid' } },
        data: expect.objectContaining({ status: 'cancelled' }),
      }),
    )
    expect(sideEffects).toEqual(['tx-done', 'table', 'stock'])
    expect(mocks.txExecuteRaw.mock.calls[0][1]).toBe(`order-write:${ORD}`)
  })

  it('tx-fresh paymentStatus paid → { ok: false, reason: paid }, NI cancel žiga NI stranskih učinkov', async () => {
    mocks.txOrderFindUnique.mockResolvedValue({ status: 'in-progress', paymentStatus: 'paid' })
    const result = await performOrderSoftDelete(ORD, baseOrder, 'emp-1')
    expect(result).toEqual({ ok: false, reason: 'paid' })
    expect(mocks.txOrderUpdateMany).not.toHaveBeenCalled()
    expect(mocks.freeTableIfNoActiveOrders).not.toHaveBeenCalled()
    expect(mocks.returnStockForOrder).not.toHaveBeenCalled()
  })

  it('tx-fresh already cancelled → reason already_cancelled (duplicate DELETE je varno zavrnjen)', async () => {
    mocks.txOrderFindUnique.mockResolvedValue({ status: 'cancelled', paymentStatus: 'unpaid' })
    const result = await performOrderSoftDelete(ORD, baseOrder, 'emp-1')
    expect(result).toEqual({ ok: false, reason: 'already_cancelled' })
    expect(mocks.txOrderUpdateMany).not.toHaveBeenCalled()
  })

  it('tx-fresh completed → reason completed (zaključeno gre izključno na storno)', async () => {
    mocks.txOrderFindUnique.mockResolvedValue({ status: 'completed', paymentStatus: 'paid' })
    const result = await performOrderSoftDelete(ORD, baseOrder, 'emp-1')
    expect(result).toEqual({ ok: false, reason: 'completed' })
  })

  it('CAS count 0 (plačilo je zmagalo tekmo med fresh read in update) → reason conflict, brez stranskih učinkov', async () => {
    mocks.txOrderUpdateMany.mockResolvedValue({ count: 0 })
    const result = await performOrderSoftDelete(ORD, baseOrder, 'emp-1')
    expect(result).toEqual({ ok: false, reason: 'conflict' })
    expect(mocks.freeTableIfNoActiveOrders).not.toHaveBeenCalled()
    expect(mocks.returnStockForOrder).not.toHaveBeenCalled()
    expect(mocks.broadcastWS).not.toHaveBeenCalled()
  })

  it('ORDER_CANCELLED broadcast z locationId (per-location WS)', async () => {
    await performOrderSoftDelete(ORD, baseOrder, 'emp-1')
    expect(mocks.broadcastWS).toHaveBeenCalledWith(
      'ORDER_CANCELLED',
      expect.objectContaining({ orderId: ORD, orderNumber: 42, locationId: LOC_A }),
    )
  })
})

// ============================================
// D — FS-PINI (vir pini)
// ============================================
describe('R112-D: fs-pini', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('orders/[id]/route.ts: DELETE preslika strukturiran { ok, reason } v 404/400/409', () => {
    const src = read('src/app/api/orders/[id]/route.ts')
    expect(src).toContain('paid: { error:')
    expect(src).toContain('conflict: { error:')
    expect(src).toContain('if (!result.ok)')
    // star NEPOGOJEN klic mora biti izkoreninjen
    expect(src).not.toContain('await performOrderSoftDelete(id, order, authResult.session?.employeeId)\n\n    return NextResponse.json({ success: true, action')
  })

  it('handle-fire-action.ts: CAS pogoj + 409 kontrakt + kot-fire ključ', () => {
    const src = read('src/app/api/orders/[id]/webhooks/handle-fire-action.ts')
    expect(src).toContain("paymentStatus: { not: 'paid' }")
    expect(src).toContain("status: { in: FIRE_ALLOWED_STATUSES }")
    expect(src).toContain('fireClaim.count === 0')
    expect(src).toContain('kot-fire:')
    expect(src).toContain("type: 'original'")
  })

  it('handle-item-status.ts: Serializable tx + order-write ključ + CAS na artiklu', () => {
    const src = read('src/app/api/orders/[id]/webhooks/handle-item-status.ts')
    expect(src).toContain('order-write:')
    expect(src).toContain('TransactionIsolationLevel.Serializable')
    expect(src).toContain('voided: false')
    expect(src).toContain("['pending', 'in-progress'].includes(freshOrder.status)")
  })

  it('perform-soft-delete.ts: tx-fresh paymentStatus guard + CAS + strukturiran rezultat', () => {
    const src = read('src/app/api/orders/[id]/webhooks/perform-soft-delete.ts')
    expect(src).toContain("if (fresh.paymentStatus === 'paid')")
    expect(src).toContain('reason: \'paid\'')
    expect(src).toContain('status: fresh.status')
    expect(src).toContain("reason: 'conflict'")
  })

  it('order-items/[id]/route.ts: status/notes CAS + promotion CAS', () => {
    const src = read('src/app/api/order-items/[id]/route.ts')
    expect(src).toContain("where: { id, voided: false, order: { status: { not: 'cancelled' } } }")
    expect(src).toContain("statusClaim.count === 0")
    expect(src).toContain("where: { id: orderItem.orderId, status: { in: ['pending', 'in-progress'] } }")
    // star NEPOGOJEN update mora biti odstranjen
    expect(src).not.toContain("// Preostali update-i (status/notes) — brez race problematike")
  })

  it('advisory lock ključi so per-order (NI globalnih statičnih ključev)', () => {
    const fire = read('src/app/api/orders/[id]/webhooks/handle-fire-action.ts')
    const item = read('src/app/api/orders/[id]/webhooks/handle-item-status.ts')
    const del = read('src/app/api/orders/[id]/webhooks/perform-soft-delete.ts')
    expect(fire).toContain('`kot-fire:${id}`')
    expect(item).toContain('`order-write:${id}`')
    expect(del).toContain('`order-write:${id}`')
  })
})
