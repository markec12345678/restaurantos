// ============================================
// RATE LIMITER — CORE LOGIKA
// Preverjanje omejitev, pridobivanje IP naslova
//
// ✅ Issue #39 FIXED (P0-1):
//   - checkRateLimitAsync() je FAIL-CLOSED: če Redis odpove, request je ZAVRNJEN
//   - Sync checkRateLimit() je @deprecated — ne uporabljaj v production
//   - Vsi production API call-site-i migrirani na await checkRateLimitAsync()
//
// Fail-closed logika:
//   - MemoryCacheAdapter: vedno deluje (sinhrono, brez Redis)
//   - RedisCacheAdapter: če Redis odpove → { allowed: false } (NE allowed: true)
//   - To pomeni: napaka v infrastrukturi ne more omogočiti brute-force napada
// ============================================

import type { RateLimitConfig } from './presets'
import { getCacheAdapter } from '@/lib/cache'

/**
 * Async implementacija — kliče CacheAdapter (Memory ali Redis).
 *
 * ✅ FAIL-CLOSED: če cache.increment() vrne napako (Redis nedosegljiv),
 * request je ZAVRNJEN (allowed: false). To preprečuje brute-force napade
* tudi ko Redis odpove.
 *
 * To je edina funkcija, ki se sme uporabljati v production API-jih.
 */
export async function checkRateLimitAsync(
  storeKey: string,
  clientIp: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; retryAfterMs?: number; remaining?: number }> {
  const cache = getCacheAdapter()
  const key = `rate-limit:${storeKey}:${clientIp}`

  try {
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
  } catch (error) {
    // 🔴 FAIL-CLOSED: če cache (Redis) odpove, ZAVRNEMO request
    // To je pravilno varnostno držo: "if we can't verify the rate limit, reject"
    console.error('[rate-limit] 🔴 FAIL-CLOSED: cache.increment() failed — rejecting request', error)
    return {
      allowed: false,
      retryAfterMs: config.windowMs,
      remaining: 0,
    }
  }
}

/**
 * @deprecated NE UPORABLJAJ — uporabljaj checkRateLimitAsync() z await.
 *
 * Ta sync funkcija FAIL-CLOSED ko je Redis adapter aktiven (prej je bila FAIL-OPEN,
 * kar je bila varnostna napaka #39). Sedaj zavrne request namesto da ga dovoli.
 *
 * MemoryCacheAdapter (dev/single-instance): deluje sinhrono, brez problema.
 * RedisCacheAdapter (production): ne more sinhrono await-ati → FAIL-CLOSED.
 *
 * Vsi production call-site-i so migrirani na `await checkRateLimitAsync()`.
 * Ta funkcija ostaja samo za backward compat in bo odstranjena v v2.0.
 */
export function checkRateLimit(
  storeKey: string,
  clientIp: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfterMs?: number; remaining?: number } {
  const cache = getCacheAdapter()
  const key = `rate-limit:${storeKey}:${clientIp}`

  // MemoryCacheAdapter: sync fast-path (deluje pravilno)
  if (cache.name === 'memory') {
    return syncIncrementForMemoryAdapter(cache, key, config)
  }

  // RedisCacheAdapter: sync path ne more await-ati → FAIL-CLOSED
  // Prej je bilo FAIL-OPEN (allowed: true) — to je bila varostna napaka #39
  console.error('[rate-limit] 🔴 FAIL-CLOSED: sync checkRateLimit() called with Redis adapter — rejecting. Use checkRateLimitAsync() instead.')
  return { allowed: false, retryAfterMs: config.windowMs, remaining: 0 }
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
