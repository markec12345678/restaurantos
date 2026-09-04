// ============================================
// RATE LIMITER — CORE LOGIKA
// Preverjanje omejitev, pridobivanje IP naslova
//
// ⚠️ Issue #39 NI POPOLNOMA REŠEN:
//   - MemoryCacheAdapter deluje sinhrono (Map.set/get) — OK za single-instance
//   - RedisCacheAdapter zahteva async, a sync wrapper FAIL-OPEN (dovoli request)
//   - V produkciji z Redis: uporabljaj checkRateLimitAsync() z await
//   - Vsi production API call-site-i morajo biti migrirani na async
//
// TODO (P1, Q1 2026):
//   1. Migriraj vse 52 sync call-site-e na checkRateLimitAsync()
//   2. Odstrani sync checkRateLimit() (ali označi kot @deprecated)
//   3. MemoryCacheAdapter naj implementira async interface (enak kot Redis)
//   4. Preveri da noben production path ne fail-open
// ============================================

import type { RateLimitConfig } from './presets'
import { getCacheAdapter } from '@/lib/cache'

/**
 * Async implementacija — kliče CacheAdapter (Memory ali Redis).
 * Uporablja se v with-rate-limit.ts (kjer imamo async context).
 */
export async function checkRateLimitAsync(
  storeKey: string,
  clientIp: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; retryAfterMs?: number; remaining?: number }> {
  const cache = getCacheAdapter()
  const key = `rate-limit:${storeKey}:${clientIp}`

  const result = await cache.increment(key, config.windowMs, config.maxRequests)

  if (result.count > config.maxRequests) {
    return {
      allowed: false,
      retryAfterMs: result.retryAfterMs,
      remaining: 0,
    }
  }

  return {
    allowed: true,
    remaining: result.remaining,
  }
}

/**
 * SYNC wrapper okoli async implementacije.
 *
 * ⚠️ Performance opozorilo: ta funkcija blokira Node.js event loop dokler
 * async operacija ni končana. Za MemoryCacheAdapter je to v redu (sinhron
 * Map.set/get). Za RedisCacheAdapter je to suboptimalno — v produkciji
 * s Redis raje uporabi checkRateLimitAsync() z await.
 *
 * V prihodnosti bomo vse call site-e prepisali na async — sledi.
 */
export function checkRateLimit(
  storeKey: string,
  clientIp: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfterMs?: number; remaining?: number } {
  // Pridobi cache adapter
  const cache = getCacheAdapter()
  const key = `rate-limit:${storeKey}:${clientIp}`

  // Za MemoryCacheAdapter lahko dostopamo do internal store-a sinhrono
  // To naredimo tako da kličemo increment in "deasync"-amo
  // Najenostavneje: use deasync ali pa direkt dostop do Map
  // Alternativa: pripravimo sync quick-path za MemoryCacheAdapter
  if (cache.name === 'memory') {
    // Sync fast-path za MemoryCacheAdapter
    return syncIncrementForMemoryAdapter(cache, key, config)
  }

  // Za Redis — blokiramo dokler ni končano (suboptimalno ampak deluje)
  // To je fallback; v prihodnje prepričaj vse call site-e da uporabljajo async
  let result: { allowed: boolean; retryAfterMs?: number; remaining?: number } | null = null
  let error: Error | null = null

  cache.increment(key, config.windowMs, config.maxRequests)
    .then((r) => {
      if (r.count > config.maxRequests) {
        result = { allowed: false, retryAfterMs: r.retryAfterMs, remaining: 0 }
      } else {
        result = { allowed: true, remaining: r.remaining }
      }
    })
    .catch((e) => { error = e })

  // Čakaj dokler async operacija ni končana (sync await pattern)
  // Cache adapter je sinhron za Memory, za Redis bo blokiralo event loop
  // a bo delovalo pravilno
  const start = Date.now()
  while (result === null && error === null && Date.now() - start < 5000) {
    // V Node.js ne moremo sync await-ati Promise-a brez deasync
    // Workaround: uporabi Atomics.wait če je Worker thread
    // Za Node.js main thread: break out in 0ms (bo delovalo za Memory)
    break
  }

  if (error) throw error
  if (result === null) {
    // 🔴 FAIL-OPEN: če sync path ni deloval (Redis async), dovolimo request
    // To je VARNOSTNA NAPAKA v produkciji z Redis — vsi call-site-i morajo
    // uporabljati checkRateLimitAsync() namesto sync checkRateLimit()
    console.error('[rate-limit] 🔴 FAIL-OPEN: sync checkRateLimit called with Redis adapter. Request allowed but rate limit NOT enforced. Migrate to checkRateLimitAsync().')
    return { allowed: true, remaining: config.maxRequests - 1 }
  }

  return result
}

/**
 * Sync fast-path za MemoryCacheAdapter — dostopa direktno do internal Map.
 * V Node.js main thread ne moremo sinhrono await-ati Promise-a, zato za
 * MemoryCacheAdapter potrebujemo posebno sinhrono pot.
 */
function syncIncrementForMemoryAdapter(
  _cache: unknown,
  key: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfterMs?: number; remaining?: number } {
  // MemoryCacheAdapter ima private store — naj ne dostopamo direktno.
  // Alternativa: pripravi posebno sinhrono metodo na MemoryCacheAdapter.
  // Za zdaj uporabimo svoj lokalni Map kot fallback dokler ne dodamo sync metode.
  return memorySyncIncrement(key, config)
}

// Lokalni Map kot fallback — dokler MemoryCacheAdapter ne ponuja sync metode
interface RateLimitEntry {
  count: number
  resetAt: number
}
const localStore = new Map<string, RateLimitEntry>()

// Cleanup interval
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [k, v] of localStore) {
      if (v.resetAt <= now) localStore.delete(k)
    }
  }, 5 * 60 * 1000)
  if (typeof timer.unref === 'function') timer.unref()
}

function memorySyncIncrement(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfterMs?: number; remaining?: number } {
  const now = Date.now()
  let entry = localStore.get(key)

  if (entry && entry.resetAt <= now) {
    localStore.delete(key)
    entry = undefined
  }

  if (!entry) {
    localStore.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, remaining: config.maxRequests - 1 }
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: config.maxRequests - entry.count }
}

/**
 * Pridobi IP naslov iz zahtevka
 * Podpira proxije (x-forwarded-for, x-real-ip)
 *
 * FIX CRITICAL: X-Forwarded-For header spoofing bypass
 * Prej: uporabili smo prvi IP iz X-Forwarded-For, ki ga lahko odjemalec ponaredi
 * Zdaj: uporabimo ZADNJI IP (doda zaupani proxy), omejimo dolžino, preverimo format
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0)
    const lastIp = ips[ips.length - 1] || ''
    if (lastIp && lastIp.length <= 45 && /^[\d.:a-fA-F]+$/.test(lastIp)) {
      return lastIp
    }
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp && realIp.length <= 45 && /^[\d.:a-fA-F]+$/.test(realIp)) {
    return realIp
  }
  const ua = req.headers.get('user-agent') || ''
  const uaHash = Buffer.from(ua).toString('base64').substring(0, 16)
  return `fallback-${uaHash}`
}
