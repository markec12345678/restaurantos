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

/** QR pay (gost — GET session + confirm) — 10 na minuto (R81: javna plačilna pot) */
export const QR_PAY_LIMIT: RateLimitConfig = {
  maxRequests: 10,
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

/**
 * FIX MEDIUM: Prijava (login) — 5 poskusov na 15 minut, nato zaklep.
 *
 * P1-testiranje (v1.3.1 CI fix): meja je ENV-nastavljiva (LOGIN_RATE_LIMIT_MAX)
 * po vzorcu API_RATE_LIMIT_MAX. Razlog: E2E/CI zbirka (4 datoteke × beforeAll
 * prijava + playwright retriji) naredi 5+ prijav v enem zagonu — 6. prijava
 * bi dobila 429 in sprožila kaskado padcev (MODELA/OBS testi). Produkcija
 * obdrži privzetih 5/15min (brute-force zaščita) — CI dvigne mejo na 30.
 */
export const LOGIN_LIMIT: RateLimitConfig = {
  maxRequests: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
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

/** WebSocket broadcast — WS AUDIT 2026-09-09: preset odstranjen (routa izbrisana) */

/** Seed endpoint — 3 zahtev na uro (zelo destruktiven, samo admin) */
export const SEED_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowMs: 60 * 60 * 1000, // 1 ura
}

/**
 * P0-6 backup/restore (epic #115): GET /api/backup — poln dump je drag
 * (findMany čez ~100 tabel) → 12 na uro pokrije dnevni cron + ročne kopije
 * + DR drill (backup + manifest preverjanja v enem drillskem valu).
 */
export const BACKUP_LIMIT: RateLimitConfig = {
  maxRequests: 12,
  windowMs: 60 * 60 * 1000, // 1 ura
}

/**
 * P0-6 restore — najbolj destruktivna operacija v sistemu (TRUNCATE vseh
 * tabel + insert). 6 na uro: DR drill + izredna obnova, brez brutenja.
 */
export const RESTORE_LIMIT: RateLimitConfig = {
  maxRequests: 6,
  windowMs: 60 * 60 * 1000, // 1 ura
}

/**
 * R128 (epic #115 P0-5): batch sync offline naprav — 60 batchov / min.
 * Vsak batch zajame do 50 operacij (order.create / order.cancel), zato
 * 60/min pokrije reconnect backlog (do 3000 operacij / min / naprava)
 * brez brutenja strežnika ob množičnem reconnectu POS naprav.
 */
export const DEVICE_SYNC_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60 * 1000,
}

/**
 * R83: Setup init — 5 zahtev / 15 min. Setup izvaja bcrypt cost 12 + DDL-like
 * seed operacije na ANONIMEN klic (bootstrap) — brez rate limita je bil CPU
 * DoS vektor + first-caller-wins race. Enkratni setup porabi 1 zahtevo.
 */
export const SETUP_LIMIT: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
}

/**
 * CIS batch retry (runda 30) — 10 batchov / 5 min.
 * Vsak batch = do 25 sekvencnih FINA klicev (SOAP), zato bolj strog kot
 * splošni authenticated limit; GET (badge števec) in POST (retry) delita vedro.
 */
export const CIS_BATCH_RETRY_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 5 * 60 * 1000,
}

/** Splošni avtentificirani API — 120 zahtev na minuto (E2E 2026-09-17: 60 → 120, glej komentar) */
export const AUTHENTICATED_LIMIT: RateLimitConfig = {
  // FIX (E2E 2026-09-17): 60/min je bilo premalo za POS UI, ki ob preklopu modula
  // sproži sveženj prefetch + react-query klicev iz ISTEGA IP (vse tablice v eni
  // lokaciji deli NAT → skupen vedro). Modul Zaloga sam porabi ~6 klicev;
  // hitro preklapljanje med moduli je sprožilo 429 → prazne liste.
  // 120/min ostane varno za brute-force (prijava ima svoje, strožje omejitve).
  maxRequests: 120,
  windowMs: 60 * 1000,
}


/** FIX F6-6: Kiosk self-service — 10 naročil na uro (prepreči spam) */
export const KIOSK_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 60 * 1000, // 1 ura
}

/** IoT senzor readings — 60 na minuto na IP (tipično 1 reading / 5 min per senzor) */
export const IOT_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60 * 1000,
}

/** FIX P5 (audit 2026-09-06): Client error monitoring — 10 poročil na minuto
 * Preprečuje log injection DoS (napadalec spam-a fake error reports da
 * preplavi Vercel logs ali izčrpa Sentry quota). */
export const MONITORING_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000,
}
