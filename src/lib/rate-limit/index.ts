// ============================================
// RATE LIMITER ZA JAVNE API RUTE
// FIX CRITICAL: Združen modul za omejevanje hitrosti zahtevkov
// Prepreči zlorabo javnih API-jev (QR naročanje, povratne informacije, itd.)
// ============================================

export { checkRateLimit, checkRateLimitAsync, getClientIp } from './core'
export type { RateLimitConfig } from './presets'
export {
  PUBLIC_ORDER_LIMIT,
  ONLINE_ORDER_LIMIT,
  CALL_WAITER_LIMIT,
  PUBLIC_MENU_LIMIT,
  GENERAL_PUBLIC_LIMIT,
  PROMO_CHECK_LIMIT,
  ORDER_TRACK_LIMIT,
  FEEDBACK_PUBLIC_LIMIT,
  DELIVERY_CHECK_LIMIT,
  VERIFY_TABLE_LIMIT,
  ORDER_CONFIG_LIMIT,
  LOGIN_LIMIT,
  KIOSK_LIMIT,
  IOT_LIMIT,
  AI_ASSISTANT_LIMIT,
  AI_UPSELL_LIMIT,
  DELIVERY_WEBHOOK_LIMIT,
  WS_BROADCAST_LIMIT,
  SEED_LIMIT,
  AUTHENTICATED_LIMIT,
  MONITORING_LIMIT,
} from './presets'
