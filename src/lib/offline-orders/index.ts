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
// P1-14 (format vnosa — uporabniška specifikacija):
//   operationId, idempotencyKey, deviceId, locationId, employeeId,
//   createdAt, payloadVersion, retryCount, status, lastError
//   (+ internals: lastAttemptAt, syncedOrderId, orderData, attempts)
//
// P1-14 (statusi): PENDING | PROCESSING | SYNCED | RETRY | FAILED |
//   CONFLICT | MANUAL_REVIEW | EXPIRED — domenska pravila v sync-status.ts
//
// P1-15 (kritični fix): vnos, ujet v PROCESSING ko se aplikacija zapre
// sredi synca, je prej za VEDNO izgubil (getPendingOrders je bral samo
// 'pending', cleanup ni čistil 'processing'). Sedaj isProcessableStatus
// obravnava zastareli PROCESSING (5 min) kot ponovno obdelavo.
//
// INDEXEDDB STORES v isti bazi:
//   1. pendingOrders   — naročila ko ni povezave (ta modul)
//   2. pendingReceipts — FURS računi ko ni povezave (offline-furs)
// ============================================

import {
  normalizeStatus,
  isProcessableStatus,
  resolveSyncFailure,
  retentionMsForStatus,
  PAYLOAD_VERSION,
  type OfflineOpStatus,
} from './sync-status'

export {
  OFFLINE_OP_STATUSES,
  QUEUE_TTL_MS,
  MAX_RETRY_ATTEMPTS,
  PAYLOAD_VERSION,
  normalizeStatus,
  isProcessableStatus,
  resolveSyncFailure,
} from './sync-status'
export type { OfflineOpStatus } from './sync-status'

const DB_NAME = 'restaurantos-offline-queue'
const DB_VERSION = 1
const STORE_NAME = 'pendingOrders'
const DEVICE_ID_STORAGE_KEY = 'restaurantos-device-id'

/** Queue vnos — polja po P1-14 specifikaciji + legacy/interna polja. */
export interface PendingOrder {
  // ── P1-14 spec polja ──
  /** IndexedDB keyPath (primarni ključ) */
  id: string
  /** Semantični ID operacije — enak `id` (keyPath ostanek). */
  operationId: string
  /** Server-side dedup ključ (Order.idempotencyKey @unique) */
  idempotencyKey: string
  /** Stabilen identifikator naprave (localStorage UUID) */
  deviceId: string
  /** Lokacija, na kateri je bilo naročilo ustvarjeno (informacijsko —
   *  server RESOLVIRA lokacijo avtoritativno iz session/mize!) */
  locationId: string | null
  /** Zaposleni, ki je naročilo USTVARIL (atencija ne glede na to, kdo sinhronizira) */
  employeeId: string | null
  /** Unix ms — kdaj je bilo naročilo ustvarjeno (offline) */
  createdAt: number
  /** Verzija formata payload-a (glej sync-status.PAYLOAD_VERSION) */
  payloadVersion: number
  /** Število poskusov sinhronizacije (P1-14 ime; `attempts` = legacy zrcalo) */
  retryCount: number
  /** P1-14 status (velike črke) */
  status: OfflineOpStatus
  /** Zadnja napaka pri sinhronizaciji (`syncError` = legacy zrcalo) */
  lastError: string | null

  // ── interna / legacy polja ──
  attempts: number // legacy zrcalo retryCount
  syncError: string | null // legacy zrcalo lastError
  lastAttemptAt: number | null
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
  syncedOrderId?: string // ID naročila na serverju (po uspešnem sync)
}

/**
 * Obvezna polja za NOV vnos v queue; vsa ostala P1-14 polja
 * (status, retryCount, deviceId, payloadVersion, ...) se dopolnijo samodejno.
 */
export type NewQueueEntry = Pick<PendingOrder, 'id' | 'idempotencyKey' | 'orderData' | 'createdAt'>
  & Partial<Omit<PendingOrder, 'id' | 'idempotencyKey' | 'orderData' | 'createdAt' | 'status' | 'attempts' | 'syncError'>>

let dbInstance: IDBDatabase | null = null

/**
 * Stabilen deviceId za to napravo (localStorage UUID).
 * Namembnost: P1-14 sledljjivost offline operacij po napravi
 * (dve napravi, isti zaposleni → ločljivo po deviceId).
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return 'server'
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY)
    if (existing) return existing
    const id = `dev-${typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`}`
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, id)
    return id
  } catch {
    // localStorage nedotenljiv (private mode) — nestabilen fallback
    return 'dev-unknown'
  }
}

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

/**
 * Normaliziraj surovo IndexedDB vrstico v PendingOrder:
 * - starejše verzije so imele lowercase statuse ('pending') → uppercase
 * - starejše verzije niso imele operationId/retryCount/lastError/payloadVersion
 * - employeeId na vrhnji ravni (P1-14) → preslikan tudi v orderData
 */
function normalizeEntry(raw: unknown): PendingOrder | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  if (typeof e.id !== 'string' || !e.orderData) return null

  const attempts = typeof e.attempts === 'number' ? e.attempts
    : typeof e.retryCount === 'number' ? e.retryCount : 0
  const orderData = e.orderData as PendingOrder['orderData']
  const employeeId =
    typeof e.employeeId === 'string' ? e.employeeId
      : typeof orderData.employeeId === 'string' ? (orderData.employeeId as string)
        : null

  return {
    id: e.id,
    operationId: typeof e.operationId === 'string' ? e.operationId : e.id,
    idempotencyKey: typeof e.idempotencyKey === 'string' ? e.idempotencyKey : '',
    deviceId: typeof e.deviceId === 'string' ? e.deviceId : 'dev-legacy',
    locationId: typeof e.locationId === 'string' ? e.locationId : null,
    employeeId,
    createdAt: typeof e.createdAt === 'number' ? e.createdAt : Date.now(),
    payloadVersion: typeof e.payloadVersion === 'number' ? e.payloadVersion : 1,
    retryCount: typeof e.retryCount === 'number' ? e.retryCount : attempts,
    status: normalizeStatus(e.status),
    lastError: typeof e.lastError === 'string' ? e.lastError
      : typeof e.syncError === 'string' ? e.syncError : null,
    attempts,
    syncError: typeof e.syncError === 'string' ? e.syncError : null,
    lastAttemptAt: typeof e.lastAttemptAt === 'number' ? e.lastAttemptAt : null,
    orderData: { ...orderData, employeeId },
    syncedOrderId: typeof e.syncedOrderId === 'string' ? e.syncedOrderId : undefined,
  }
}

/** Zapiši vnos v queue (idempotentno po `id`). */
function putEntry(db: IDBDatabase, entry: PendingOrder): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(entry)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/**
 * Dodaj naročilo v offline queue.
 * Samodejno dopolni P1-14 polja: operationId, deviceId, payloadVersion,
 * status=PENDING, retryCount=0, lastError=null.
 */
export async function enqueueOrder(
  order: NewQueueEntry,
): Promise<boolean> {
  const db = await openDB()
  if (!db) return false

  const retryCount = order.retryCount ?? 0
  const lastError = order.lastError ?? null
  const entry: PendingOrder = {
    ...order,
    // P1-14 spec polja — samodejne privzete vrednosti
    operationId: order.operationId || order.id,
    deviceId: order.deviceId || getDeviceId(),
    locationId: order.locationId ?? null,
    employeeId: order.employeeId ?? null,
    payloadVersion: order.payloadVersion ?? PAYLOAD_VERSION,
    retryCount,
    lastError,
    status: 'PENDING',
    attempts: retryCount,
    syncError: lastError,
    lastAttemptAt: order.lastAttemptAt ?? null,
  }
  if (entry.orderData && entry.employeeId) {
    entry.orderData.employeeId = entry.employeeId
  }

  return putEntry(db, entry)
}

/** Preberi VSE vnose (normalizirane) — vključno z ne-obdelovalnimi statusi. */
export async function getAllOrders(): Promise<PendingOrder[]> {
  const db = await openDB()
  if (!db) return []

  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    return new Promise((resolve) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const orders = (request.result as unknown[])
          .map(normalizeEntry)
          .filter((o): o is PendingOrder => o !== null)
          .sort((a, b) => a.createdAt - b.createdAt)
        resolve(orders)
      }
      request.onerror = () => resolve([])
    })
  } catch {
    return []
  }
}

/**
 * Vnosi, pripravljeni na sinhronizacijo:
 * PENDING vedno; RETRY po backoffu; zastareli PROCESSING (>5 min —
 * aplikacija se je zaprla sredi synca) se VRNE v obdelavo.
 *
 * P1-15 FIX: prej je getPendingOrders bral SAMO status 'pending' —
 * vnos, ujet v 'processing', bi bil za vedno izgubljen.
 */
export async function getProcessableOrders(): Promise<PendingOrder[]> {
  const now = Date.now()
  const all = await getAllOrders()
  return all.filter(o => isProcessableStatus(o.status, o.lastAttemptAt, now))
}

/** @deprecated uporabljaj getProcessableOrders (P1-14/15) */
export async function getPendingOrders(): Promise<PendingOrder[]> {
  return getProcessableOrders()
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

/** Nastavi status (in napako) vnosa — splošni P1-14 prehod. */
export async function markOrderStatus(
  id: string,
  status: OfflineOpStatus,
  error?: string,
): Promise<boolean> {
  const db = await openDB()
  if (!db) return false

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(id)
    return new Promise((resolve) => {
      getRequest.onsuccess = () => {
        const raw = getRequest.result as unknown
        const order = normalizeEntry(raw)
        if (!order) { resolve(false); return }
        order.status = status
        if (error !== undefined) {
          order.lastError = error.substring(0, 500)
          order.syncError = order.lastError
        }
        if (status === 'RETRY' || status === 'FAILED' || status === 'MANUAL_REVIEW' || status === 'EXPIRED') {
          order.retryCount = (order.retryCount || 0) + 1
          order.attempts = order.retryCount
        }
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

/**
 * Neuspešen poskus (P1-15 domenska pravila — glej sync-status.resolveSyncFailure):
 *  401 → PENDING (brez štetja poskusa; čakaj re-login)
 *  409 → CONFLICT (zadrži za ročni pregled)
 *  400/404/410/422 → MANUAL_REVIEW (trajna klientova napaka)
 *  omrežje/5xx/429 → RETRY/FAILED (z backoffom)
 */
export async function markOrderFailed(
  id: string,
  error: string,
  httpStatus: number | null = null,
): Promise<boolean> {
  const db = await openDB()
  if (!db) return false

  const now = Date.now()
  let outcome = resolveSyncFailure(httpStatus, 0, 0)
  // Preberi trenutni vnos za attempts/age (resolveSyncFailure potrebuje dejanske vrednosti)
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(id)
    return new Promise((resolve) => {
      getRequest.onsuccess = () => {
        const order = normalizeEntry(getRequest.result)
        if (!order) { resolve(false); return }
        const age = now - order.createdAt
        outcome = resolveSyncFailure(httpStatus, order.retryCount, age)
        order.status = outcome.status
        order.lastError = error.substring(0, 500)
        order.syncError = order.lastError
        if (outcome.countAttempt) {
          order.retryCount = order.retryCount + 1
          order.attempts = order.retryCount
        }
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
        const order = normalizeEntry(getRequest.result)
        if (!order) { resolve(false); return }
        order.status = 'PROCESSING'
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

/**
 * P1-15: cleanup spoštuje domensko retencijo:
 *   SYNCED/FAILED/EXPIRED → 7 dni; CONFLICT/MANUAL_REVIEW → 30 dni;
 *   PENDING/PROCESSING/RETRY → NIKOLI (živa vrsta).
 * Prej je čistil samo status 'failed'/'expired'/'synced' — zastareli
 * 'processing' (zaprta aplikacija) bi ostal za vedno.
 */
export async function cleanupOldOrders(): Promise<number> {
  const db = await openDB()
  if (!db) return 0

  const now = Date.now()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    return new Promise((resolve) => {
      let deleted = 0
      const request = store.getAll()
      request.onsuccess = () => {
        const entries = (request.result as unknown[])
          .map(normalizeEntry)
          .filter((o): o is PendingOrder => o !== null)
        for (const order of entries) {
          const retention = retentionMsForStatus(order.status)
          if (retention > 0 && now - order.createdAt > retention) {
            store.delete(order.id)
            deleted++
          }
        }
      }
      tx.oncomplete = () => resolve(deleted)
      tx.onerror = () => resolve(0)
    })
  } catch {
    return 0
  }
}

/** Število obdelovalnih (PENDING/RETRY/zastareli PROCESSING) naročil */
export async function getPendingCount(): Promise<number> {
  return (await getProcessableOrders()).length
}

/**
 * P1-15/P1-16 (admin UI): vnosi, ki čakajo ROČNI PREGLED — CONFLICT,
 * MANUAL_REVIEW (zadržani namensko) + FAILED/EXPIRED (revizijska zgodovina).
 * Živa vrsta (PENDING/RETRY/PROCESSING) NI vključena — vidna ločeno.
 */
export async function getReviewOrders(): Promise<PendingOrder[]> {
  const all = await getAllOrders()
  return all.filter(o =>
    o.status === 'CONFLICT' ||
    o.status === 'MANUAL_REVIEW' ||
    o.status === 'FAILED' ||
    o.status === 'EXPIRED'
  )
}

/** Število vnosov, ki čakajo ročni pregled (CONFLICT + MANUAL_REVIEW). */
export async function getReviewCount(): Promise<number> {
  const all = await getAllOrders()
  return all.filter(o => o.status === 'CONFLICT' || o.status === 'MANUAL_REVIEW').length
}

/**
 * P1-15 (admin UI): ponovno pošlji EN vnos (ročni retry iz preglednega
 * panela). Uporabi isti POST /api/orders kanal + idempotencyKey, z
 * enakim resolveSyncFailure prehodom kot samodejni sync.
 */
export async function syncSingleOrder(
  id: string,
  authFetch: (url: string, options: RequestInit) => Promise<Response>,
): Promise<{ ok: boolean; status: OfflineOpStatus | 'SYNCED'; httpStatus: number | null; message: string }> {
  const db = await openDB()
  if (!db) return { ok: false, status: 'FAILED', httpStatus: null, message: 'IndexedDB ni na voljo' }

  const entry = normalizeEntry(await new Promise<unknown>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(id)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  }))
  if (!entry) return { ok: false, status: 'FAILED', httpStatus: null, message: 'Vnos ni najden' }

  await markOrderProcessing(entry.id)

  let httpStatus: number | null = null
  let ok = false
  let json: { id?: string } | null = null
  try {
    const res = await authFetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...entry.orderData,
        idempotencyKey: entry.idempotencyKey,
      }),
    })
    httpStatus = res.status
    ok = res.ok
    if (ok) json = await res.json().catch(() => null)
  } catch {
    httpStatus = null
    ok = false
  }

  if (ok) {
    await dequeueOrder(entry.id)
    console.log(`[OfflineQueue] Manual retry synced: ${entry.idempotencyKey} → ${json?.id}`)
    return { ok: true, status: 'SYNCED', httpStatus, message: 'Sinhronizirano' }
  }

  const outcome = resolveSyncFailure(httpStatus, entry.retryCount, Date.now() - entry.createdAt)
  if (outcome.status === 'PENDING') {
    // 401 — avtentikacija potekla; vnos ostane PENDING (ne šteje poskusa)
    await markOrderStatus(entry.id, 'PENDING')
    return { ok: false, status: 'PENDING', httpStatus, message: 'Seja je potekla — ponovno se prijavite' }
  }

  const errorText = httpStatus === null
    ? 'Omrežna napaka (ni odgovora)'
    : `HTTP ${httpStatus}`
  await markOrderStatus(entry.id, outcome.status, `${errorText}: ${outcome.reason}`)
  return { ok: false, status: outcome.status, httpStatus, message: `${errorText}: ${outcome.reason}` }
}

/** Statistika po statusih (za UI/audit — npr. prikaz CONFLICT za ročni pregled). */
export async function getQueueStats(): Promise<Record<OfflineOpStatus, number>> {
  const all = await getAllOrders()
  const stats = Object.fromEntries(
    (['PENDING', 'PROCESSING', 'SYNCED', 'RETRY', 'FAILED', 'CONFLICT', 'MANUAL_REVIEW', 'EXPIRED'] as OfflineOpStatus[])
      .map(s => [s, 0]),
  ) as Record<OfflineOpStatus, number>
  for (const o of all) stats[o.status] = (stats[o.status] || 0) + 1
  return stats
}

/**
 * Sinhroniziraj obdelovalne vnose s serverjem.
 * Klice se iz:
 *   1. Service Worker Background Sync
 *   2. Polling fallbacka (vsake 5s)
 *   3. Manual trigger (admin UI)
 *
 * P1-15: 401 prekine nadaljnjo obdelavo (brez štetja poskusov — po
 * re-loginu se samo nadaljuje); 409/4xx zadržita vnos z ustreznim
 * statusom za ročni pregled namesto slepega retry-ja.
 */
export async function syncPendingOrders(
  authFetch: (url: string, options: RequestInit) => Promise<Response>,
): Promise<{
  processed: number
  succeeded: number
  failed: number
  conflicts: number
  authExpired: boolean
}> {
  const pending = await getProcessableOrders()
  let succeeded = 0
  let failed = 0
  let conflicts = 0
  let authExpired = false

  for (const order of pending) {
    // Označi kot processing
    await markOrderProcessing(order.id)

    let httpStatus: number | null = null
    let ok = false
    let json: { id?: string } | null = null

    try {
      const res = await authFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...order.orderData,
          idempotencyKey: order.idempotencyKey,
        }),
      })
      httpStatus = res.status
      ok = res.ok
      if (ok) json = await res.json().catch(() => null)
    } catch {
      httpStatus = null // omrežna napaka
      ok = false
    }

    if (ok) {
      // Označi kot synced in odstrani iz queue
      await dequeueOrder(order.id)
      succeeded++
      console.log(`[OfflineQueue] Order synced: ${order.idempotencyKey} → ${json?.id}`)
      continue
    }

    const outcome = resolveSyncFailure(httpStatus, order.retryCount, Date.now() - order.createdAt)

    if (outcome.status === 'PENDING') {
      // 401 — potrebna ponovna prijava: USTAVI, vnos ostane PENDING
      await markOrderStatus(order.id, 'PENDING')
      authExpired = true
      break
    }

    const errorText = httpStatus === null
      ? 'Omrežna napaka (ni odgovora)'
      : `HTTP ${httpStatus}`
    await markOrderStatus(order.id, outcome.status, `${errorText}: ${outcome.reason}`)

    if (outcome.status === 'CONFLICT' || outcome.status === 'MANUAL_REVIEW') {
      conflicts++
      console.warn(`[OfflineQueue] ${outcome.status}: ${order.idempotencyKey} — zadržano za ročni pregled`)
    } else {
      failed++
    }
  }

  return { processed: pending.length, succeeded, failed, conflicts, authExpired }
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
