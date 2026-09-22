// ============================================
// OFFLINE QUEUE — STATUSNI stroj (P1-14/P1-15)
// ============================================
// ČISTA logika (brez IndexedDB/fetch odvisnosti) — enostavno testabilna.
// Uporabljata jo src/lib/offline-orders/index.ts (page) in public/sw.js
// (Service Worker — konceptualno ista pravila, ročno preslikana).
//
// Specifikacija (uporabnik, P1-14):
//   Statuse: PENDING, PROCESSING, SYNCED, RETRY, FAILED, CONFLICT,
//   MANUAL_REVIEW
//   Polja: operationId, idempotencyKey, deviceId, locationId, employeeId,
//   createdAt, payloadVersion, retryCount, status, lastError
//
// Domenska pravila konfliktov (P1-15):
//   401 → PENDING (ustavi, čakaj re-login — NE požri poskusa)
//   409 → CONFLICT (zadrži vnos — ročni pregled, NIKOLI "last write wins")
//   400/404/410/422 → MANUAL_REVIEW (trajna napaka — retry ne pomaga)
//   429/5xx/omrežje → RETRY z backoffom; po MAX_RETRY_ATTEMPTS → FAILED
//   starost > TTL → EXPIRED
// ============================================

export type OfflineOpStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SYNCED'
  | 'RETRY'
  | 'FAILED'
  | 'CONFLICT'
  | 'MANUAL_REVIEW'
  | 'EXPIRED'

export const OFFLINE_OP_STATUSES: readonly OfflineOpStatus[] = [
  'PENDING', 'PROCESSING', 'SYNCED', 'RETRY', 'FAILED', 'CONFLICT', 'MANUAL_REVIEW', 'EXPIRED',
] as const

/** Max življenjska doba offline operacije (24h — prej je bilo 24h za orders). */
export const QUEUE_TTL_MS = 24 * 60 * 60 * 1000
/** Max število poskusov pred FAILED. */
export const MAX_RETRY_ATTEMPTS = 5
/** PROCESSING, ki traja dlje od tega, se šteje za zapuščenega (app se zaprla med sync). */
export const PROCESSING_STALE_MS = 5 * 60 * 1000
/** Max backoff med poskusi. */
export const RETRY_BACKOFF_MAX_MS = 5 * 60 * 1000
/** Konflikti/ročni pregledi se hranijo dlje (30 dni) kot ostala zgodovina (7 dni). */
export const REVIEW_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
export const HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

/** Verzija formata queue vnosa — povečaj ob spremembi strukture payload-a. */
export const PAYLOAD_VERSION = 1

/**
 * Normaliziraj status: starejše verzije kode so uporabljale
 * male črke ('pending', 'processing', ...). IndexedDB persistira
 * čez deploye — zato ob branju normaliziramo.
 */
export function normalizeStatus(raw: unknown): OfflineOpStatus {
  if (typeof raw !== 'string') return 'PENDING'
  const upper = raw.toUpperCase() as OfflineOpStatus
  return (OFFLINE_OP_STATUSES as readonly string[]).includes(upper) ? upper : 'PENDING'
}

/** Backoff pred naslednjim poskusom: attempts × 30s, max 5 min. */
export function retryDelayMs(attempts: number): number {
  return Math.min(Math.max(attempts, 1) * 30 * 1000, RETRY_BACKOFF_MAX_MS)
}

/**
 * Ali je vnos kandidat za sinhronizacijo?
 *   PENDING   → vedno (ne glede na zadnji poskus)
 *   RETRY     → po backoffu (retryDelayMs)
 *   PROCESSING→ samo ČE je zastarel (app se zaprla sredi synca — sicer
 *               ga sinhronizira druga zanka / sploh ne sme biti ponovno poslan)
 *   ostali    → nikoli (SYNCED se briše, FAILED/CONFLICT/MANUAL_REVIEW/EXPIRED čakajo)
 */
export function isProcessableStatus(
  status: OfflineOpStatus,
  lastAttemptAt: number | null,
  now: number = Date.now(),
): boolean {
  switch (status) {
    case 'PENDING':
      return true
    case 'RETRY': {
      if (lastAttemptAt === null) return true
      return now - lastAttemptAt >= retryDelayMs(1)
    }
    case 'PROCESSING':
      // Zastareli PROCESSING = aplikacija se zaprla sredi synca (P1-15 test
      // "aplikacija se zapre med syncom") → vrnemo v obdelavo.
      if (lastAttemptAt === null) return true
      return now - lastAttemptAt >= PROCESSING_STALE_MS
    default:
      return false
  }
}

export type SyncFailureOutcome =
  | { action: 'restore'; status: 'PENDING'; countAttempt: false; reason: 'AUTH_EXPIRED' }
  | { action: 'keep'; status: 'CONFLICT'; countAttempt: true; reason: 'CONFLICT' }
  | { action: 'keep'; status: 'MANUAL_REVIEW'; countAttempt: true; reason: 'PERMANENT_CLIENT_ERROR' }
  | { action: 'keep'; status: 'RETRY' | 'FAILED' | 'EXPIRED'; countAttempt: true; reason: 'RETRYABLE' | 'TTL_EXCEEDED' }

/**
 * Odloči, kaj narediti z neuspelim poskusom sinhronizacije.
 *
 * @param httpStatus  HTTP status odgovora ali null (omrežna napaka / timeout)
 * @param attempts    število DOSLEDAŠNJIH poskusov (pred tem poskusom)
 * @param ageMs       starost vnosa (now - createdAt)
 */
export function resolveSyncFailure(
  httpStatus: number | null,
  attempts: number,
  ageMs: number,
): SyncFailureOutcome {
  // Starost čez TTL — ne glede na vzrok, več ne poskušamo
  if (ageMs > QUEUE_TTL_MS) {
    return { action: 'keep', status: 'EXPIRED', countAttempt: true, reason: 'TTL_EXCEEDED' }
  }

  // Omrežna napaka (fetch throw) — retryable
  if (httpStatus === null) {
    return attempts + 1 >= MAX_RETRY_ATTEMPTS
      ? { action: 'keep', status: 'FAILED', countAttempt: true, reason: 'RETRYABLE' }
      : { action: 'keep', status: 'RETRY', countAttempt: true, reason: 'RETRYABLE' }
  }

  // 401 — avtentikacija je potekla: USTAVI, ne požri poskusa.
  // Po ponovni prijavi polling sam nadaljuje (vnos ostane PENDING).
  if (httpStatus === 401) {
    return { action: 'restore', status: 'PENDING', countAttempt: false, reason: 'AUTH_EXPIRED' }
  }

  // 409 — domenski konflikt (ZDDV/FURS duplikat, zasedena miza, spremenjena
  // zaloga …). "Last write wins" je PREPOVEDAN — zadržimo za ročni pregled.
  if (httpStatus === 409) {
    return { action: 'keep', status: 'CONFLICT', countAttempt: true, reason: 'CONFLICT' }
  }

  // Trajne klientove napake — retry NE more uspeti (neveljaven payload,
  // izbrisan artikel, neveljaven referenčni ID …) → ročni pregled.
  if (httpStatus === 400 || httpStatus === 404 || httpStatus === 410 || httpStatus === 422) {
    return { action: 'keep', status: 'MANUAL_REVIEW', countAttempt: true, reason: 'PERMANENT_CLIENT_ERROR' }
  }

  // 429 (rate limit) in 5xx (strežnik) — retryable z backoffom
  return attempts + 1 >= MAX_RETRY_ATTEMPTS
    ? { action: 'keep', status: 'FAILED', countAttempt: true, reason: 'RETRYABLE' }
    : { action: 'keep', status: 'RETRY', countAttempt: true, reason: 'RETRYABLE' }
}

/**
 * Retencija po statusu za cleanup:
 *   SYNCED/FAILED/EXPIRED → HISTORY_RETENTION_MS (7 dni)
 *   CONFLICT/MANUAL_REVIEW → REVIEW_RETENTION_MS (30 dni — čas za ročni pregled)
 *   PENDING/PROCESSING/RETRY → 0 (nikoli samodejno pobriši — živa vrsta!)
 */
export function retentionMsForStatus(status: OfflineOpStatus): number {
  switch (status) {
    case 'SYNCED':
    case 'FAILED':
    case 'EXPIRED':
      return HISTORY_RETENTION_MS
    case 'CONFLICT':
    case 'MANUAL_REVIEW':
      return REVIEW_RETENTION_MS
    default:
      return 0
  }
}
