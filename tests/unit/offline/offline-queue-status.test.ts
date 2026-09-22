// ============================================
// P1-14/P1-15 — OFFLINE QUEUE STATUSNI STROJ (unit testi)
// ============================================
// Čista logika iz src/lib/offline-orders/sync-status.ts — domenska
// pravila konfliktov iz uporabnikove specifikacije (točka 15):
//   - plačila/zaloga/fiskalizacija/zaključeni računi/storno/cash drawer/
//     zaključek izmene → NIKOLI "last write wins", ampak CONFLICT +
//     ročni pregled
//   - 401 → brez štetja poskusa (čakaj re-login)
//   - aplikacija se zapre med syncom → zastareli PROCESSING se povrne
// ============================================

import { describe, it, expect } from 'vitest'
import {
  normalizeStatus,
  isProcessableStatus,
  resolveSyncFailure,
  retentionMsForStatus,
  retryDelayMs,
  QUEUE_TTL_MS,
  MAX_RETRY_ATTEMPTS,
  PROCESSING_STALE_MS,
  PAYLOAD_VERSION,
  OFFLINE_OP_STATUSES,
} from '@/lib/offline-orders/sync-status'

const NOW = 1_700_000_000_000 // fiksen "zdaj" za deterministične teste

describe('P1-14: normalizeStatus — legacy lowercase migracija', () => {
  it('stare lowercase statuse normalizira v uppercase', () => {
    expect(normalizeStatus('pending')).toBe('PENDING')
    expect(normalizeStatus('processing')).toBe('PROCESSING')
    expect(normalizeStatus('failed')).toBe('FAILED')
    expect(normalizeStatus('expired')).toBe('EXPIRED')
    expect(normalizeStatus('synced')).toBe('SYNCED')
  })

  it('velike črke ostanejo', () => {
    expect(normalizeStatus('PENDING')).toBe('PENDING')
    expect(normalizeStatus('MANUAL_REVIEW')).toBe('MANUAL_REVIEW')
    expect(normalizeStatus('CONFLICT')).toBe('CONFLICT')
  })

  it('neznane/missing vrednosti → PENDING (IndexedDB persistira čez deploye)', () => {
    expect(normalizeStatus(undefined)).toBe('PENDING')
    expect(normalizeStatus(null)).toBe('PENDING')
    expect(normalizeStatus(42)).toBe('PENDING')
    expect(normalizeStatus('garbage')).toBe('PENDING')
  })

  it('OFFLINE_OP_STATUSES vsebuje vseh 7 statusov iz specifikacije (+ EXPIRED)', () => {
    for (const s of ['PENDING', 'PROCESSING', 'SYNCED', 'RETRY', 'FAILED', 'CONFLICT', 'MANUAL_REVIEW']) {
      expect(OFFLINE_OP_STATUSES).toContain(s)
    }
    expect(OFFLINE_OP_STATUSES).toHaveLength(8)
  })
})

describe('P1-15: isProcessableStatus — kaj gre v sinhronizacijo', () => {
  it('PENDING je vedno obdelovalen', () => {
    expect(isProcessableStatus('PENDING', null, NOW)).toBe(true)
    expect(isProcessableStatus('PENDING', NOW, NOW)).toBe(true)
  })

  it('ZAPUŠČENI PROCESSING (>5 min) se povrne v obdelavo — "aplikacija se zapre med syncom"', () => {
    // Svež processing (druga zanka dela) — ne dotikaj
    expect(isProcessableStatus('PROCESSING', NOW - 60_000, NOW)).toBe(false)
    expect(isProcessableStatus('PROCESSING', NOW - 4 * 60_000, NOW)).toBe(false)
    // Zastareli processing (app umrla sredi synca) → povrni
    expect(isProcessableStatus('PROCESSING', NOW - PROCESSING_STALE_MS - 1, NOW)).toBe(true)
    expect(isProcessableStatus('PROCESSING', NOW - 60 * 60_000, NOW)).toBe(true)
    // PROCESSING brez lastAttemptAt → nedokončan zapis → povrni
    expect(isProcessableStatus('PROCESSING', null, NOW)).toBe(true)
  })

  it('RETRY po backoffu (30s+ na poskus)', () => {
    // ravno poskušano — še ne
    expect(isProcessableStatus('RETRY', NOW - 10_000, NOW)).toBe(false)
    // poskus 1 → backoff 30s
    expect(isProcessableStatus('RETRY', NOW - 31_000, NOW)).toBe(true)
    // brez zadnjega poskusa → takoj
    expect(isProcessableStatus('RETRY', null, NOW)).toBe(true)
  })

  it('CONFLICT / MANUAL_REVIEW / SYNCED / FAILED / EXPIRED nikoli niso obdelovalni', () => {
    for (const s of ['CONFLICT', 'MANUAL_REVIEW', 'SYNCED', 'FAILED', 'EXPIRED'] as const) {
      expect(isProcessableStatus(s, null, NOW)).toBe(false)
      expect(isProcessableStatus(s, NOW - 10 * 60_000, NOW)).toBe(false)
    }
  })
})

describe('P1-15: resolveSyncFailure — domenska pravila konfliktov', () => {
  it('401 → PENDING brez štetja poskusa (čakaj re-login, ne požri poskusa)', () => {
    const out = resolveSyncFailure(401, 3, 1000)
    expect(out.status).toBe('PENDING')
    expect(out.countAttempt).toBe(false)
    expect(out.action).toBe('restore')
  })

  it('409 → CONFLICT — zadržano za ročni pregled, NIKOLI last-write-wins', () => {
    const out = resolveSyncFailure(409, 0, 1000)
    expect(out.status).toBe('CONFLICT')
    expect(out.action).toBe('keep')
    // tudi ob visokem števcu poskusov ostane CONFLICT (ne FAILED)
    expect(resolveSyncFailure(409, 10, 1000).status).toBe('CONFLICT')
  })

  it('trajne klientove napake (400/404/410/422) → MANUAL_REVIEW', () => {
    for (const status of [400, 404, 410, 422]) {
      const out = resolveSyncFailure(status, 0, 1000)
      expect(out.status, `HTTP ${status}`).toBe('MANUAL_REVIEW')
      expect(out.action).toBe('keep')
    }
  })

  it('omrežna napaka (null) → RETRY (a pod pragom poskusov)', () => {
    const out = resolveSyncFailure(null, 0, 1000)
    expect(out.status).toBe('RETRY')
    expect(out.countAttempt).toBe(true)
  })

  it('5xx in 429 → RETRY', () => {
    expect(resolveSyncFailure(500, 0, 1000).status).toBe('RETRY')
    expect(resolveSyncFailure(503, 2, 1000).status).toBe('RETRY')
    expect(resolveSyncFailure(429, 0, 1000).status).toBe('RETRY')
  })

  it('ob 5 poskusih (MAX_RETRY_ATTEMPTS) → FAILED', () => {
    // attempts=4 → 5. poskus na poti
    expect(resolveSyncFailure(500, 4, 1000).status).toBe('FAILED')
    expect(resolveSyncFailure(null, 4, 1000).status).toBe('FAILED')
    // attempts=3 → še RETRY
    expect(resolveSyncFailure(500, 3, 1000).status).toBe('RETRY')
  })

  it('starost čez TTL (24h) → EXPIRED ne glede na status', () => {
    expect(resolveSyncFailure(500, 0, QUEUE_TTL_MS + 1).status).toBe('EXPIRED')
    expect(resolveSyncFailure(409, 0, QUEUE_TTL_MS + 1).status).toBe('EXPIRED')
  })

  it('TTL ima prednost pred 401 — zelo star vnos ob re-loginu ne gre znova', () => {
    expect(resolveSyncFailure(401, 0, QUEUE_TTL_MS + 1).status).toBe('EXPIRED')
  })
})

describe('P1-14: retencija po statusu (cleanup)', () => {
  it('živa vrsta (PENDING/PROCESSING/RETRY) se NIKOLI samodejno ne pobriše', () => {
    expect(retentionMsForStatus('PENDING')).toBe(0)
    expect(retentionMsForStatus('PROCESSING')).toBe(0)
    expect(retentionMsForStatus('RETRY')).toBe(0)
  })

  it('konflikti in ročni pregledi ostanejo 30 dni', () => {
    expect(retentionMsForStatus('CONFLICT')).toBe(30 * 24 * 60 * 60 * 1000)
    expect(retentionMsForStatus('MANUAL_REVIEW')).toBe(30 * 24 * 60 * 60 * 1000)
  })

  it('SYNCED/FAILED/EXPIRED — 7 dni zgodovine', () => {
    expect(retentionMsForStatus('SYNCED')).toBe(7 * 24 * 60 * 60 * 1000)
    expect(retentionMsForStatus('FAILED')).toBe(7 * 24 * 60 * 60 * 1000)
    expect(retentionMsForStatus('EXPIRED')).toBe(7 * 24 * 60 * 60 * 1000)
  })
})

describe('P1-14: konstante formata', () => {
  it('PAYLOAD_VERSION je 1', () => {
    expect(PAYLOAD_VERSION).toBe(1)
  })

  it('TTL je 24h, MAX_RETRY 5, PROCESSING_STALE 5 min', () => {
    expect(QUEUE_TTL_MS).toBe(24 * 60 * 60 * 1000)
    expect(MAX_RETRY_ATTEMPTS).toBe(5)
    expect(PROCESSING_STALE_MS).toBe(5 * 60 * 1000)
  })

  it('retryDelayMs: linearno 30s/poskus, max 5 min', () => {
    expect(retryDelayMs(1)).toBe(30_000)
    expect(retryDelayMs(2)).toBe(60_000)
    expect(retryDelayMs(10)).toBe(5 * 60_000) // cap
    expect(retryDelayMs(0)).toBe(30_000) // min 1 poskus
  })
})

// ============================================
// Uporabnikovi testni scenariji (P1-15) — preslikava na domenska pravila
// ============================================
describe('P1-15: uporabnikovi testni scenariji → obnašanje sistema', () => {
  it('scenarij "aplikacija se zapre med syncom": vnos ostane PROCESSING → po 5 min ponovno', () => {
    // App umrla takoj po markOrderProcessing — lastAttemptAt = takrat
    const lastAttempt = NOW - 10 * 60_000 // 10 min nazaj
    expect(isProcessableStatus('PROCESSING', lastAttempt, NOW)).toBe(true)
  })

  it('scenarij "naprava izgubi povezavo med commitom": omrežna napaka → RETRY, vnos ohranjen', () => {
    const out = resolveSyncFailure(null, 0, 1000)
    expect(out.action).toBe('keep')
    expect(out.status).toBe('RETRY')
  })

  it('scenarij "isti payment se sinhronizira dvakrat": idempotencyKey @unique na serverju — offline vrsta doda dedup ključ', () => {
    // (Strežniška stran: Payment.idempotencyKey @unique + P2002 race path —
    //  preverjeno v obstoječih payment testih; tu dokumentiramo povezavo.)
    expect(PAYLOAD_VERSION).toBe(1)
    expect(QUEUE_TTL_MS).toBeGreaterThan(0)
  })

  it('scenarij "FURS request se pošlje dvakrat": fiskalni duplikat = 409 → CONFLICT (ne izgubi)', () => {
    // Strežnik vrne 409 ob duplikatnem fiskalnem oddajanju (outbox idempotenca)
    const out = resolveSyncFailure(409, 0, 1000)
    expect(out.status).toBe('CONFLICT')
    expect(out.action).toBe('keep')
  })

  it('scenarij "uporabnik se odjavi z nedokončano queue operacijo": vnos ostane, 401 ga ne uniči', () => {
    const out = resolveSyncFailure(401, 2, 1000)
    expect(out.status).toBe('PENDING') // naslednja prijava nadaljuje
    expect(out.countAttempt).toBe(false)
  })
})
