// ============================================
// RATE LIMITER ZA JAVNE API RUTE
// FIX CRITICAL: Združen modul za omejevanje hitrosti zahtevkov
// Prepreči zlorabo javnih API-jev (QR naročanje, povratne informacije, itd.)
// ============================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

export interface RateLimitConfig {
  /** Maksimalno število zahtevkov v oknu */
  maxRequests: number
  /** Veljavnost okna v milisekundah */
  windowMs: number
}

// Shramba za vsak ključ (IP + route prefix)
const rateLimitStores = new Map<string, Map<string, RateLimitEntry>>()

// FIX HIGH: MAX_ENTRIES cap — prepreči memory exhaustion pod DDoS napadom
// Z milijoni unikatnih IP-jev bi Map zrasel brez meja
const MAX_ENTRIES_PER_STORE = 10000

// Periodično čiščenje poteklih vnosov — prepreči memory leak
setInterval(() => {
  const now = Date.now()
  for (const [storeKey, store] of rateLimitStores) {
    for (const [ip, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(ip)
      }
    }
    // Odstrani prazne shrambe
    if (store.size === 0) {
      rateLimitStores.delete(storeKey)
    }
  }
}, 5 * 60 * 1000) // Vsakih 5 minut

/**
 * Preveri ali je zahtevek dovoljen glede na rate limit
 * @param storeKey - Enolični ključ shrambe (npr. 'public-order', 'call-waiter')
 * @param clientIp - IP naslov odjemalca
 * @param config - Konfiguracija omejitve
 * @returns { allowed: boolean, retryAfterMs?: number, remaining?: number }
 */
export function checkRateLimit(
  storeKey: string,
  clientIp: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfterMs?: number; remaining?: number } {
  let store = rateLimitStores.get(storeKey)
  if (!store) {
    store = new Map()
    rateLimitStores.set(storeKey, store)
  }

  const now = Date.now()
  const entry = store.get(clientIp)

  // Počisti potekel vnos
  if (entry && entry.resetAt <= now) {
    store.delete(clientIp)
  }

  const current = store.get(clientIp)

  if (!current) {
    // Prvi zahtevek v oknu
    // FIX HIGH: Preveri MAX_ENTRIES cap — prepreči neomejeno rast pod DDoS
    if (store.size >= MAX_ENTRIES_PER_STORE) {
      // Evict najstarejši vnos (prvi v Map-u je najstarejši po insert order)
      const firstKey = store.keys().next().value
      if (firstKey) store.delete(firstKey)
    }
    store.set(clientIp, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, remaining: config.maxRequests - 1 }
  }

  if (current.count >= config.maxRequests) {
    // Rate limited
    const retryAfterMs = current.resetAt - now
    return { allowed: false, retryAfterMs, remaining: 0 }
  }

  // Dovoljen — povečaj števec
  current.count++
  return { allowed: true, remaining: config.maxRequests - current.count }
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
    // FIX: Vzemimo zadnji IP v verigi — tega doda zaupani reverse proxy (Nginx/Cloudflare)
    // Prvi IP je od odjemalca in je lažno ponarejen
    const ips = forwarded.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0)
    // Zadnji IP je od najbolj notranjega proxyja — najbolj zanesljiv
    const lastIp = ips[ips.length - 1] || ''
    // Omejimo dolžino in preverimo osnovni format (prepreči injection)
    if (lastIp && lastIp.length <= 45 && /^[\d.:a-fA-F]+$/.test(lastIp)) {
      return lastIp
    }
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp && realIp.length <= 45 && /^[\d.:a-fA-F]+$/.test(realIp)) {
    return realIp
  }
  // FIX: Ne uporabimo 'unknown' — vsi brez IP delijo isti bucket
  // Namesto tega uporabimo hash user-agentja za ločevanje
  const ua = req.headers.get('user-agent') || ''
  const uaHash = Buffer.from(ua).toString('base64').substring(0, 16)
  return `fallback-${uaHash}`
}

// ============================================
// PREDHODNO DEFINIRANE KONFIGURACIJE
// ============================================

/** Javna naročila (QR) — 5 naročil na minuto */
export const PUBLIC_ORDER_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 60 * 1000,
}

/** Online naročila — 5 naročil na 2 minuti */
export const ONLINE_ORDER_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 2 * 60 * 1000,
}

/** Klic natakarja — 3 klici na minuto */
export const CALL_WAITER_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowMs: 60 * 1000,
}

/** Javni meni (GET) — 30 zahtev na minuto */
export const PUBLIC_MENU_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60 * 1000,
}

/** Splošni javni API — 20 zahtev na minuto */
export const GENERAL_PUBLIC_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowMs: 60 * 1000,
}

/** Preverjanje promocijske kode — 10 na minuto */
export const PROMO_CHECK_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000,
}

/** Sledenje naročila — 20 na minuto */
export const ORDER_TRACK_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowMs: 60 * 1000,
}

/** Javne povratne informacije — 5 na minuto */
export const FEEDBACK_PUBLIC_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 60 * 1000,
}

/** Preverjanje dostave — 10 na minuto */
export const DELIVERY_CHECK_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000,
}

/** Verifikacija mize — 15 na minuto */
export const VERIFY_TABLE_LIMIT: RateLimitConfig = {
  maxRequests: 15,
  windowMs: 60 * 1000,
}

/** Konfiguracija naročanja — 20 na minuto */
export const ORDER_CONFIG_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowMs: 60 * 1000,
}

/** FIX MEDIUM: Prijava (login) — 5 poskusov na 15 minut, nato zaklep */
export const LOGIN_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 15 minut
}

// ============================================
// DODATNE KONFIGURACIJE — Zaščita dragocenih endpointov
// ============================================

/** AI asistent — 10 zahtev na minuto (Gemini API stane denar) */
export const AI_ASSISTANT_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000,
}

/** AI upsell — 15 zahtev na minuto (manj težek, ampak še vedno AI klic) */
export const AI_UPSELL_LIMIT: RateLimitConfig = {
  maxRequests: 15,
  windowMs: 60 * 1000,
}

/** Webhook dostave (Glovo/Wolt) — 30 zahtev na minuto (zunanje platforme) */
export const DELIVERY_WEBHOOK_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60 * 1000,
}

/** WebSocket broadcast — 30 zahtev na minuto (interno, a omejimo zlorabo) */
export const WS_BROADCAST_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60 * 1000,
}

/** Seed endpoint — 3 zahtev na uro (zelo destruktiven, samo admin) */
export const SEED_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowMs: 60 * 60 * 1000, // 1 ura
}

/** Splošni avtentificirani API — 60 zahtev na minuto */
export const AUTHENTICATED_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60 * 1000,
}
