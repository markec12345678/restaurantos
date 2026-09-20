// qr-pay-token.ts — R81: stateless HMAC binding za QR pay seje
//                     R82-D: token lifecycle — TTL, used/revoked semantika
//
// PROBLEM (R81-E2, LEAK-HIGH): sessionToken je bil random 32B hex, ki se NI
// nikjer shranil in NIKOLI preveril — GET /api/qr-pay je vrnil PRVI neporavnan
// ček GLOBALNO (vsi tenanti), confirm pa je dovolil plačilo katerega koli čeka
// po ID-ju (token ignoriran).
//
// REŠITEV (brez sheme/Redis-a): token = HMAC-SHA256(secret, checkId) —
// stateless vezava ček↔token. Lastništvo tokena = avtorizacija:
//   - GET /api/qr-pay?token=X → poišče med neporavnanimi čeki TISTEGA, čigar
//     HMAC se ujema (tuji token → 404, brez enumeracije)
//   - POST /api/qr-pay/confirm → token MORA biti veljaven HMAC za podani checkId
// Token se izda SAMO prek avtenticiranega init POST (staff, lokacijski scope).
//
// R82-D (lifecycle — session / TTL / used / revoked):
//   - SESSION:  token v2 = `v2:<issuedAtMs>:<hmac>`; hmac = HMAC(secret,
//     `qr-pay:v2:${checkId}:${issuedAtMs}`) — vezava na ček + čas izdaje.
//   - TTL:      izdaniAt STAREJŠI od QR_PAY_TOKEN_TTL_MS (15 min) → token
//     neveljaven (verify vrne false → GET 404 / confirm 403). Izdaja v prihodnje
//     (skew > 5 min) prav zavrnjena. Init odgovor vrača expiresAt iz ISTEGA
//     konstantnega vira (brez razhajanja client/server pričakovanj).
//   - USED:     enkratna uporaba = plačilo — confirm nastavi check.paymentStatus
//     = 'paid'; GET skenira samo unpaid/partial, confirm zavrne paid (400).
//     Porabljen token ne more plačati dvakrat.
//   - REVOKED:  ponovni init izda NOV token (nov issuedAt); prejšnji tokeni
//     ostanejo HMAC-veljavni do TTL izteka (stateless kompromis — brez
//     shrambe ni takojšnje revokacije; okno je omejeno na 15 min). Strožja
//     revokacija = shranjene seje (DB/Redis) v prihodnji rundi.
//
// R82-D (PRODUCTION SECRET): hard-code dev fallback je ODSTRANJEN — v
// produkcijskem okolju (NODE_ENV=production) brez QR_PAY_SECRET /
// ENCRYPTION_KEY / NEXTAUTH_SECRET token helperja NE ustvarita tokena
// (init → 503), namesto da bi tiho uporabila javno znan dev secret
// (vsak, ki pozna repo, bi lahko koval veljavne tokene za TUJE čeke).
import crypto from 'crypto'

/** TTL QR pay tokena (15 minut — usklajen z init.expiresAt). */
export const QR_PAY_TOKEN_TTL_MS = 15 * 60 * 1000

/** Dovoljen clock skew za issuedAt v prihodnje (5 min). */
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000

const TOKEN_PREFIX = 'v2'

function resolveQrPaySecret(): string | null {
  return (
    process.env.QR_PAY_SECRET ||
    process.env.ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    null
  )
}

/**
 * FIX R82-D: je HMAC secret nastavljen (ali je okolje dev/test, kjer je
 * fallback še dovoljen)? Init route vrne 503, če ni — nikoli ne izda tokena
 * z javno znanim dev secretom v produkciiji.
 */
export function isQrPaySecretConfigured(): boolean {
  if (resolveQrPaySecret()) return true
  return process.env.NODE_ENV !== 'production'
}

function qrPaySecret(): string {
  const secret = resolveQrPaySecret()
  if (secret) return secret
  if (process.env.NODE_ENV !== 'production') {
    // SAMO dev/test — produkciija fail-closed (glej isQrPaySecretConfigured).
    return 'restaurantos-qr-pay-dev-secret-DO-NOT-USE-IN-PROD'
  }
  throw new Error('QR_PAY_SECRET ni nastavljen (produkcija zahteva QR_PAY_SECRET / ENCRYPTION_KEY / NEXTAUTH_SECRET)')
}

/**
 * R81: izvede HMAC vezan na checkId.
 * R82-D: format v2 — `v2:<issuedAtMs>:<hmac64>` (HMAC vključuje issuedAt →
 * stateless TTL). Legacy 64-hex tokeni (R81, brez TTL) so NEVELJAVNI.
 */
export function qrPayTokenFor(checkId: string, issuedAtMs: number = Date.now()): string {
  const mac = crypto
    .createHmac('sha256', qrPaySecret())
    .update(`qr-pay:${TOKEN_PREFIX}:${checkId}:${issuedAtMs}`)
    .digest('hex')
  return `${TOKEN_PREFIX}:${issuedAtMs}:${mac}`
}

/**
 * R82-D: timing-safe preverjanje tokena za checkId z lifecycle pravili:
 *  - format v2 (`v2:<ms>:<64 hex>`)
 *  - HMAC match (timing-safe)
 *  - TTL: issuedAt + QR_PAY_TOKEN_TTL_MS >= now
 *  - issuedAt ni v prihodnje več kot MAX_FUTURE_SKEW_MS
 */
export function verifyQrPayToken(token: string, checkId: string, nowMs: number = Date.now()): boolean {
  if (typeof token !== 'string') return false
  const parts = token.split(':')
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return false
  const issuedAtMs = Number(parts[1])
  if (!Number.isFinite(issuedAtMs) || issuedAtMs < 0) return false
  const mac = parts[2]
  if (!/^[a-f0-9]{64}$/.test(mac)) return false

  // TTL + future skew (PRED HMAC — cenejše zavrnitve, brez razkritja).
  // Token velja do issuedAt+TTL IZKLJUČNO: now >= issuedAt+TTL = potekel.
  if (issuedAtMs > nowMs + MAX_FUTURE_SKEW_MS) return false
  if (nowMs - issuedAtMs >= QR_PAY_TOKEN_TTL_MS) return false

  try {
    const expected = crypto
      .createHmac('sha256', qrPaySecret())
      .update(`qr-pay:${TOKEN_PREFIX}:${checkId}:${issuedAtMs}`)
      .digest('hex')
    const a = Buffer.from(mac, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    // Produkcija brez secret-a → fail-closed (nikoli true)
    return false
  }
}
