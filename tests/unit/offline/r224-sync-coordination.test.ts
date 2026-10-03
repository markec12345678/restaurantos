// ============================================
// R224 (#157 korak 2) — METADATA STORE + MIGRACIJSKA VERIGA v1→v2
//   + VEČ-ZAVIHKOVKA KOORDINACIJA (Web Locks + BroadcastChannel)
//
// Korak 1 (R222) je zaprl dual-DB defekt #49 (SW = sprožilec, page =
// izvajalec). Korak 2 (R224) zapira preostanek KNOWN_ISSUES #49 "Ostaja":
//   1. syncMetadata store — KV zapisnik synca (zadnji izid, revizija
//      legacy migracije) — keyPath 'key'.
//   2. Migracijska veriga v1→v2 — obstoječe v1 baze dobijo metadata
//      store prek onupgradeneeded; pendingOrders podatki ostanejo
//      nedotaknjeni (versionchange ne uniči store-ov).
//   3. Koordinacija — Web Locks (ifAvailable) drži izvajanje synca na
//      TOČNO ENEM zavihku (prej: N zavihkov = N vzporednih syncov);
//      BroadcastChannel obvesti ostale o izidu (cache invalidacija,
//      brez toastov). Brez lock/BC podpore — tiha degradacija
//      (idempotencyKey ostaja strežniško varovalo).
//
// Testna infrastruktura: VERSIONIRAN in-memory IndexedDB fake (per-name
// izolacija po spec-u — lekcija R222: minimalni fake deli store ČREZ
// imena, kar je uničilo testne vnose pri migraciji cop+delete). Ta fake
// implementira verzije/onupgradeneeded/createObjectStore po spec-obliki,
// da je upgrade veriga 1→2 realno preverljiva.
// ============================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_STORE_NAME,
  OFFLINE_METADATA_STORE,
  SYNC_LOCK_NAME,
  SYNC_BROADCAST_CHANNEL,
  SYNC_BROADCAST_COMPLETED,
  META_LAST_SYNC_RESULT,
  META_LEGACY_MIGRATION,
} from '@/lib/offline-orders/db-contract'

const indexSrc = readFileSync(path.join(process.cwd(), 'src', 'lib', 'offline-orders', 'index.ts'), 'utf-8')
const hookSrc = readFileSync(
  path.join(process.cwd(), 'src', 'components', 'pos', 'order', 'useOrderPanelMutations.ts'),
  'utf-8',
)

// ── Ločena oblika modula za teste (brez teže polnih domenskih tipov) ──

interface TestPendingOrder {
  id: string
  status: string
  orderData: unknown
  serverAck?: Record<string, unknown>
}

interface CoordinatedLike {
  skipped: boolean
  succeeded: number
  conflicts: number
  authExpired: boolean
  orders: { processed: number }
  cancels: { processed: number }
}

interface OfflineOrdersModule {
  setMeta: (key: string, value: unknown) => Promise<boolean>
  getMeta: <T = unknown>(key: string) => Promise<T | null>
  getProcessableOrders: () => Promise<TestPendingOrder[]>
  migrateLegacySwDb: () => Promise<number>
  runCoordinatedSync: (
    authFetch: (url: string, options: RequestInit) => Promise<Response>,
  ) => Promise<CoordinatedLike>
  subscribeSyncBroadcast: (
    handler: (msg: { type: string; succeeded: number; conflicts: number; authExpired: boolean; at: number; deviceId: string }) => void,
  ) => () => void
  broadcastSyncResult: (result: unknown) => void
  enqueueOrder: (entry: { id: string; idempotencyKey: string; orderData: unknown; createdAt: number }) => Promise<boolean>
  getAllOrders: () => Promise<TestPendingOrder[]>
}

// ── VERSIONIRAN fake IndexedDB (per-name izolacija + upgrade veriga) ──

class FakeRequest<T> {
  result: T | null = null
  error: Error | null = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(value: T | null) {
    // Spec: get na manjkajočem ključu SPROŽI onsuccess z result=null
    // (ne onerror!) — sicer bi branje manjkajočega META ključa obstalo.
    Promise.resolve().then(() => {
      this.result = value
      this.onsuccess?.()
    })
  }
}

class FakeStore {
  data = new Map<string, Record<string, unknown>>()
  indexes: string[] = []
  constructor(public keyPath: string) {}
  getAll(): FakeRequest<unknown[]> {
    return new FakeRequest([...this.data.values()])
  }
  get(key: string): FakeRequest<unknown> {
    return new FakeRequest(this.data.get(key) ?? null)
  }
  put(value: Record<string, unknown>): FakeRequest<string> {
    const key = String(value[this.keyPath])
    this.data.set(key, value)
    return new FakeRequest(key)
  }
  delete(key: string): FakeRequest<undefined> {
    this.data.delete(key)
    return new FakeRequest(undefined)
  }
  createIndex(name: string, _keyPath?: string | string[], _options?: { unique?: boolean }): void {
    this.indexes.push(name)
  }
}

class FakeTransaction {
  private store: FakeStore
  // oncomplete/onerror kot accessori — commit v microtasku (emulira
  // asinhrono transakcijo; handler je vedno nastavljen takoj po odprtju)
  private _oncomplete: (() => void) | null = null
  set oncomplete(fn: (() => void) | null) {
    this._oncomplete = fn
    if (fn) Promise.resolve().then(fn)
  }
  get oncomplete() {
    return this._oncomplete
  }
  private _onerror: (() => void) | null = null
  set onerror(fn: (() => void) | null) {
    this._onerror = fn
  }
  get onerror() {
    return this._onerror
  }
  constructor(db: FakeDatabase, name: string) {
    const store = db.stores.get(name)
    if (!store) throw new Error(`FakeIDB: store '${name}' ne obstaja v '${db.name}'`)
    this.store = store
  }
  objectStore(): FakeStore {
    return this.store
  }
}

class FakeDatabase {
  version: number
  name: string
  stores = new Map<string, FakeStore>()
  objectStoreNames = { contains: (n: string) => this.stores.has(n) }
  constructor(name: string, version: number) {
    this.name = name
    this.version = version
  }
  transaction(name: string, _mode: string): FakeTransaction {
    return new FakeTransaction(this, name)
  }
  createObjectStore(name: string, options?: { keyPath?: string }): FakeStore {
    const store = new FakeStore(options?.keyPath ?? 'id')
    this.stores.set(name, store)
    return store
  }
}

class FakeOpenRequest {
  result: FakeDatabase | null = null
  error: Error | null = null
  onupgradeneeded: (() => void) | null = null
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null
  onblocked: (() => void) | null = null
}

// Registracija baz — per-name izolacija (lekcija R222)
const registry = new Map<string, FakeDatabase>()

function openFake(name: string, version?: number): FakeOpenRequest {
  const req = new FakeOpenRequest()
  if (version === undefined) {
    // Brez verzije — odpri obstoječo (ali prazno v1); NE ustvarjaj store-ov
    let db = registry.get(name)
    if (!db) {
      db = new FakeDatabase(name, 1)
      registry.set(name, db)
    }
    Promise.resolve().then(() => {
      req.result = db
      req.onsuccess?.()
    })
    return req
  }
  let db = registry.get(name)
  if (!db || db.version < version) {
    // Upgrade pot — result nastavljen PRED onupgradeneeded (spec oblika)
    if (!db) {
      db = new FakeDatabase(name, version)
      registry.set(name, db)
    } else {
      db.version = version
    }
    Promise.resolve().then(() => {
      req.result = db ?? null
      req.onupgradeneeded?.()
      req.onsuccess?.()
    })
    return req
  }
  // Enaka verzija — brez upgrade dogodka
  Promise.resolve().then(() => {
    req.result = db ?? null
    req.onsuccess?.()
  })
  return req
}

function seedFakeIndexedDB(): void {
  ;(globalThis as Record<string, unknown>).indexedDB = { open: openFake }
}

async function freshModule(): Promise<OfflineOrdersModule> {
  registry.clear()
  seedFakeIndexedDB()
  vi.resetModules()
  return (await import('@/lib/offline-orders')) as unknown as OfflineOrdersModule
}

function seedV1Db(): FakeDatabase {
  // Simulacija R170–R222 baze: verzija 1, SAMO pendingOrders, en živ vnos
  const db = new FakeDatabase(OFFLINE_DB_NAME, 1)
  const store = db.createObjectStore(OFFLINE_STORE_NAME, { keyPath: 'id' })
  store.createIndex('status', 'status', { unique: false })
  store.data.set('seed-1', {
    id: 'seed-1',
    operationId: 'seed-1',
    idempotencyKey: 'idem-seed-1',
    deviceId: 'dev-1',
    locationId: null,
    employeeId: null,
    createdAt: Date.now(),
    payloadVersion: 1,
    retryCount: 0,
    status: 'PENDING',
    lastError: null,
    attempts: 0,
    syncError: null,
    lastAttemptAt: null,
    orderData: makeOrderData(),
  })
  registry.set(OFFLINE_DB_NAME, db)
  return db
}

function makeOrderData(): Record<string, unknown> {
  return { type: 'order.create', tableId: null, diningOptionId: null, customerName: 'Test', customerPhone: '', discount: 0, appliedDiscountId: null, notes: '', orderItems: [] }
}

type AuthFetch = (url: string, options: RequestInit) => Promise<Response>
type AuthFetchMock = ReturnType<typeof vi.fn<AuthFetch>>

function makeAuthFetchOk(): AuthFetchMock {
  return vi.fn(async (_url: string, _options: RequestInit): Promise<Response> =>
    new Response(JSON.stringify({ id: 'ord-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  )
}

// ── Fake BroadcastChannel (dostava SAMO drugim instancam istega imena) ──

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = []
  name: string
  onmessage: ((ev: { data: unknown }) => void) | null = null
  closed = false
  constructor(name: string) {
    this.name = name
    FakeBroadcastChannel.instances.push(this)
  }
  postMessage(data: unknown): void {
    for (const inst of FakeBroadcastChannel.instances) {
      if (inst !== this && inst.name === this.name && !inst.closed) {
        Promise.resolve().then(() => inst.onmessage?.({ data }))
      }
    }
  }
  close(): void {
    this.closed = true
  }
}

type LockRequestImpl = (
  name: string,
  opts: { ifAvailable?: boolean },
  cb: (lock: unknown | null) => Promise<unknown>,
) => Promise<unknown>

function stubLocks(requestImpl: LockRequestImpl): void {
  Object.defineProperty(globalThis.navigator, 'locks', {
    value: { request: requestImpl },
    configurable: true,
  })
}
function clearLocks(): void {
  try { delete (globalThis.navigator as { locks?: unknown }).locks } catch { /* ni bilo */ }
}
const flush = () => new Promise<void>((r) => setTimeout(r, 0))

beforeEach(() => {
  FakeBroadcastChannel.instances = []
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel as unknown as typeof BroadcastChannel)
})
afterEach(() => {
  clearLocks()
  vi.unstubAllGlobals()
})

// ════════════════════════════════════════════
// A — kontrakt (R224 konstante + vir-pini)
// ════════════════════════════════════════════

describe('R224 — kontrakt: verzija 2 + syncMetadata + koordinacijske konstante', () => {
  it('OFFLINE_DB_VERSION je 2 (dvig z verigo — R224 #157 korak 2)', () => {
    expect(OFFLINE_DB_VERSION).toBe(2)
  })

  it('OFFLINE_METADATA_STORE je syncMetadata (KV, keyPath key — pina openDB)', () => {
    expect(OFFLINE_METADATA_STORE).toBe('syncMetadata')
    expect(indexSrc).toContain("db.createObjectStore(META_STORE, { keyPath: 'key' })")
    expect(indexSrc).toContain('OFFLINE_METADATA_STORE as META_STORE')
  })

  it('koordinacijske konstante: lock ime + BC ime + tip sporočila', () => {
    expect(SYNC_LOCK_NAME).toBe('restaurantos-offline-sync-lock')
    expect(SYNC_BROADCAST_CHANNEL).toBe('restaurantos-offline-sync-bc')
    expect(SYNC_BROADCAST_COMPLETED).toBe('OFFLINE_SYNC_COMPLETED')
    expect(indexSrc).toContain('SYNC_LOCK_NAME')
    expect(indexSrc).toContain('SYNC_BROADCAST_CHANNEL')
    expect(indexSrc).toContain('SYNC_BROADCAST_COMPLETED')
  })

  it('META ključi: lastSyncResult + legacySwMigration', () => {
    expect(META_LAST_SYNC_RESULT).toBe('lastSyncResult')
    expect(META_LEGACY_MIGRATION).toBe('legacySwMigration')
    expect(indexSrc).toContain('META_LAST_SYNC_RESULT')
    expect(indexSrc).toContain('META_LEGACY_MIGRATION')
  })

  it('startSyncPolling uporablja runCoordinatedSync (koordinirana polling pot)', () => {
    expect(indexSrc).toContain('await runCoordinatedSync(authFetch)')
    expect(indexSrc).toContain('export async function runCoordinatedSync')
    expect(indexSrc).toContain('export function subscribeSyncBroadcast')
    expect(indexSrc).toContain('export function broadcastSyncResult')
  })

  it('hook: koordiniran sync + skipped guard + cross-tab invalidacija', () => {
    expect(hookSrc).toContain("import('@/lib/offline-orders').then(({ runCoordinatedSync }) =>")
    expect(hookSrc).toContain('if (result.skipped) return')
    expect(hookSrc).toContain('subscribeSyncBroadcast(')
    expect(hookSrc).toContain('queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })')
  })

  it('Web Locks ifAvailable + degradacija brez lockov (idempotencyKey ostaja varovalo)', () => {
    expect(indexSrc).toContain('{ ifAvailable: true }')
    expect(indexSrc).toContain('return SKIPPED_SYNC_RESULT')
    expect(indexSrc).toContain('idempotencyKey\n// ostaja strežniško varovalo')
  })
})

// ════════════════════════════════════════════
// B — migracijska veriga v1→v2 (verzioniran fake)
// ════════════════════════════════════════════

describe('R224 — migracijska veriga v1→v2 (pendingOrders podatki ostanejo nedotaknjeni)', () => {
  it('sveža namestitev: openDB v2 ustvari OBA store-a (pendingOrders + syncMetadata)', async () => {
    const mod = await freshModule()
    // openDB prek javnega API-ja (setMeta zahteva odprto bazo z meta store-om)
    expect(await mod.setMeta('probe', 1)).toBe(true)
    const db = registry.get(OFFLINE_DB_NAME)!
    expect(db.version).toBe(2)
    expect(db.stores.has(OFFLINE_STORE_NAME)).toBe(true)
    expect(db.stores.has(OFFLINE_METADATA_STORE)).toBe(true)
    // pendingOrders indeksi ostanejo iz verige (status/createdAt/idempotencyKey)
    const queueStore = db.stores.get(OFFLINE_STORE_NAME)!
    expect(queueStore.indexes).toEqual(expect.arrayContaining(['status', 'createdAt', 'idempotencyKey']))
    // syncMetadata keyPath 'key' — setMeta/getMeta roundtrip
    expect(await mod.getMeta<number>('probe')).toBe(1)
  })

  it('upgrade 1→2: v1 baza dobi syncMetadata, živi vnos PENDING je OHRANJEN', async () => {
    const mod = await freshModule()
    // seed PO freshModule (freshModule čisti registry — vrstni red je zavezujoč)
    const seeded = seedV1Db()
    // getProcessableOrders sproži openDB → upgrade 1→2 → branje žive vrste
    const processable = await mod.getProcessableOrders()
    expect(seeded.version).toBe(2)
    expect(seeded.stores.has(OFFLINE_METADATA_STORE)).toBe(true)
    expect(processable).toHaveLength(1)
    expect(processable[0].id).toBe('seed-1')
    expect(processable[0].status).toBe('PENDING')
    expect(processable[0].orderData).toMatchObject({ type: 'order.create' })
    // upgrade je ohranil obstoječi store (ni ga ustvaril znova — indeksi ostajo)
    expect(seeded.stores.get(OFFLINE_STORE_NAME)!.indexes).toContain('status')
    // metadata store je takoj uporaben po upgradu
    expect(await mod.setMeta('after-upgrade', 'ok')).toBe(true)
    expect(await mod.getMeta<string>('after-upgrade')).toBe('ok')
  })

  it('toleranca: v2 baza BREZ meta store-a → getMeta null / setMeta false (brez crasha)', async () => {
    // Simulacija: baza že na verziji 2, a brez syncMetadata (npr. ročno ustvarjena)
    const mod = await freshModule()
    // seed PO freshModule (freshModule čisti registry) — baza že na verziji 2
    // brez syncMetadata: openDB jo odpre BREZ upgrade dogodka (enačba verzij)
    const db = new FakeDatabase(OFFLINE_DB_NAME, OFFLINE_DB_VERSION)
    db.createObjectStore(OFFLINE_STORE_NAME, { keyPath: 'id' })
    registry.set(OFFLINE_DB_NAME, db)
    expect(await mod.getMeta('anything')).toBeNull()
    expect(await mod.setMeta('anything', 1)).toBe(false)
    // baza je ostala na svojih store-ih (brez tihe kreacije meta store-a)
    expect(db.stores.has(OFFLINE_METADATA_STORE)).toBe(false)
  })

  it('migrateLegacySwDb piše revizijski zapis v syncMetadata (META_LEGACY_MIGRATION)', async () => {
    const mod = await freshModule()
    // jsdom nima serviceWorker → migracija je no-op (0), brez zapisnika
    await mod.migrateLegacySwDb()
    expect(await mod.getMeta(META_LEGACY_MIGRATION)).toBeNull()
    // Pin na klic v kodi (brskalniška pot ni izvedljiva v jsdom — glej R222 gate)
    expect(indexSrc).toContain('void setMeta(META_LEGACY_MIGRATION, {')
    expect(indexSrc).toContain('revizijski zapis migracije v syncMetadata store')
  })
})

// ════════════════════════════════════════════
// C — koordinacija (Web Locks + BroadcastChannel + metadata zapisnik)
// ════════════════════════════════════════════

describe('R224 — runCoordinatedSync: Web Locks + zapisnik + broadcast', () => {
  it('brez navigator.locks: direkten sync (degradacija), skipped false, META_LAST_SYNC_RESULT zapisan', async () => {
    clearLocks()
    const mod = await freshModule()
    const authFetch = makeAuthFetchOk()
    const result = await mod.runCoordinatedSync(authFetch)
    expect(result.skipped).toBe(false)
    expect(result.succeeded).toBe(0)
    expect(authFetch).not.toHaveBeenCalled() // prazna vrsta — brez HTTP
    const meta = await mod.getMeta<Record<string, unknown>>(META_LAST_SYNC_RESULT)
    expect(meta).not.toBeNull()
    expect(meta!['succeeded']).toBe(0)
    expect(typeof meta!['at']).toBe('number')
  })

  it('lock PROST: callback z lock objektom → sync izveden enkrat, metadata + broadcast', async () => {
    const mod = await freshModule()
    const authFetch = makeAuthFetchOk()
    let lockCallbackInvocations = 0
    stubLocks(async (name, opts, cb) => {
      expect(name).toBe(SYNC_LOCK_NAME)
      expect(opts).toMatchObject({ ifAvailable: true })
      lockCallbackInvocations++
      return await cb({})
    })
    const result = await mod.runCoordinatedSync(authFetch)
    expect(lockCallbackInvocations).toBe(1)
    expect(result.skipped).toBe(false)
    const meta = await mod.getMeta<Record<string, unknown>>(META_LAST_SYNC_RESULT)
    expect(meta).not.toBeNull()
    // BroadcastChannel instanca: samo iz broadcastSyncResult (sync brez vnosov → izid 0)
    expect(FakeBroadcastChannel.instances.some((i) => i.name === SYNC_BROADCAST_CHANNEL)).toBe(true)
  })

  it('lock ZASEDEN: callback z null → skipped true, zero-result, BREZ HTTP in BREZ meta zapisa', async () => {
    const mod = await freshModule()
    const authFetch = makeAuthFetchOk()
    stubLocks(async (_name, _opts, cb) => await cb(null))
    const result = await mod.runCoordinatedSync(authFetch)
    expect(result.skipped).toBe(true)
    expect(result.succeeded).toBe(0)
    expect(result.conflicts).toBe(0)
    expect(result.authExpired).toBe(false)
    expect(result.orders.processed).toBe(0)
    expect(result.cancels.processed).toBe(0)
    expect(authFetch).not.toHaveBeenCalled()
    expect(await mod.getMeta(META_LAST_SYNC_RESULT)).toBeNull()
  })

  it('celoten tok: en vnos PENDING → koordiniran sync → SYNCED + serverAck + broadcast succeeded=1', async () => {
    const mod = await freshModule()
    const authFetch = makeAuthFetchOk()
    await mod.enqueueOrder({
      id: 'op-1',
      idempotencyKey: 'idem-1',
      orderData: makeOrderData(),
      createdAt: Date.now(),
    })
    // Naročnik (druga zavihka) posluša PRED syncem
    const received: Array<{ succeeded: number; type: string }> = []
    const unsubscribe = mod.subscribeSyncBroadcast((msg) => {
      received.push({ succeeded: msg.succeeded, type: msg.type })
    })
    const result = await mod.runCoordinatedSync(authFetch)
    await flush()
    expect(result.succeeded).toBe(1)
    expect(result.skipped).toBe(false)
    expect(authFetch).toHaveBeenCalledTimes(1)
    // vnos ostane v bazi kot SYNCED (7-dnevna retencija, R128 serverAck)
    const all = await mod.getAllOrders()
    expect(all[0].status).toBe('SYNCED')
    expect(all[0].serverAck).toMatchObject({ orderId: 'ord-1', serverStatus: 'applied' })
    // cross-tab odmev
    expect(received).toEqual([{ succeeded: 1, type: 'OFFLINE_SYNC_COMPLETED' }])
    // unsubscribe zapre naročnikov kanal
    unsubscribe()
    expect(FakeBroadcastChannel.instances[0].closed).toBe(true)
  })

  it('subscribeSyncBroadcast: napačen type ni dostavljen; delni podatki se normalizirajo (defaults)', async () => {
    const mod = await freshModule()
    const received: Array<{ succeeded: number; conflicts: number; authExpired: boolean; deviceId: string }> = []
    const unsubscribe = mod.subscribeSyncBroadcast((msg) => {
      received.push({ succeeded: msg.succeeded, conflicts: msg.conflicts, authExpired: msg.authExpired, deviceId: msg.deviceId })
    })
    const subscriber = FakeBroadcastChannel.instances[0]
    expect(subscriber).toBeDefined()
    // Napačen type → handler ni klican
    subscriber.onmessage?.({ data: { type: 'SOMETHING_ELSE', succeeded: 99 } })
    await flush()
    expect(received).toEqual([])
    // Pravi type z delnimi podatki → normalizacija (0/false/dev-unknown)
    subscriber.onmessage?.({ data: { type: SYNC_BROADCAST_COMPLETED, succeeded: 2 } })
    await flush()
    expect(received).toEqual([{ succeeded: 2, conflicts: 0, authExpired: false, deviceId: 'dev-unknown' }])
    unsubscribe()
  })

  it('degradacija: BroadcastChannel odsoten → broadcast no-throw, subscribe no-op, sync deluje', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const mod = await freshModule()
    const authFetch = makeAuthFetchOk()
    const zeroResult = {
      orders: { processed: 0, succeeded: 0, failed: 0, conflicts: 0, authExpired: false },
      cancels: { processed: 0, applied: 0, duplicates: 0, rejected: 0, retried: 0, networkFailed: 0, authExpired: false },
      succeeded: 0,
      conflicts: 0,
      authExpired: false,
    }
    expect(() => mod.broadcastSyncResult(zeroResult)).not.toThrow()
    const unsub = mod.subscribeSyncBroadcast(() => {
      throw new Error('ne sme biti klican')
    })
    expect(typeof unsub).toBe('function')
    expect(() => unsub()).not.toThrow()
    // sync še vedno deluje (brez BC — lock/poling ostajata)
    const result = await mod.runCoordinatedSync(authFetch)
    expect(result.skipped).toBe(false)
    expect(FakeBroadcastChannel.instances).toHaveLength(0)
  })
})
