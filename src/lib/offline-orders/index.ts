// ============================================
// OFFLINE ORDER QUEUE — IndexedDB + Background Sync
// ============================================
// Problem: Ko natakar naroča artikel in network pade, React Query
// mutation fail-a (retry: false) in podatki so izgubljeni.
//
// Rešitev: IndexedDB queue za offline naročila.
// 1. Če je offline → shrani naročilo v IndexedDB
// 2. Service Worker Background Sync → pošlje ko povezava pride nazaj
// 3. Fallback: polling vsake 5s če Background Sync ni na voljo
// 4. IdempotencyKey zagotavlja da ni duplikatov pri retry-jih
//
// INDICEDDB STORES v isti bazi:
//   1. pendingOrders   — naročila ko ni povezave (ta modul)
//   2. pendingReceipts — FURS računi ko ni povezave (offline-furs)
// ============================================

const DB_NAME = 'restaurantos-offline-queue'
const DB_VERSION = 1
const STORE_NAME = 'pendingOrders'
const ORDER_TTL_MS = 24 * 60 * 60 * 1000 // 24 ur (max čas za offline naročilo)

export interface PendingOrder {
  id: string // unique ID za IndexedDB (cuid ali UUID)
  idempotencyKey: string // server-side dedup ključ
  orderData: {
    type: string
    tableId: string | null
    diningOptionId: string | null
    customerName: string
    customerPhone: string
    discount: number
    appliedDiscountId: string | null
    taxRate?: number
    notes: string
    orderItems: Array<{
      menuItemId: string
      quantity: number
      price?: number
      notes: string
      modifiersJson: string
    }>
    employeeId?: string | null
  }
  createdAt: number // timestamp ms — kdaj je bilo naročilo ustvarjeno (offline)
  attempts: number // število poskusov sinhronizacije
  lastAttemptAt: number | null
  status: 'pending' | 'processing' | 'synced' | 'failed' | 'expired'
  syncedOrderId?: string // ID naročila na serverju (po uspešnem sync)
  syncError?: string // zadnja napaka pri sinhronizaciji
}

let dbInstance: IDBDatabase | null = null

/** Odpri IndexedDB za offline order queue */
function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return }
    if (dbInstance) { resolve(dbInstance); return }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('status', 'status', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
          store.createIndex('idempotencyKey', 'idempotencyKey', { unique: false })
        }
      }
      request.onsuccess = () => {
        dbInstance = request.result
        resolve(dbInstance)
      }
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** Dodaj naročilo v offline queue */
export async function enqueueOrder(
  order: Omit<PendingOrder, 'attempts' | 'lastAttemptAt' | 'status'>,
): Promise<boolean> {
  const db = await openDB()
  if (!db) return false

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const entry: PendingOrder = {
      ...order,
      attempts: 0,
      lastAttemptAt: null,
      status: 'pending',
    }
    store.put(entry)
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

/** Pridobi vsa čakajoča naročila (najstarejša prva) */
export async function getPendingOrders(): Promise<PendingOrder[]> {
  const db = await openDB()
  if (!db) return []

  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('status')
    return new Promise((resolve) => {
      const request = index.getAll('pending')
      request.onsuccess = () => {
        const orders = (request.result as PendingOrder[]).sort((a, b) => a.createdAt - b.createdAt)
        resolve(orders)
      }
      request.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

/** Označi naročilo kot uspešno sinhronizirano in odstrani iz queue */
export async function dequeueOrder(id: string): Promise<boolean> {
  const db = await openDB()
  if (!db) return false

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

/** Označi naročilo kot neuspešno (povečaj attempts, nastavi status) */
export async function markOrderFailed(id: string, error: string): Promise<boolean> {
  const db = await openDB()
  if (!db) return false

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(id)
    return new Promise((resolve) => {
      getRequest.onsuccess = () => {
        const order = getRequest.result as PendingOrder | undefined
        if (!order) { resolve(false); return }
        order.attempts += 1
        order.lastAttemptAt = Date.now()
        order.syncError = error.substring(0, 500)

        // Po 5 poskusih ali po 24h označi kot failed/expired
        const age = Date.now() - order.createdAt
        if (age > ORDER_TTL_MS) {
          order.status = 'expired'
        } else if (order.attempts >= 5) {
          order.status = 'failed'
        } else {
          order.status = 'pending' // ponovni poskus
        }
        store.put(order)
      }
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

/** Označi naročilo kot processing (prepreči duplikate pri vzporednem sync) */
export async function markOrderProcessing(id: string): Promise<boolean> {
  const db = await openDB()
  if (!db) return false

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(id)
    return new Promise((resolve) => {
      getRequest.onsuccess = () => {
        const order = getRequest.result as PendingOrder | undefined
        if (!order) { resolve(false); return }
        order.status = 'processing'
        order.lastAttemptAt = Date.now()
        store.put(order)
      }
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

/** Počisti expired/failed naročila starejša od 7 dni */
export async function cleanupOldOrders(): Promise<number> {
  const db = await openDB()
  if (!db) return 0

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const index = store.index('createdAt')
    const range = IDBKeyRange.upperBound(cutoff)
    return new Promise((resolve) => {
      let deleted = 0
      const request = index.openCursor(range)
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          const order = cursor.value as PendingOrder
          if (order.status === 'failed' || order.status === 'expired' || order.status === 'synced') {
            cursor.delete()
            deleted++
          }
          cursor.continue()
        }
      }
      tx.oncomplete = () => resolve(deleted)
      tx.onerror = () => resolve(0)
    })
  } catch {
    return 0
  }
}

/** Število čakajočih naročil v queue */
export async function getPendingCount(): Promise<number> {
  const db = await openDB()
  if (!db) return 0

  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('status')
    return new Promise((resolve) => {
      const request = index.count('pending')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(0)
    })
  } catch {
    return 0
  }
}

/**
 * Sinhroniziraj vsa čakajoča naročila s serverjem.
 * Klice se iz:
 *   1. Service Worker Background Sync
 *   2. Polling fallbacka (vsake 5s)
 *   3. Manual trigger (admin UI)
 */
export async function syncPendingOrders(authFetch: (url: string, options: RequestInit) => Promise<Response>): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const pending = await getPendingOrders()
  let succeeded = 0
  let failed = 0

  for (const order of pending) {
    // Označi kot processing
    await markOrderProcessing(order.id)

    try {
      const res = await authFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...order.orderData,
          idempotencyKey: order.idempotencyKey,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        // Označi kot synced in odstrani iz queue
        await dequeueOrder(order.id)
        succeeded++
        console.log(`[OfflineQueue] Order synced: ${order.idempotencyKey} → ${json.id}`)
      } else {
        const errorText = await res.text().catch(() => 'Unknown error')
        await markOrderFailed(order.id, `HTTP ${res.status}: ${errorText.substring(0, 200)}`)
        failed++
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      await markOrderFailed(order.id, errMsg)
      failed++
    }
  }

  return { processed: pending.length, succeeded, failed }
}

/**
 * Registriraj Background Sync za avtomatski retry pošiljanja naročil.
 * Browser bo sprožil 'sync' event v Service Workerju ob vzpostavitvi povezave.
 */
export async function registerOrderBackgroundSync(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready
      await (reg as unknown as { sync: { register: (_tag: string) => Promise<void> } }).sync.register('offline-order-sync')
      return true
    }
  } catch {
    // SyncManager ni na voljo — fallback na polling
  }
  return false
}

/** Ali je offline queue omogočen (IndexedDB + Service Worker)? */
export function isOfflineQueueAvailable(): boolean {
  return typeof indexedDB !== 'undefined' && 'serviceWorker' in navigator
}

/** Ali je trenutno online? */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

/**
 * Začni polling fallback za sinhronizacijo.
 * Klice syncPendingOrders vsake 5s ko je online.
 * Vrne funkcijo za ustavitev polling-a.
 */
export function startSyncPolling(
  authFetch: (url: string, options: RequestInit) => Promise<Response>,
  intervalMs = 5000,
): () => void {
  let running = true

  const poll = async () => {
    if (!running) return
    if (isOnline()) {
      const pending = await getPendingCount()
      if (pending > 0) {
        console.log(`[OfflineQueue] Polling: ${pending} pending orders to sync`)
        await syncPendingOrders(authFetch)
      }
    }
    if (running) {
      setTimeout(poll, intervalMs)
    }
  }

  poll()

  // Vrne stop funkcijo
  return () => { running = false }
}
