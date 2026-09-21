// ordering-token.ts — R88: stateless HMAC vezave za javne naročilne poti
//
// PROBLEM (R87 worklog, zadnja pisna odprtina):
//   1. POST /api/public/online-order sprejme body.locationId katere koli AKTIVNE
//      lokacije KATEREGA KOLI tenanta ("BY-DESIGN ena domena, več restavric")
//      = anonimen klicatelj lahko žiga naročila, order counterje, zaloge in
//      KDS broadcast TUJE lokacije (brez identitete, brez vezave).
//   2. Delivery webhooki (wolt/glovo/bolt) poznajo SAMO globalni
//      integration.findFirst({ provider, isActive }) — brez tenant atribucije
//      (prva integracija poljubnega tenanta) + žig na globalno
//      resolveDefaultLocationId() (prva aktivna lokacija poljubnega tenanta).
//
// REŠITEV (R81 qr-pay-token vzorec — brez sheme/Redis-a): token = HMAC-SHA256
// nad domena-specific kontekstom, timing-safe preverjanje, unificirana 404
// (notInScopeResponse) brez obstoja-oraklja. Lastništvo tokena = avtorizacija:
//
//   1. PUBLIC ORDERING: token = `v1:<hmac64>`,
//      hmac = HMAC(secret, `online-order:v1:${locationId}`) — veže naročilo na
//      TOČNO ENO lokacijo. Izda: GET /api/locations/[id]/ordering-token
//      (avtenticirano + scope). Poraba: POST online-order (body.orderingToken).
//      Restaurant objavi ordering URL (`/order?loc=<id>&t=<token>`) na svoji
//      spletni strani / v biografiji / na plakatu — kot deep link.
//
//   2. WEBHOOK ENVELOPE: `?t=<integrationId>:<hmac64>`,
//      hmac = HMAC(secret, `delivery-webhook:v1:${integrationId}`) — atribucija
//      integracije (tenanta) ŠE PRED signature checkom (brez DB oraklja:
//      napačen/tuj/manjkajoč envelope → vedno isti unified 404).
//
// LIFECYCLE (razlika do qr-pay): qr-pay tokeni so kratkožive seje (15 min TTL).
// Ti tokeni so DOLGOTRAJNE lokacijske/integracijske poverilnice (natisnjene na
// plakat, konfigurirane v Wolt portalu) — ZATO BREZ TTL-ja. Revokacija =
// rotacija skrivnosti (ORDERING_TOKEN_SECRET) — rotira VSE tokene hkrati
// (dokumentiran stateless kompromis; per-token revokacija zahteva shrambo —
// prihodnja runda, enako opomba kot R82-D pri qr-pay).
//
// PRODUCTION SECRET (R82-D kanon): hard-code dev fallback je dovoljen SAMO
// izven produkcije. V produkciji brez ORDERING_TOKEN_SECRET / QR_PAY_SECRET /
// ENCRYPTION_KEY / NEXTAUTH_SECRET `isOrderingSecretConfigured()` vrne false —
// izdajne rute vrnejo 503, javne pisne poti pa 503/fail-closed (nikoli token
// z javno znanim dev secretom).
import crypto from 'crypto'

const TOKEN_PREFIX = 'v1'
const ORDERING_DOMAIN = 'online-order'
const WEBHOOK_DOMAIN = 'delivery-webhook'

/** Dovoljena oblika integrationId v envelope (prisma cuid/cuid2/uuid-like).
 *  Min 5 = usklajeno z LOCATION_ID_RE (R86-3 kiosk kanon); varnost NOSI HMAC,
 *  regex je samo vhodna sanitacija — krajši/dolžji id ne vpliva na kovanje. */
const INTEGRATION_ID_RE = /^[a-zA-Z0-9_-]{5,64}$/
/** Dovoljena oblika locationId (prisma cuid — isti razred kot kiosk/online-order regex). */
const LOCATION_ID_RE = /^[a-zA-Z0-9_-]{5,50}$/

function resolveOrderingSecret(): string | null {
  return (
    process.env.ORDERING_TOKEN_SECRET ||
    process.env.QR_PAY_SECRET ||
    process.env.ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    null
  )
}

/**
 * FIX R88 (R82-D kanon): je HMAC secret nastavljen (ali je okolje dev/test,
 * kjer je fallback še dovoljen)? Izdajne rute vrnejo 503, javne pisne poti
 * fail-closed, če ni — nikoli ne izdajaj/verificiraj z javno znanim dev secretom.
 */
export function isOrderingSecretConfigured(): boolean {
  if (resolveOrderingSecret()) return true
  return process.env.NODE_ENV !== 'production'
}

function orderingSecret(): string {
  const secret = resolveOrderingSecret()
  if (secret) return secret
  if (process.env.NODE_ENV !== 'production') {
    // SAMO dev/test — produkcija fail-closed (glej isOrderingSecretConfigured).
    return 'restaurantos-ordering-token-dev-secret-DO-NOT-USE-IN-PROD'
  }
  throw new Error(
    'ORDERING_TOKEN_SECRET ni nastavljen (produkcija zahteva ORDERING_TOKEN_SECRET / QR_PAY_SECRET / ENCRYPTION_KEY / NEXTAUTH_SECRET)',
  )
}

function hmacHex(context: string): string {
  return crypto.createHmac('sha256', orderingSecret()).update(context).digest('hex')
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

// =====================================================================
// 1. PUBLIC ORDERING TOKEN (POST /api/public/online-order)
// =====================================================================

/**
 * R88: token, vezan na locationId — format `v1:<hmac64>`.
 * DOLGOTRAJNA poverilnica (BREZ TTL — natisnjena na plakat/deep link).
 * Revokacija samo prek rotacije skrivnosti (glej header komentar).
 */
export function orderingTokenFor(locationId: string): string {
  return `${TOKEN_PREFIX}:${hmacHex(`${ORDERING_DOMAIN}:${TOKEN_PREFIX}:${locationId}`)}`
}

/**
 * R88: timing-safe preverjanje ordering tokena za locationId.
 * Fail-closed: napačen format / napačen HMAC / produkcija brez secret → false.
 */
export function verifyOrderingToken(token: string, locationId: string): boolean {
  if (typeof token !== 'string' || !locationId) return false
  if (!LOCATION_ID_RE.test(locationId)) return false
  const parts = token.split(':')
  if (parts.length !== 2 || parts[0] !== TOKEN_PREFIX) return false
  if (!/^[a-f0-9]{64}$/.test(parts[1])) return false
  try {
    const expected = hmacHex(`${ORDERING_DOMAIN}:${TOKEN_PREFIX}:${locationId}`)
    return timingSafeEqualHex(parts[1], expected)
  } catch {
    // Produkcija brez secret-a → fail-closed (nikoli true)
    return false
  }
}

// =====================================================================
// 2. DELIVERY WEBHOOK ENVELOPE (wolt/glovo/bolt ?t= parameter)
// =====================================================================

/**
 * R88: webhook envelope za integracijo — format `<integrationId>:<hmac64>`.
 * Konfigurira se v dostavni platformi (Wolt/Glovo/Bolt portal) kot del URL-ja.
 */
export function webhookEnvelopeTokenFor(integrationId: string): string {
  return `${integrationId}:${hmacHex(`${WEBHOOK_DOMAIN}:${TOKEN_PREFIX}:${integrationId}`)}`
}

/**
 * R88: parsaj + timing-safe verificiraj webhook envelope.
 * Vrne verificiran integrationId (SAMO ta id sme iti v DB lookup — nikoli
 * raw input) ali { ok: false }. Brez oraklja: vsaka napaka = isti false.
 */
export function parseWebhookEnvelope(
  envelope: string | null | undefined,
): { ok: true; integrationId: string } | { ok: false } {
  if (typeof envelope !== 'string') return { ok: false }
  const sep = envelope.lastIndexOf(':')
  if (sep <= 0) return { ok: false }
  const integrationId = envelope.slice(0, sep)
  const mac = envelope.slice(sep + 1)
  if (!INTEGRATION_ID_RE.test(integrationId)) return { ok: false }
  if (!/^[a-f0-9]{64}$/.test(mac)) return { ok: false }
  try {
    const expected = hmacHex(`${WEBHOOK_DOMAIN}:${TOKEN_PREFIX}:${integrationId}`)
    if (!timingSafeEqualHex(mac, expected)) return { ok: false }
    return { ok: true, integrationId }
  } catch {
    return { ok: false }
  }
}
