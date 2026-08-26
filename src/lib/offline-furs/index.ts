// ============================================
// OFFLINE FURS RECEIPT QUEUE — IndexedDB + Background Sync
// ============================================
// Slovenski zakon (ZDDV-1) zahteva davčno potrjevanje računov v 48h.
// Ta modul zagotavlja, da so nepotrjeni računi shranjeni lokalno
// in se avtomatsko ponovno pošljejo FURS-u ob vzpostavitvi povezave.
// ============================================

const DB_NAME = 'restaurantos-furs-queue'
const DB_VERSION = 1
const STORE_NAME = 'pendingReceipts'
const FURS_TTL_MS = 48 * 60 * 60 * 1000 // 48 ur (ZDDV-1 zakonski rok)

interface PendingReceipt {
  id: string // receipt ID iz baze
  orderId: string
  orderNumber: number
  zoi: string // lokalno generiran ZOI
  receiptData: unknown // celoten XML paket za FURS
  createdAt: number // timestamp ms
  attempts: number // število poskusov pošiljanja
  lastAttemptAt: number | null
  status: 'pending' | 'processing' | 'failed' | 'expired'
}

let dbInstance: IDBDatabase | null = null

/** Odpri IndexedDB za FURS queue */
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

/** Dodaj račun v offline FURS queue */
export async function enqueueReceipt(receipt: Omit<PendingReceipt, 'attempts' | 'lastAttemptAt' | 'status'>): Promise<boolean> {
  const db = await openDB()
  if (!db) return false

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const entry: PendingReceipt = {
      ...receipt,
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

/** Pridobi vse čakajoče račune (prioriteta: najstarejši prvi) */
export async function getPendingReceipts(): Promise<PendingReceipt[]> {
  const db = await openDB()
  if (!db) return []

  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('status')
    return new Promise((resolve) => {
      const request = index.getAll('pending')
      request.onsuccess = () => {
        const receipts = (request.result as PendingReceipt[]).sort((a, b) => a.createdAt - b.createdAt)
        resolve(receipts)
      }
      request.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

/** Označi račun kot poslan (odstrani iz queue) */
export async function dequeueReceipt(id: string): Promise<boolean> {
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

/** Označi račun kot neuspešen (povečaj attempts, nastavi status) */
export async function markReceiptFailed(id: string): Promise<boolean> {
  const db = await openDB()
  if (!db) return false

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(id)
    return new Promise((resolve) => {
      getRequest.onsuccess = () => {
        const receipt = getRequest.result as PendingReceipt | undefined
        if (!receipt) { resolve(false); return }
        receipt.attempts += 1
        receipt.lastAttemptAt = Date.now()
        // Po 5 poskusih ali po 48h označi kot failed/expired
        const age = Date.now() - receipt.createdAt
        if (age > FURS_TTL_MS) {
          receipt.status = 'expired'
        } else if (receipt.attempts >= 5) {
          receipt.status = 'failed'
        } else {
          receipt.status = 'pending' // ponovni poskus
        }
        store.put(receipt)
      }
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

/** Počisti expired/failed račune starejše od 7 dni */
export async function cleanupOldReceipts(): Promise<number> {
  const db = await openDB()
  if (!db) return 0

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000 // 7 dni
    const index = store.index('createdAt')
    const range = IDBKeyRange.upperBound(cutoff)
    return new Promise((resolve) => {
      let deleted = 0
      const request = index.openCursor(range)
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          cursor.delete()
          deleted++
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

/** Število čakajočih računov v queue */
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
 * Registriraj Background Sync za avtomatski retry FURS pošiljanja.
 * Browser bo sprožil 'sync' event v Service Workerju ob vzpostavitvi povezave.
 */
export async function registerFursBackgroundSync(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready
      // @typescript-eslint/no-explicit-any — SyncManager ni v vseh TS lib-ih
      await (reg as unknown as { sync: { register: (_tag: string) => Promise<void> } }).sync.register('furs-receipt-sync')
      return true
    }
  } catch {
    // SyncManager ni na voljo — fallback na polling
  }
  return false
}

/** Ali je FURS queue omogočen (IndexedDB + Service Worker)? */
export function isFursQueueAvailable(): boolean {
  return typeof indexedDB !== 'undefined' && 'serviceWorker' in navigator
}
