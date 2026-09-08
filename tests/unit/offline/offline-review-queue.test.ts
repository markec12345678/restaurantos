// ============================================
// P1-15/P1-16: offline-orders admin UI funkcije — Unit testi
// getReviewOrders / getReviewCount / syncSingleOrder
//
// Uporabimo MINIMALNI in-memory IndexedDB polyfill (isti API kot
// browser: request/callback vzorec) — brez zunanjih odvisnosti.
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Minimalni fake IndexedDB ────────────────────────────────────

class FakeRequest<T> {
  result: T | null = null
  error: Error | null = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(value: T) {
    this.result = value
    Promise.resolve().then(() => {
      this.onsuccess?.()
    })
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
    const key = String(value.id)
    this.data.set(key, value)
    return new FakeRequest(key)
  }
  delete(key: string): FakeRequest<undefined> {
    this.data.delete(key)
    return new FakeRequest(undefined)
  }
  createIndex(): void { /* ni potreben za teste */ }
}

class FakeTransaction {
  private _oncomplete: (() => void) | null = null
  private _onerror: (() => void) | null = null

  // Ko modul dodeli oncomplete, ga sprožimo v microtasku — emulira
  // commit transakcije (vsse operacije so v testih sinhrone)
  set oncomplete(fn: (() => void) | null) {
    this._oncomplete = fn
    if (fn) Promise.resolve().then(fn)
  }
  get oncomplete() { return this._oncomplete }

  set onerror(fn: (() => void) | null) { this._onerror = fn }
  get onerror() { return this._onerror }

  constructor(store: FakeObjectStore, mode: string) {
    this.store = store
    this.mode = mode
  }
  private store: FakeObjectStore
  mode: string
  objectStore(): FakeObjectStore { return this.store }
}

class FakeDatabase {
  objectStoreNames = { contains: () => true }
  private store: FakeObjectStore
  constructor(store: FakeObjectStore) {
    this.store = store
  }
  transaction(_name: string, mode: string): FakeTransaction {
    return new FakeTransaction(this.store, mode)
  }
}

class FakeOpenRequest {
  result: FakeDatabase | null = null
  onupgradeneeded: (() => void) | null = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null
  private db: FakeDatabase
  constructor(db: FakeDatabase) {
    this.db = db
    Promise.resolve().then(() => {
      this.result = this.db
      this.onsuccess?.()
    })
  }
}

// Skupna shramba vseh testov
const sharedStore = new FakeObjectStore()
let currentDb = new FakeDatabase(sharedStore)

// Modul cache-a dbInstance — vsak test začne s SVEŽO instanco
// (dbInstance je modul-private; re-import modula resetira cache)
async function freshModule() {
  currentDb = new FakeDatabase(sharedStore)
  const fakeIndexedDB = {
    open: () => new FakeOpenRequest(currentDb),
  }
  ;(globalThis as Record<string, unknown>).indexedDB = fakeIndexedDB
  // dynamic import z novim module ID-jem ni mogoč v vitestu brez query;
  // uporabimo re-import prek resetModules
  vi.resetModules()
  return await import('@/lib/offline-orders/index')
}

function makeEntry(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'entry-1',
    operationId: 'entry-1',
    idempotencyKey: 'idem-1',
    deviceId: 'dev-1',
    locationId: null,
    employeeId: 'emp-1',
    createdAt: Date.now() - 60_000,
    payloadVersion: 1,
    retryCount: 0,
    status: 'PENDING',
    lastError: null,
    attempts: 0,
    syncError: null,
    lastAttemptAt: null,
    orderData: {
      type: 'dine-in',
      tableId: null,
      diningOptionId: null,
      customerName: 'Test Gost',
      customerPhone: '',
      discount: 0,
      appliedDiscountId: null,
      notes: '',
      orderItems: [{ menuItemId: 'mi-1', quantity: 2, notes: '', modifiersJson: '[]' }],
      employeeId: 'emp-1',
    },
    ...overrides,
  }
}

describe('P1-15/P1-16: getReviewOrders / getReviewCount (admin UI vir)', () => {
  let mod: typeof import('@/lib/offline-orders/index')

  beforeEach(async () => {
    sharedStore.data.clear()
    mod = await freshModule()
  })

  it('getReviewOrders vrne SAMO konfliktne/statuse za pregled', async () => {
    sharedStore.data.set('a', makeEntry({ id: 'a', status: 'CONFLICT' }))
    sharedStore.data.set('b', makeEntry({ id: 'b', status: 'MANUAL_REVIEW' }))
    sharedStore.data.set('c', makeEntry({ id: 'c', status: 'FAILED' }))
    sharedStore.data.set('d', makeEntry({ id: 'd', status: 'EXPIRED' }))
    sharedStore.data.set('e', makeEntry({ id: 'e', status: 'PENDING' }))
    sharedStore.data.set('f', makeEntry({ id: 'f', status: 'RETRY' }))
    sharedStore.data.set('g', makeEntry({ id: 'g', status: 'PROCESSING' }))

    const review = await mod.getReviewOrders()
    const ids = review.map(r => r.id).sort()
    expect(ids).toEqual(['a', 'b', 'c', 'd'])
  })

  it('getReviewCount šteje samo CONFLICT + MANUAL_REVIEW (ne FAILED/EXPIRED)', async () => {
    sharedStore.data.set('a', makeEntry({ id: 'a', status: 'CONFLICT' }))
    sharedStore.data.set('b', makeEntry({ id: 'b', status: 'MANUAL_REVIEW' }))
    sharedStore.data.set('c', makeEntry({ id: 'c', status: 'FAILED' }))
    sharedStore.data.set('d', makeEntry({ id: 'd', status: 'EXPIRED' }))

    expect(await mod.getReviewCount()).toBe(2)
  })

  it('prazna vrsta → 0 vnosov', async () => {
    expect(await mod.getReviewOrders()).toEqual([])
    expect(await mod.getReviewCount()).toBe(0)
  })

  it('legacy lowercase statusi se normalizirajo (conflict → CONFLICT)', async () => {
    // starejše verzije kode so uporabljale lowercase — IndexedDB persistira
    sharedStore.data.set('old', makeEntry({ id: 'old', status: 'conflict' }))
    const review = await mod.getReviewOrders()
    expect(review.length).toBe(1)
    expect(review[0].status).toBe('CONFLICT')
  })
})

describe('P1-15: syncSingleOrder (ročni retry iz panela)', () => {
  let mod: typeof import('@/lib/offline-orders/index')

  beforeEach(async () => {
    sharedStore.data.clear()
    mod = await freshModule()
  })

  it('uspešen POST → vnos se ODSTRANI iz vrste (dequeue)', async () => {
    sharedStore.data.set('a', makeEntry({ id: 'a', idempotencyKey: 'idem-a', status: 'CONFLICT' }))

    const authFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'order-server-1' }),
    })

    const result = await mod.syncSingleOrder('a', authFetch as never)

    expect(result.ok).toBe(true)
    expect(result.status).toBe('SYNCED')
    // POST na /api/orders z idempotencyKey v telesu
    const [url, opts] = authFetch.mock.calls[0]
    expect(url).toBe('/api/orders')
    const body = JSON.parse((opts as RequestInit).body as string)
    expect(body.idempotencyKey).toBe('idem-a')
    // vnos je iz vrste
    expect(await mod.getAllOrders()).toEqual([])
  })

  it('409 → CONFLICT (vnos ostane zadržan, ne briše se)', async () => {
    sharedStore.data.set('b', makeEntry({ id: 'b', status: 'RETRY', retryCount: 2 }))

    const authFetch = vi.fn().mockResolvedValue({ ok: false, status: 409 })

    const result = await mod.syncSingleOrder('b', authFetch as never)

    expect(result.ok).toBe(false)
    expect(result.status).toBe('CONFLICT')
    const entries = await mod.getAllOrders()
    expect(entries.length).toBe(1)
    expect(entries[0].status).toBe('CONFLICT')
    expect(entries[0].lastError).toContain('HTTP 409')
  })

  it('401 → PENDING brez štetja poskusa (čakaj re-login)', async () => {
    sharedStore.data.set('c', makeEntry({ id: 'c', status: 'CONFLICT', retryCount: 3 }))

    const authFetch = vi.fn().mockResolvedValue({ ok: false, status: 401 })

    const result = await mod.syncSingleOrder('c', authFetch as never)

    expect(result.ok).toBe(false)
    expect(result.status).toBe('PENDING')
    const entries = await mod.getAllOrders()
    expect(entries[0].status).toBe('PENDING')
    // poskus NI šteton (401 pravilo)
    expect(entries[0].retryCount).toBe(3)
  })

  it('400 (trajna klientova napaka) → MANUAL_REVIEW', async () => {
    sharedStore.data.set('d', makeEntry({ id: 'd', status: 'RETRY' }))

    const authFetch = vi.fn().mockResolvedValue({ ok: false, status: 400 })

    const result = await mod.syncSingleOrder('d', authFetch as never)

    expect(result.status).toBe('MANUAL_REVIEW')
    const entries = await mod.getAllOrders()
    expect(entries[0].status).toBe('MANUAL_REVIEW')
  })

  it('omrežna napaka (fetch throw) → RETRY status', async () => {
    sharedStore.data.set('e', makeEntry({ id: 'e', status: 'CONFLICT', retryCount: 0 }))

    const authFetch = vi.fn().mockRejectedValue(new Error('network down'))

    const result = await mod.syncSingleOrder('e', authFetch as never)

    expect(result.ok).toBe(false)
    expect(result.status).toBe('RETRY')
    expect(result.httpStatus).toBeNull()
    const entries = await mod.getAllOrders()
    expect(entries.length).toBe(1)
  })

  it('neobstoječ vnos → { ok: false } brez izjeme', async () => {
    const authFetch = vi.fn()
    const result = await mod.syncSingleOrder('does-not-exist', authFetch as never)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('ni najden')
  })
})
