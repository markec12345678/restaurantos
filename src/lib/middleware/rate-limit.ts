// ============================================
// IN-MEMORY RATE LIMITER ZA MIDDLEWARE
// Enostavna implementacija za Edge Runtime
// (Ne uporablja Node.js setInterval — Edge kompatibilna)
// ============================================

import type { NextRequest } from 'next/server'

export interface RateEntry {
  count: number
  resetAt: number
}

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

const rateLimitStore = new Map<string, RateEntry>()
const MAX_ENTRIES = 5000

// Čiščenje poteklih vnosov — klicano ob vsakem zahtevku
function cleanExpired() {
  const now = Date.now()
  if (rateLimitStore.size > MAX_ENTRIES) {
    // Evict expired + oldest entries
    for (const [key, entry] of rateLimitStore) {
      if (entry.resetAt <= now) {
        rateLimitStore.delete(key)
      }
    }
    // Če je še vedno preveč, odstrani najstarejše
    if (rateLimitStore.size > MAX_ENTRIES * 0.8) {
      const keysToDelete: string[] = []
      let count = 0
      for (const [key] of rateLimitStore) {
        keysToDelete.push(key)
        count++
        if (count >= rateLimitStore.size * 0.3) break
      }
      keysToDelete.forEach(k => rateLimitStore.delete(k))
    }
  }
}

// Konfiguracije omejitev po vzorcu poti
// VRSTNI RED JE POMEMBEN — prvo ujemanje zmaga, specifične rute morajo biti PRED splošnimi
export const API_RATE_LIMITS: { pattern: RegExp; config: RateLimitConfig; name: string }[] = [
  // ═══════════════════════════════════════════
  // JAVNI ENDPOINTI — strožje omejitve (brez avtentikacije)
  // ═══════════════════════════════════════════
  { pattern: /\/api\/auth$/, config: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, name: 'auth-login' },
  { pattern: /\/api\/public\/order$/, config: { maxRequests: 5, windowMs: 60 * 1000 }, name: 'public-order' },
  { pattern: /\/api\/public\/online-order/, config: { maxRequests: 5, windowMs: 2 * 60 * 1000 }, name: 'online-order' },
  { pattern: /\/api\/public\/call-waiter/, config: { maxRequests: 3, windowMs: 60 * 1000 }, name: 'call-waiter' },
  { pattern: /\/api\/public\/promo-check/, config: { maxRequests: 10, windowMs: 60 * 1000 }, name: 'promo-check' },
  { pattern: /\/api\/public\/order-track/, config: { maxRequests: 20, windowMs: 60 * 1000 }, name: 'order-track' },
  { pattern: /\/api\/public\/delivery-check/, config: { maxRequests: 10, windowMs: 60 * 1000 }, name: 'delivery-check' },
  { pattern: /\/api\/public\/verify-table/, config: { maxRequests: 15, windowMs: 60 * 1000 }, name: 'verify-table' },
  { pattern: /\/api\/public\/order-config/, config: { maxRequests: 20, windowMs: 60 * 1000 }, name: 'order-config' },
  { pattern: /\/api\/public\/menu/, config: { maxRequests: 30, windowMs: 60 * 1000 }, name: 'public-menu' },
  { pattern: /\/api\/public\//, config: { maxRequests: 20, windowMs: 60 * 1000 }, name: 'public-general' },
  { pattern: /\/api\/feedback-public/, config: { maxRequests: 5, windowMs: 60 * 1000 }, name: 'feedback-public' },
  { pattern: /\/api\/qr-menu/, config: { maxRequests: 30, windowMs: 60 * 1000 }, name: 'qr-menu' },
  { pattern: /\/api\/digital-receipt/, config: { maxRequests: 20, windowMs: 60 * 1000 }, name: 'digital-receipt' },

  // ═══════════════════════════════════════════
  // WEBHOOK ENDPOINTI — zunanje platforme (Glovo, Wolt, Bolt)
  // ═══════════════════════════════════════════
  { pattern: /\/api\/delivery\/webhook/, config: { maxRequests: 30, windowMs: 60 * 1000 }, name: 'delivery-webhook' },
  { pattern: /\/api\/webhooks\//, config: { maxRequests: 30, windowMs: 60 * 1000 }, name: 'webhooks' },

  // ═══════════════════════════════════════════
  // AI ENDPOINTI — dražji klici (Gemini API)
  // ═══════════════════════════════════════════
  { pattern: /\/api\/ai-assistant/, config: { maxRequests: 10, windowMs: 60 * 1000 }, name: 'ai-assistant' },
  { pattern: /\/api\/ai\//, config: { maxRequests: 15, windowMs: 60 * 1000 }, name: 'ai' },

  // ═══════════════════════════════════════════
  // DESTRUKTIVNI ENDPOINTI — zelo omejeni
  // ═══════════════════════════════════════════
  { pattern: /\/api\/orders\/seed/, config: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, name: 'seed' },
  { pattern: /\/api\/seed/, config: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, name: 'seed-general' },

  // ═══════════════════════════════════════════
  // WEBSOCKET BROADCAST — interno, a omejimo zlorabo
  // ═══════════════════════════════════════════
  { pattern: /\/api\/ws-broadcast/, config: { maxRequests: 30, windowMs: 60 * 1000 }, name: 'ws-broadcast' },

  // ═══════════════════════════════════════════
  // SPLOŠNI AVTENTICIRANI API — 60/min (catch-all)
  // ═══════════════════════════════════════════
  { pattern: /\/api\//, config: { maxRequests: 60, windowMs: 60 * 1000 }, name: 'api-general' },
]

export function checkMiddlewareRateLimit(storeKey: string, clientIp: string, config: RateLimitConfig): { allowed: boolean; retryAfterMs?: number; remaining?: number } {
  const key = `${storeKey}:${clientIp}`
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (entry && entry.resetAt <= now) {
    rateLimitStore.delete(key)
  }

  const current = rateLimitStore.get(key)

  if (!current) {
    if (rateLimitStore.size >= MAX_ENTRIES) {
      cleanExpired()
    }
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, remaining: config.maxRequests - 1 }
  }

  if (current.count >= config.maxRequests) {
    return { allowed: false, retryAfterMs: current.resetAt - now, remaining: 0 }
  }

  current.count++
  return { allowed: true, remaining: config.maxRequests - current.count }
}

export function getMiddlewareClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0)
    const lastIp = ips[ips.length - 1] || ''
    if (lastIp && lastIp.length <= 45 && /^[\d.:a-fA-F]+$/.test(lastIp)) {
      return lastIp
    }
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp && realIp.length <= 45 && /^[\d.:a-fA-F]+$/.test(realIp)) {
    return realIp
  }
  return 'unknown'
}
