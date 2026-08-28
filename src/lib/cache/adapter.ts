// ============================================
// CACHE ADAPTER INTERFACE
//
// Skupni interface za in-memory (dev/single-instance) in Redis (multi-replica).
// Uporablja se v:
//   - src/lib/webauthn/challenge-store.ts (WebAuthn challenge)
//   - src/lib/rate-limit/core.ts (rate limit counters)
//
// Issue #39: prej so bili oba samo Map<> — v multi-replica deploymentu
// (Vercel/Render) je vsaka replica imela svoj state, kar je pomenilo:
//   - Rate limit bypass: napadalec spremeni request med replike → 5x večja meja
//   - WebAuthn challenge failure: challenge se ustvari na repliki A, request pride
//     na repliko B → "challenge not found"
// ============================================

/**
 * Cache vrednost — string (base64url, JSON, ip naslov, ...).
 * Adapter je odgovoren za serializacijo če potrebuje (npr. Redis shranjuje bytes).
 */
export type CacheValue = string | number

/**
 * Rezultat rate-limit check operacije.
 */
export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs?: number
}

/**
 * Konfiguracija rate-limit okna.
 */
export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

/**
 * Cache adapter — abstrakcija nad Map<>/Redis/whatever.
 *
 * Vse metode so async — tudi MemoryAdapter, ker kličemo z await in ne
 * onesnažujemo kode z if/else sync/async.
 *
 * Implementacije:
 *   - MemoryCacheAdapter: dev, single-instance prod (default)
 *   - RedisCacheAdapter: multi-replica prod (Vercel/Render/ECS)
 */
export interface CacheAdapter {
  /** Ime adapterja za logiranje */
  readonly name: string

  // ─── WebAuthn challenge-style operacije ───

  /**
   * Shrani vrednost s TTL.
   * Če ključ že obstaja, se overwrite-a (set semantics).
   */
  set(key: string, value: CacheValue, ttlMs: number): Promise<void>

  /**
   * Vzame in ATOMSKO odstrani vrednost (one-shot).
   * Če ne najde ali je potekel → null.
   */
  take(key: string): Promise<CacheValue | null>

  /**
   * Preberi vrednost (brez brisanja).
   * Če ne najde ali je potekel → null.
   */
  get(key: string): Promise<CacheValue | null>

  /**
   * Izbriši vrednost (če obstaja). Idempotentna.
   */
  delete(key: string): Promise<void>

  // ─── Rate-limit style operacije ───

  /**
   * Inkrementiraj števec v oknu.
   *   - Prvi klic: inc = 1, resetAt = now + windowMs
   *   - Nadaljni klici: inc + 1 (če ni potekel)
   *   - Po poteku: reset na 1
   *
   * Atomarnost je ključna — brez tega multi-replica bypass-a rate limit.
   *
   * @param key - tipično `rate-limit:<route>:<ip>`
   * @param windowMs - veljavnost okna v ms
   * @param maxRequests - max dovoljenih (samo za return value, ne enforcement)
   * @returns { count, retryAfterMs, remaining }
   */
  increment(
    key: string,
    windowMs: number,
    maxRequests: number,
  ): Promise<{ count: number; retryAfterMs: number; remaining: number }>

  // ─── Utility ───

  /**
   * Počisti VSE vrednosti. Samo za teste!
   * V produkciji ne kliči — počistil bo rate-limit vse replike.
   */
  clear(): Promise<void>

  /**
   * Število aktivnih vnosov (za debug/monitoring).
   */
  size(): Promise<number>
}
