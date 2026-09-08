// ============================================
// SERVER-WS-CORE — WebSocket varnostna jedra (CJS, testabilna)
// ============================================
// Izvleček logike iz server.js, da je lahko enotsko testirana (vitest).
// Vsa INBOUND klient→server sporočila gredo SKOZI parseInboundMessage().
//
// VARNOSTNI MODEL (WS audit 2026-09-09):
//   1. Token se NE sme posiljati v URL-ju (logi/proxy/referrer) — samo AUTH sporočilo.
//   2. Klient NE more broadcastati dogodkov drugim klientom (prej:
//      ALLOWED_BROADCAST_TYPES je dovoljeval client → ORDER_CANCELLED → broadcast).
//      Dogodke zdaj izključno generira SERVER (API pot: auth → Zod → DB → broadcast).
//   3. Vsako inbound sporočilo je Zod-validirano (tip, oblika, dolžine).
//   4. SUBSCRIBE_OUTBOX (finančni/outbox podatki) je rezerviran za manager+.
//   5. Outbound broadcast nosi (kjer izvedljivo) locationId → per-location dostava.
// ============================================

const { z } = require('zod')

// --- Dovoljene vloge za outbox naročnino (finančni/pogojni podatki) ---
const OUTBOX_ALLOWED_ROLES = ['admin', 'super_admin', 'manager']

// Maksimalna velikost enega inbound WS sporočila (klient pošilja samo majhne
// kontrole: AUTH/IDENTIFY/SUBSCRIBE/ping — 16KB je izdatno)
const MAX_INBOUND_MESSAGE_BYTES = 16 * 1024

// Token format: 32 bajtov = 64 hex znakov (crypto.randomBytes(32).toString('hex'))
const TOKEN_PATTERN = /^[a-f0-9]{64}$/

// --- Zod sheme za INBOUND sporočila (edina dovoljena klient→server oblika) ---
const authMessageSchema = z
  .object({
    type: z.literal('AUTH'),
    payload: z
      .object({
        token: z.string().regex(TOKEN_PATTERN, 'Žeton mora biti 64 hex znakov'),
      })
      .strict(),
  })
  .strict()

const identifyMessageSchema = z
  .object({
    type: z.literal('IDENTIFY'),
    payload: z
      .object({
        clientType: z.string().min(1).max(40),
        clientName: z.string().max(100).default(''),
      })
      .strict(),
  })
  .strict()

const subscribeOutboxMessageSchema = z
  .object({
    type: z.literal('SUBSCRIBE_OUTBOX'),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

const unsubscribeOutboxMessageSchema = z
  .object({
    type: z.literal('UNSUBSCRIBE_OUTBOX'),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

const pingMessageSchema = z
  .object({
    type: z.literal('ping'),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

const inboundMessageSchema = z.union([
  authMessageSchema,
  identifyMessageSchema,
  subscribeOutboxMessageSchema,
  unsubscribeOutboxMessageSchema,
  pingMessageSchema,
])

// --- Outbound envelope (dogodki, ki jih generira IZKLJUČNO server) ---
const outboundEventSchema = z.object({
  type: z.string().min(1).max(64),
  payload: z.union([z.record(z.string(), z.unknown()), z.null()]).optional(),
})

/**
 * Preveri URL handshake zaženo: ali klient poskuša avtenticirati s tokenom v URL-ju?
 * To je PREPOVEDANO (token bi bil viden v dostopnih logih, proxy logih, referrerjih).
 * @param {string} url - req.url iz handshake zaščitka
 * @returns {{ tokenInUrl: boolean }}
 */
function detectTokenInHandshakeUrl(url) {
  if (!url || typeof url !== 'string') return { tokenInUrl: false }
  try {
    const u = new URL(url, 'http://localhost')
    return { tokenInUrl: u.searchParams.has('token') }
  } catch {
    return { tokenInUrl: /\?|&/.test(url) && /[?&]token=/.test(url) }
  }
}

/**
 * Zod-validiraj inbound WS sporočilo (raw string iz klienta).
 * @param {string|Buffer} raw
 * @returns {{ ok: true, message: { type: string, payload?: unknown } } |
 *           { ok: false, reason: string }}
 */
function parseInboundMessage(raw) {
  if (raw == null) return { ok: false, reason: 'Prazno sporočilo' }

  const rawStr = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8')
  if (rawStr.length > MAX_INBOUND_MESSAGE_BYTES) {
    return { ok: false, reason: 'Sporočilo presega 16KB' }
  }

  let parsed
  try {
    parsed = JSON.parse(rawStr)
  } catch {
    return { ok: false, reason: 'Neveljaven JSON' }
  }

  const result = inboundMessageSchema.safeParse(parsed)
  if (!result.success) {
    return { ok: false, reason: 'Nedovoljena oblika sporočila' }
  }

  // odstrani payload če je prazen objekt (normalizacija)
  const message = result.data
  if (message.payload && typeof message.payload === 'object' && Object.keys(message.payload).length === 0) {
    const { payload, ...rest } = message
    void payload
    return { ok: true, message: rest }
  }
  return { ok: true, message }
}

/**
 * Ali sme vloga dostopati do outbox naročnine?
 * @param {string|undefined|null} role
 * @returns {boolean}
 */
function isOutboxRoleAllowed(role) {
  return OUTBOX_ALLOWED_ROLES.includes(role || '')
}

/**
 * Validiraj outbound event pred dostavo (envelope).
 * @param {string} type
 * @param {unknown} payload
 * @returns {boolean}
 */
function isValidOutboundEvent(type, payload) {
  return outboundEventSchema.safeParse({ type, payload: payload ?? undefined }).success
}

module.exports = {
  OUTBOX_ALLOWED_ROLES,
  MAX_INBOUND_MESSAGE_BYTES,
  TOKEN_PATTERN,
  inboundMessageSchema,
  detectTokenInHandshakeUrl,
  parseInboundMessage,
  isOutboxRoleAllowed,
  isValidOutboundEvent,
}
