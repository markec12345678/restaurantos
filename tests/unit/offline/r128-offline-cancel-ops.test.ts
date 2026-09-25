// ============================================
// R128 (epic #115 P0-5) — OFFLINE CANCEL OPS (order.cancel) — unit testi
// ============================================
// Čista logika iz src/lib/offline-orders/cancel-ops.ts:
//   - buildCancelOp  → envelope order.cancel operacije (P1-14 polja + opType)
//   - chunkOperations → batching max 50 na POST /api/device-sync
//   - applySyncResults → preslikava strežnikovih rezultatov v statuse vrste
// isti vzorec kot offline-queue-status.test.ts (čiste funkcije brez I/O);
// za enqueueCancelOrder/getPendingCancelOps minimalni in-memory IndexedDB
// polyfill (isti vzorec kot offline-review-queue.test.ts).
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  buildCancelOp,
  chunkOperations,
  applySyncResults,
  DEVICE_SYNC_CHUNK_SIZE,
} from '@/lib/offline-orders/cancel-ops'
import type { PendingOrder } from '@/lib/offline-orders'

const NOW = 1_700_000_000_000 // fiksen "zdaj" za deterministične teste

function makeCancelOp(id: string, orderId: string): PendingOrder {
  return {
    id,
    operationId: id,
    opType: 'order.cancel',
    idempotencyKey: `cancel-${orderId}`,
    deviceId: 'dev-1',
    locationId: null,
    employeeId: 'emp-1',
    createdAt: NOW,
    payloadVersion: 1,
    retryCount: 0,
    status: 'PENDING',
    lastError: null,
    attempts: 0,
    syncError: null,
    lastAttemptAt: null,
    orderData: { orderId },
  }
}

describe('R128: buildCancelOp — envelope order.cancel operacije', () => {
  it('zgradi pravilen envelope (idempotencyKey cancel-<orderId>, opType, P1-14 polja)', () => {
    const op = buildCancelOp('order-123', 'Stranka je odnehala', NOW)
    expect(op.opType).toBe('order.cancel')
    expect(op.idempotencyKey).toBe('cancel-order-123')
    // id === operationId (keyPath konvencija) = clientOperationId na žici
    expect(op.id).toBe(op.operationId)
    expect(op.operationId).toBeTruthy()
    expect(op.orderData).toEqual({ orderId: 'order-123', reason: 'Stranka je odnehala' })
    expect(op.status).toBe('PENDING')
    expect(op.retryCount).toBe(0)
    expect(op.attempts).toBe(0)
    expect(op.lastError).toBeNull()
    expect(op.syncError).toBeNull()
    expect(op.lastAttemptAt).toBeNull()
    expect(op.payloadVersion).toBe(1) // PAYLOAD_VERSION ostaja 1
    expect(op.createdAt).toBe(NOW)
    expect(op.deviceId).toBeTruthy()
    expect(op.locationId).toBeNull()
  })

  it('brez razloga → orderData samo { orderId }', () => {
    const op = buildCancelOp('order-9', undefined, NOW)
    expect(op.orderData).toEqual({ orderId: 'order-9' })
  })

  it('ista naročila → različen operationId (unikaten clientOperationId za dedup)', () => {
    const a = buildCancelOp('order-1', undefined, NOW)
    const b = buildCancelOp('order-1', undefined, NOW)
    expect(a.operationId).not.toBe(b.operationId)
    // idempotencyKey je determinističen po ciljnem naročilu
    expect(a.idempotencyKey).toBe(b.idempotencyKey)
  })
})

describe('R128: chunkOperations — batching max DEVICE_SYNC_CHUNK_SIZE', () => {
  it('DEVICE_SYNC_CHUNK_SIZE je 50 (kontrakt s strežnikom)', () => {
    expect(DEVICE_SYNC_CHUNK_SIZE).toBe(50)
  })

  it('120 operacij → 50 + 50 + 20, vrstni red ohranjen', () => {
    const ops = Array.from({ length: 120 }, (_, i) => makeCancelOp(`op-${i}`, `o-${i}`))
    const chunks = chunkOperations(ops, DEVICE_SYNC_CHUNK_SIZE)
    expect(chunks.map(c => c.length)).toEqual([50, 50, 20])
    expect(chunks.flat().length).toBe(120)
    expect(chunks[0][0].id).toBe('op-0')
    expect(chunks[2][19].id).toBe('op-119')
  })

  it('natanko 50 → en batch; manj → en batch; prazna vrsta → []', () => {
    const fifty = Array.from({ length: 50 }, (_, i) => makeCancelOp(`a-${i}`, `b-${i}`))
    expect(chunkOperations(fifty, 50)).toHaveLength(1)
    expect(chunkOperations(fifty.slice(0, 7), 50)).toHaveLength(1)
    expect(chunkOperations([], 50)).toEqual([])
  })
})

describe('R128: applySyncResults — preslikava rezultatov /api/device-sync', () => {
  it('applied → SYNCED + serverAck (orderId ciljnega naročila, serverStatus applied)', () => {
    const ops = [makeCancelOp('op-1', 'order-1')]
    const decisions = applySyncResults(ops, [{ clientOperationId: 'op-1', status: 'applied' }])
    expect(decisions).toHaveLength(1)
    expect(decisions[0].outcome).toBe('applied')
    expect(decisions[0].status).toBe('SYNCED')
    expect(decisions[0].serverAck?.orderId).toBe('order-1')
    expect(decisions[0].serverAck?.serverStatus).toBe('applied')
    expect(typeof decisions[0].serverAck?.syncedAt).toBe('string')
    expect(decisions[0].event).toBeUndefined()
  })

  it('duplicate → SYNCED + serverStatus duplicate (idempotentni replay)', () => {
    const ops = [makeCancelOp('op-1', 'order-1')]
    const decisions = applySyncResults(ops, [{ clientOperationId: 'op-1', status: 'duplicate' }])
    expect(decisions[0].status).toBe('SYNCED')
    expect(decisions[0].outcome).toBe('duplicate')
    expect(decisions[0].serverAck?.serverStatus).toBe('duplicate')
  })

  it('rejected trajni razlogi (ORDER_NOT_FOUND/PAID_ORDER_CANCEL/ORDER_COMPLETED) → MANUAL_REVIEW + SYNC_MANUAL_REVIEW event', () => {
    for (const code of ['ORDER_NOT_FOUND', 'PAID_ORDER_CANCEL', 'ORDER_COMPLETED']) {
      const ops = [makeCancelOp('op-1', 'order-1')]
      const decisions = applySyncResults(ops, [{ clientOperationId: 'op-1', status: 'rejected', error: code }])
      expect(decisions[0].status, code).toBe('MANUAL_REVIEW')
      expect(decisions[0].lastError, code).toBe(code)
      expect(decisions[0].event?.type, code).toBe('SYNC_MANUAL_REVIEW')
      expect(decisions[0].event?.payload, code).toMatchObject({ orderId: 'order-1', status: code })
    }
  })

  it('rejected SYNC_CONFLICT → RETRY + SYNC_CONFLICT event (backoff prek obstoječega stroja)', () => {
    const ops = [makeCancelOp('op-1', 'order-1')]
    const decisions = applySyncResults(ops, [{ clientOperationId: 'op-1', status: 'rejected', error: 'SYNC_CONFLICT' }])
    expect(decisions[0].status).toBe('RETRY')
    expect(decisions[0].lastError).toBe('SYNC_CONFLICT')
    expect(decisions[0].event?.type).toBe('SYNC_CONFLICT')
    expect(decisions[0].event?.payload).toMatchObject({ orderId: 'order-1' })
  })

  it('rejected neznan razlog → RETRY (fail-safe: operacija se ne izgubi)', () => {
    const ops = [makeCancelOp('op-1', 'order-1')]
    const decisions = applySyncResults(ops, [{ clientOperationId: 'op-1', status: 'rejected', error: 'SOMETHING_ELSE' }])
    expect(decisions[0].status).toBe('RETRY')
    expect(decisions[0].lastError).toBe('SOMETHING_ELSE')
    expect(decisions[0].event).toBeUndefined()
  })

  it('rejected brez error polja → generičen REJECTED → RETRY', () => {
    const ops = [makeCancelOp('op-1', 'order-1')]
    const decisions = applySyncResults(ops, [{ clientOperationId: 'op-1', status: 'rejected' }])
    expect(decisions[0].status).toBe('RETRY')
    expect(decisions[0].lastError).toBe('REJECTED')
  })

  it('odgovor za neznano operacijo → prezrt (fail-closed)', () => {
    const ops = [makeCancelOp('op-1', 'order-1')]
    const decisions = applySyncResults(ops, [{ clientOperationId: 'ghost', status: 'applied' }])
    expect(decisions).toHaveLength(0)
  })

  it('mešani batch → vsaka operacija dobi svojo odločitev (po clientOperationId)', () => {
    const ops = [
      makeCancelOp('op-1', 'order-1'),
      makeCancelOp('op-2', 'order-2'),
      makeCancelOp('op-3', 'order-3'),
    ]
    const results = [
      { clientOperationId: 'op-1', status: 'applied' as const },
      { clientOperationId: 'op-2', status: 'duplicate' as const },
      { clientOperationId: 'op-3', status: 'rejected' as const, error: 'PAID_ORDER_CANCEL' },
    ]
    const decisions = applySyncResults(ops, results)
    expect(decisions.map(d => d.status)).toEqual(['SYNCED', 'SYNCED', 'MANUAL_REVIEW'])
  })
})

// ── Minimalni in-memory IndexedDB polyfill (isti vzorec kot
//    offline-review-queue.test.ts — request/callback API brez odvisnosti) ──

class FakeRequest<T> {
  result: T | null = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(value: T) {
    this.result = value
    Promise.resolve().then(() => { this.onsuccess?.() })
  }
}

class FakeObjectStore {
  data = new Map<string, Record<string, unknown>>()
  getAll(): FakeRequest<unknown[]> {
    return new FakeRequest([...this.data.values()])
  }
  get(key: string): FakeRequest<unknown> {
    return new FakeRequest(this.data.get(key) ?? null)
  }
  put(value: Record<string, unknown>): FakeRequest<unknown> {
    this.data.set(String(value.id), value)
    return new FakeRequest(value.id)
  }
  delete(key: string): FakeRequest<undefined> {
    this.data.delete(key)
    return new FakeRequest(undefined)
  }
  createIndex(): void { /* ni potreben za teste */ }
}

class FakeTransaction {
  private _oncomplete: (() => void) | null = null
  set oncomplete(fn: (() => void) | null) {
    this._oncomplete = fn
    if (fn) Promise.resolve().then(fn)
  }
  get oncomplete() { return this._oncomplete }
  set onerror(fn: (() => void) | null) { this._onerror = fn }
  get onerror() { return this._onerror }
  private _onerror: (() => void) | null = null
  constructor(private store: FakeObjectStore) {}
  objectStore(): FakeObjectStore { return this.store }
}

class FakeDatabase {
  objectStoreNames = { contains: () => true }
  constructor(private store: FakeObjectStore) {}
  transaction(_name: string, _mode: string): FakeTransaction {
    return new FakeTransaction(this.store)
  }
}

class FakeOpenRequest {
  result: FakeDatabase | null = null
  onupgradeneeded: (() => void) | null = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(db: FakeDatabase) {
    Promise.resolve().then(() => {
      this.result = db
      this.onsuccess?.()
    })
  }
}

const sharedStore = new FakeObjectStore()

async function freshCancelOpsModule() {
  ;(globalThis as Record<string, unknown>).indexedDB = {
    open: () => new FakeOpenRequest(new FakeDatabase(sharedStore)),
  }
  vi.resetModules()
  return await import('@/lib/offline-orders/cancel-ops')
}

describe('R128: enqueueCancelOrder + getPendingCancelOps (fake IndexedDB)', () => {
  beforeEach(() => {
    sharedStore.data.clear()
  })

  it('uvrsti order.cancel op z pravilnim envelope-om; order.create op-i niso med cancel op-i', async () => {
    // order.create vnos (legacy oblika) — ne sme se pojaviti med cancel op-i
    sharedStore.data.set('create-1', {
      id: 'create-1',
      operationId: 'create-1',
      idempotencyKey: 'cart-abc-1',
      deviceId: 'dev-1',
      locationId: null,
      employeeId: 'emp-1',
      createdAt: NOW,
      payloadVersion: 1,
      retryCount: 0,
      status: 'PENDING',
      lastError: null,
      attempts: 0,
      syncError: null,
      lastAttemptAt: null,
      orderData: {
        type: 'dine-in', tableId: null, diningOptionId: null, customerName: 'Gost',
        customerPhone: '', discount: 0, appliedDiscountId: null, notes: '',
        orderItems: [{ menuItemId: 'mi-1', quantity: 1, notes: '', modifiersJson: '[]' }],
      },
    })

    const mod = await freshCancelOpsModule()
    const ok = await mod.enqueueCancelOrder('order-xyz', 'napaka vnosa')
    expect(ok).toBe(true)

    const pending = await mod.getPendingCancelOps()
    expect(pending).toHaveLength(1)
    expect(pending[0].opType).toBe('order.cancel')
    expect(pending[0].idempotencyKey).toBe('cancel-order-xyz')
    expect(pending[0].status).toBe('PENDING')
    expect(pending[0].orderData).toEqual({ orderId: 'order-xyz', reason: 'napaka vnosa' })
    expect(pending[0].retryCount).toBe(0)
    // count se ujema
    expect(await mod.getPendingCancelOpCount()).toBe(1)
  })

  it('SYNCED cancel op ni več obdelovalen (ne pošlje se znova)', async () => {
    const mod = await freshCancelOpsModule()
    await mod.enqueueCancelOrder('order-s')
    const [op] = await mod.getPendingCancelOps()
    // simuliraj uspešen sync (markOrderStatus SYNCED + serverAck)
    const indexMod = await import('@/lib/offline-orders/index')
    await indexMod.markOrderStatus(op.id, 'SYNCED', '', {
      orderId: 'order-s',
      syncedAt: new Date().toISOString(),
      serverStatus: 'applied',
    })
    expect(await mod.getPendingCancelOps()).toHaveLength(0)
    // zapis je še vedno berljiv (serverAck za UI/revizijo)
    const all = await indexMod.getAllOrders()
    expect(all).toHaveLength(1)
    expect(all[0].status).toBe('SYNCED')
    expect(all[0].serverAck?.orderId).toBe('order-s')
    expect(all[0].serverAck?.serverStatus).toBe('applied')
    expect(all[0].opType).toBe('order.cancel')
  })
})
