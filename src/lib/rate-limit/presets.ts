// ============================================
// RATE LIMITER — PREDHODNO DEFINIRANE KONFIGURACIJE
// ============================================

export interface RateLimitConfig {
  /** Maksimalno število zahtevkov v oknu */
  maxRequests: number
  /** Veljavnost okna v milisekundah */
  windowMs: number
}

// ---- JAVNE KONFIGURACIJE ----

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

// ---- DODATNE KONFIGURACIJE — Zaščita dragocenih endpointov ----

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
