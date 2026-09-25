// ============================================
// OFFLINE CANCEL OPS — preklic SINHRONIZIRANIH naročil brez povezave (R128)
// ============================================
// Problema: order.create op-i imajo IndexedDB vrsto (index.ts), preklic
// SINHRONIZIRANEGA naročila offline pa ni bil mogoč (PUT /api/orders/[id]
// faila brez mreže). Ta modul doda 'order.cancel' operacije v ISTO IndexedDB
// vrsto (putOp iz index.ts — brez spremembe sheme) in jih batch-pošilja na
// NOV endpoint POST /api/device-sync.
//
// Kontrakt s strežnikom (R128-server, model DeviceSyncOperation):
//   POST /api/device-sync
//   Headers: Content-Type: application/json, Authorization: Bearer <token>
//   Body: { deviceId, operations: [{ clientOperationId, type: 'order.cancel',
//           payload: { orderId, reason? }, createdAt: ISO, retryCount }] }
//   200/201 → { results: [{ clientOperationId,
//              status: 'applied' | 'duplicate' | 'rejected', error? }] }
//   401     → ustavi BREZ trošenja poskusa (mirror orders-sync)
//
// Preslikava rezultatov (applySyncResults — ČISTA, unit-testabilna):
//   applied | duplicate                → SYNCED + serverAck
//   rejected ORDER_NOT_FOUND |
//            PAID_ORDER_CANCEL |
//            ORDER_COMPLETED           → MANUAL_REVIEW (trajno — retry ne pomaga)
//   rejected SYNC_CONFLICT             → RETRY (backoff prek sync-status stroja)
//   rejected <neznani razlog>          → RETRY (fail-safe: operacija se ne izgubi)
//
// Exactly-once: clientOperationId (= operationId) je strežniški dedup ključ
// — izgubljen odgovor po uspešnem aplikiranju se ob ponovnem pošiljanju
// vrne kot 'duplicate' → SYNCED. Zato syncCancelOps NE markira PROCESSING
// (network fail → vnos ostane PENDING, takojšnji retry je varen).
//
// OPOMBA (dokumentirana omejitev): Service Worker Background Sync ostane
// order-create ONLY (public/sw.js se NE ureja) — cancel op-e pokrijeta
// polling (startSyncPolling) + 'online' event handler (syncAllOfflineOps).
// ============================================

import { PAYLOAD_VERSION, QUEUE_TTL_MS, type OfflineOpStatus } from './sync-status'
import {
  getDeviceId,
  putOp,
  markOrderStatus,
  dequeueOrder,
  getAllOrders,
  getProcessableOrders,
  syncPendingOrders,
  type PendingOrder,
  type ServerAck,
  type OrderCancelData,
} from './index'
import { logger } from '@/lib/logger'

/** Endpoint za batch pošiljanje device operacij (R128 strežniška polovica). */
const DEVICE_SYNC_ENDPOINT = '/api/device-sync'

/** Max operacij na en batch klic. */
export const DEVICE_SYNC_CHUNK_SIZE = 50

/** Trajno zavrnjeni razlogi strežnika → MANUAL_REVIEW (retry ne more uspeti).
 *  (INVALID_CANCEL_PAYLOAD = okvarjen klientov payload — retry ne pomaga;
 *   UNSUPPORTED_OPERATION je pri tipiziranem klientu nemogoč → RETRY fail-safe.) */
const PERMANENT_REJECT_REASONS: ReadonlySet<string> = new Set([
  'ORDER_NOT_FOUND',
  'PAID_ORDER_CANCEL',
  'ORDER_COMPLETED',
  'INVALID_CANCEL_PAYLOAD',
])

// ── Branje seje — mirror usePinAuth.getAuthToken/getCurrentUser ──
// (lib NE sme importati komponent; isti storage ključi = isti vir podatkov)

function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem('pos_auth_token')
      ?? localStorage.getItem('pos_auth_token')
      ?? localStorage.getItem('pos_token')
  } catch {
    return null
  }
}

function readCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem('pos_auth_user') ?? localStorage.getItem('pos_auth_user')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { id?: unknown }
    return typeof parsed.id === 'string' ? parsed.id : null
  } catch {
    return null
  }
}

function uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

// ── Čista logika (unit-testabilna brez IndexedDB) ──

/**
 * Sestavi envelope za order.cancel op (P1-14 polja + R128 opType).
 * id === operationId (keyPath konvencija store-a) in je hkrati
 * clientOperationId na žici (strežniški dedup ključ).
 */
export function buildCancelOp(orderId: string, reason?: string, now: number = Date.now()): PendingOrder {
  const operationId = uuid()
  return {
    id: operationId,
    operationId,
    opType: 'order.cancel',
    idempotencyKey: `cancel-${orderId}`,
    deviceId: getDeviceId(),
    locationId: null, // server lokacijo resolvira avtoritativno (konvencija orders)
    employeeId: readCurrentUserId(),
    createdAt: now,
    payloadVersion: PAYLOAD_VERSION,
    retryCount: 0,
    status: 'PENDING',
    lastError: null,
    attempts: 0,
    syncError: null,
    lastAttemptAt: null,
    orderData: reason ? { orderId, reason } : { orderId },
  }
}

/** Razdeli operacije na bathe max `size` (čista; vrstni red ohranjen). */
export function chunkOperations<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) return items.length > 0 ? [[...items]] : []
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/** Žična oblika ene operacije (POST /api/device-sync body). */
export interface DeviceSyncWireOp {
  clientOperationId: string
  type: 'order.cancel'
  payload: { orderId: string; reason?: string }
  /** ISO čas ustvarjanja op-a na napravi. */
  createdAt: string
  retryCount: number
}

/** Ena vrstica strežnikovega odgovora ({ results: [...] }). */
export interface DeviceSyncResultRow {
  clientOperationId: string
  status: 'applied' | 'duplicate' | 'rejected'
  error?: string
}

/** Ciljni orderId order.cancel op-a (undefined za tuje/legacy vnose). */
function cancelTargetOrderId(op: PendingOrder): string | undefined {
  return op.opType === 'order.cancel' && 'orderId' in op.orderData
    ? op.orderData.orderId
    : undefined
}

export interface CancelOpDecision {
  op: PendingOrder
  /** Surovi izid strežnika za to operacijo. */
  outcome: DeviceSyncResultRow['status']
  /** Naslednji status vnosa v vrsti. */
  status: OfflineOpStatus
  /** Potrditev strežnika — samo applied/duplicate. */
  serverAck?: ServerAck
  /** Zadnja napaka — samo rejected/retry. */
  lastError?: string
  /** UI obvestilo na ISTEM kanalu kot order-sync SW sporočila. */
  event?: { type: 'SYNC_CONFLICT' | 'SYNC_MANUAL_REVIEW'; payload: Record<string, unknown> }
}

/**
 * ČISTA preslikava strežnikovih rezultatov v odločitve po vnosu
 * (persistira jo syncCancelOps prek markOrderStatus). Ne stranskih učinkov.
 */
export function applySyncResults(
  ops: readonly PendingOrder[],
  results: readonly DeviceSyncResultRow[],
): CancelOpDecision[] {
  const byClientOpId = new Map(ops.map(o => [o.operationId, o]))
  const decisions: CancelOpDecision[] = []

  for (const row of results) {
    const op = byClientOpId.get(row.clientOperationId)
    if (!op) continue // odgovor za neznano operacijo — prezri (fail-closed)
    const orderId = cancelTargetOrderId(op)

    if (row.status === 'applied' || row.status === 'duplicate') {
      decisions.push({
        op,
        outcome: row.status,
        status: 'SYNCED',
        serverAck: {
          orderId,
          syncedAt: new Date().toISOString(),
          serverStatus: row.status,
        },
      })
      continue
    }

    const code = row.error ?? 'REJECTED'
    if (code === 'SYNC_CONFLICT') {
      // Domenski konflikt na strežniku → RETRY z backoffom (statusni stroj)
      decisions.push({
        op,
        outcome: 'rejected',
        status: 'RETRY',
        lastError: code,
        event: { type: 'SYNC_CONFLICT', payload: { orderId } },
      })
      continue
    }
    if (PERMANENT_REJECT_REASONS.has(code)) {
      // Trajno zavrnjeno (naročilo ne obstaja / plačano / zaključeno) →
      // ročni pregled, NIKOLI tihi retry
      decisions.push({
        op,
        outcome: 'rejected',
        status: 'MANUAL_REVIEW',
        lastError: code,
        event: { type: 'SYNC_MANUAL_REVIEW', payload: { orderId, status: code } },
      })
      continue
    }
    // Neznani razlog → RETRY (fail-safe; operacija se ne izgubi)
    decisions.push({ op, outcome: 'rejected', status: 'RETRY', lastError: code })
  }

  return decisions
}

// ── IndexedDB operacije (ista store kot order.create) ──

/** R128: uvrsti preklic SINHRONIZIRANEGA naročila v offline vrsto (order.cancel). */
export async function enqueueCancelOrder(orderId: string, reason?: string): Promise<boolean> {
  return putOp(buildCancelOp(orderId, reason))
}

/** Obdelovalni order.cancel op-i (PENDING / RETRY po backoffu / zastareli PROCESSING). */
export async function getPendingCancelOps(): Promise<PendingOrder[]> {
  const processable = await getProcessableOrders()
  return processable.filter(o => o.opType === 'order.cancel')
}

/** Število obdelovalnih order.cancel op-ov (za vrata pollinga). */
export async function getPendingCancelOpCount(): Promise<number> {
  return (await getPendingCancelOps()).length
}

// ── Sync ──

export interface CancelSyncResult {
  processed: number
  applied: number
  duplicates: number
  /** rejected → trajno (MANUAL_REVIEW) */
  rejected: number
  /** rejected SYNC_CONFLICT / neznano → RETRY (backoff) */
  retried: number
  /** batch klici brez odgovora (omrežje/5xx) — vnosi ostanejo PENDING */
  networkFailed: number
  authExpired: boolean
}

/** Preslikaj vnos v žično obliko (POST /api/device-sync). */
function toWireOp(op: PendingOrder): DeviceSyncWireOp {
  const data = op.orderData as OrderCancelData
  const payload: { orderId: string; reason?: string } = { orderId: data?.orderId ?? op.id }
  if (data?.reason) payload.reason = data.reason
  return {
    clientOperationId: op.operationId,
    type: 'order.cancel',
    payload,
    createdAt: new Date(op.createdAt).toISOString(),
    retryCount: op.retryCount,
  }
}

/**
 * R128: UI obvestila na ISTEM kanalu kot Service Worker sporočila order-sync-a
 * (useOrderPanelMutations.handleSwMessage posluša 'message' na
 * navigator.serviceWorker z data.type SYNC_*; enaka oblika payload-a).
 * Fallback: window CustomEvent z istim imenom in detail = data.
 */
function dispatchSyncEvent(
  type: 'SYNC_CONFLICT' | 'SYNC_MANUAL_REVIEW' | 'SYNC_FAILED',
  payload: Record<string, unknown> = {},
): void {
  if (typeof window === 'undefined') return
  const data = { type, ...payload }
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data }))
      return
    }
  } catch {
    // pade naprej na window fallback
  }
  try {
    window.dispatchEvent(new CustomEvent(type, { detail: data }))
  } catch {
    // UI obvestila niso kritična — tiho
  }
}

/**
 * Batch-sync VSEH obdelovalnih order.cancel op-ov na POST /api/device-sync
 * (bathe max DEVICE_SYNC_CHUNK_SIZE). Obdelava rezultatov per-op prek čiste
 * applySyncResults; 401 ustavi brez trošenja poskusa; omrežna napaka pusti
 * vnose PENDING (exactly-once zagotavlja clientOperationId dedup na strežniku).
 */
export async function syncCancelOps(
  authFetch: (url: string, options: RequestInit) => Promise<Response>,
): Promise<CancelSyncResult> {
  const result: CancelSyncResult = {
    processed: 0, applied: 0, duplicates: 0, rejected: 0, retried: 0, networkFailed: 0, authExpired: false,
  }

  const ops = await getPendingCancelOps()
  if (ops.length === 0) return result

  // Brez žetona → tiho ustavi (klical bi 401; ne troši poskusa — mirror orders-sync)
  if (!getStoredAuthToken()) {
    logger.debug('OfflineQueue', 'Cancel sync preskočen — ni avtentikacijskega žetona')
    return result
  }

  // TTL (24h) — mirror resolveSyncFailure TTL pravila: prestar vnos → EXPIRED
  const now = Date.now()
  const fresh: PendingOrder[] = []
  for (const op of ops) {
    if (now - op.createdAt > QUEUE_TTL_MS) {
      await markOrderStatus(op.id, 'EXPIRED', 'TTL_EXCEEDED')
    } else {
      fresh.push(op)
    }
  }
  result.processed = fresh.length
  if (fresh.length === 0) return result

  for (const chunk of chunkOperations(fresh, DEVICE_SYNC_CHUNK_SIZE)) {
    let data: { results?: DeviceSyncResultRow[] } | null = null
    try {
      const res = await authFetch(DEVICE_SYNC_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          operations: chunk.map(toWireOp),
        }),
      })
      data = await res.json().catch(() => null)
    } catch (err) {
      const httpStatus = (err as { status?: number | null }).status ?? null
      if (httpStatus === 401) {
        // Seja potekla — USTAVI brez trošenja poskusa (vnosi ostanejo PENDING;
        // po re-loginu polling sam nadaljuje — mirror orders-sync)
        result.authExpired = true
        return result
      }
      // Omrežje/drugi HTTP — chunk ostane PENDING (exactly-once prek
      // clientOperationId dedup); obvesti UI prek SYNC_FAILED in ustavi
      // (nadaljnji chunk-i bi padli na isti vzrok)
      result.networkFailed++
      logger.warn('OfflineQueue', `Cancel sync batch ni uspel (${String(httpStatus)}) — ${chunk.length} op-ov ostaja PENDING`)
      dispatchSyncEvent('SYNC_FAILED', {
        orderId: cancelTargetOrderId(chunk[0]),
        status: httpStatus ?? undefined,
      })
      return result
    }

    const decisions = applySyncResults(chunk, data?.results ?? [])
    for (const d of decisions) {
      // SYNCED počisti morebitni star lastError ('' = reset)
      await markOrderStatus(d.op.id, d.status, d.status === 'SYNCED' ? (d.lastError ?? '') : d.lastError, d.serverAck)
      if (d.event) dispatchSyncEvent(d.event.type, d.event.payload)
      if (d.status === 'SYNCED') {
        if (d.outcome === 'duplicate') result.duplicates++
        else result.applied++
        logger.info('OfflineQueue', `Cancel op ${d.op.operationId} ${d.outcome} (orderId=${cancelTargetOrderId(d.op) ?? '?'})`)
      } else if (d.status === 'MANUAL_REVIEW') {
        result.rejected++
        logger.warn('OfflineQueue', `Cancel op ${d.op.operationId} zavrnjen (${d.lastError}) — ročni pregled`)
      } else {
        result.retried++
      }
    }
  }

  return result
}

export interface SyncAllResult {
  orders: Awaited<ReturnType<typeof syncPendingOrders>>
  cancels: CancelSyncResult
  /** Združeni seštevki — ista oblika, ki jo pričakuje 'online' toast logika. */
  succeeded: number
  conflicts: number
  authExpired: boolean
}

/**
 * R128: kombinirani sync — order.create (POST /api/orders, en-by-en)
 * nato order.cancel (POST /api/device-sync, batch ≤ 50). Kličejo ga
 * startSyncPolling + 'online' event handler v useOrderPanelMutations.
 */
export async function syncAllOfflineOps(
  authFetch: (url: string, options: RequestInit) => Promise<Response>,
): Promise<SyncAllResult> {
  const orders = await syncPendingOrders(authFetch)
  const cancels = await syncCancelOps(authFetch)
  return {
    orders,
    cancels,
    succeeded: orders.succeeded + cancels.applied + cancels.duplicates,
    conflicts: orders.conflicts + cancels.rejected,
    authExpired: orders.authExpired || cancels.authExpired,
  }
}

// ── Offline preklic iz StornoDialoga (3 primeri) ──

export type OfflineCancelOutcome = 'removed-local' | 'queued'

/**
 * R128: offline preklic — prestrežen na vstopu cancel handlerja (kliče se
 * SAMO ko je !isOnline()):
 *   (a) naročilo obstaja SAMO v lokalni vrsti (še ni poslano) → odstrani vnos lokalno
 *   (b) sinhronizirano naročilo → uvrsti order.cancel op (posreduje se ob povezavi)
 *   (c) online → klicatelj sploh ne pride sem (obstoječi tok ostane nespremenjen)
 * Vrača null, ko lokalna akcija NI uspela (IndexedDB nedosegljiv) — klicatelj
 * pade naprej v obstoječi tok (authFetch bo vrgel omrežno napako).
 */
export async function handleOfflineCancel(orderId: string, reason?: string): Promise<OfflineCancelOutcome | null> {
  // (a) živ (še neposlan) order.create vnos z tem ID-jem → lokalni preklic
  const local = await findLiveLocalOrderOp(orderId)
  if (local) {
    const removed = await dequeueOrder(local.id)
    if (removed) logger.info('OfflineQueue', `Offline cancel: queue vnos ${local.id} odstranjen lokalno`)
    return removed ? 'removed-local' : null
  }
  // (b) sinhronizirano naročilo → preklic v vrsto (sync ob ponovni povezavi)
  const queued = await enqueueCancelOrder(orderId, reason)
  if (queued) logger.info('OfflineQueue', `Offline cancel: order.cancel op za ${orderId} v vrsti`)
  return queued ? 'queued' : null
}

/** Živ (PENDING/PROCESSING/RETRY) order.create vnos za podan order id. */
async function findLiveLocalOrderOp(orderId: string): Promise<PendingOrder | null> {
  const all = await getAllOrders()
  return all.find(o =>
    o.opType !== 'order.cancel' &&
    (o.id === orderId || o.operationId === orderId) &&
    (o.status === 'PENDING' || o.status === 'PROCESSING' || o.status === 'RETRY'),
  ) ?? null
}
