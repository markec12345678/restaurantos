// qr-pay-token.ts — R81: stateless HMAC binding za QR pay seje
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
// R82 upgrade (opomba): shranjene seje z TTL (Redis/DB) za kratko življenjsko
// dobo tokena — HMAC vezava je trajna, a token je izpisan samo na QR sliki čeka.
import crypto from 'crypto'

function qrPaySecret(): string {
  return (
    process.env.QR_PAY_SECRET ||
    process.env.ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    'restaurantos-qr-pay-dev-secret-DO-NOT-USE-IN-PROD'
  )
}

/** Izvede HMAC vezan na checkId (64 hex znakov). */
export function qrPayTokenFor(checkId: string): string {
  return crypto.createHmac('sha256', qrPaySecret()).update(`qr-pay:${checkId}`).digest('hex')
}

/** Timing-safe preverjanje tokena za checkId. */
export function verifyQrPayToken(token: string, checkId: string): boolean {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return false
  const expected = qrPayTokenFor(checkId)
  const a = Buffer.from(token, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
