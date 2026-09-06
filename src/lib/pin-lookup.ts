// ============================================
// PIN LOOKUP — HMAC-SHA256 za O(1) iskanje PIN-a pri prijavi
// ============================================
// Problem: PIN-i so bcrypt-hashirani (varno), a bcrypt ne omogoča iskanja.
// verifyPin() je prej delal findMany + N x bcrypt.compare — O(n) na vseh
// aktivnih zaposlenih. Pri 50+ zaposlenih je to občutno.
//
// Rešitev: poleg bcrypt-hasha shranimo še pinLookup = HMAC-SHA256(secret, pin).
// - HMAC (ne plain SHA-256) prepreči rainbow table napade na kratke 4-mestne PIN-e
// - secret je NEXTAUTH_SECRET (strežniška skrivnost) — napadalec z dostopom do
//   baze ne more obrniti pinLookup brez secret-a
// - pinLookup je @unique → findUnique O(1)
// - bcrypt-hash ostaja za timing-safe primerjavo (obvezna po principu "defense in depth")
//
// FIX: SECRET se bere ob klicu (ne ob module load) — preprečuje težave z
// Next.js standalone build kjer so env vars lahko "baked in" ob build time.
// ============================================

import crypto from 'crypto'

/**
 * Pridobi NEXTAUTH_SECRET ob klicu (ne ob module load).
 *
 * FIX: Prej je bil `const SECRET = process.env.NEXTAUTH_SECRET || ''` ki se
 * evaluiral ob module load time. V Next.js standalone build so env vars
 * lahko "baked in" ob build time — če NEXTAUTH_SECRET ni bil nastavljen
 * med buildom, je bil SECRET prazen tudi ob runtime.
 *
 * Sedaj: bere process.env ob vsakem klicu — deluje pravilno ne glede na
 * kdaj je bil modul naložen.
 */
function getSecret(): string {
  return process.env.NEXTAUTH_SECRET || ''
}

/**
 * Izračuna pinLookup vrednost iz plaintext PIN-a.
 * Uporablja HMAC-SHA256 z NEXTAUTH_SECRET.
 *
 * Če NEXTAUTH_SECRET ni nastavljen, vrne prazen string (pinLookup se ne zapiše
 * in verifyPin fallback-a na findMany pristop — backward compatible).
 */
export function hashPinLookup(pin: string): string {
  const secret = getSecret()
  if (!secret) return ''
  if (!pin) return ''
  return crypto.createHmac('sha256', secret).update(pin).digest('hex')
}

/**
 * Ali je pinLookup funkcionalnost na voljo (NEXTAUTH_SECRET nastavljen)?
 * Uporablja se za odločitev med O(1) findUnique in O(n) findMany fallback.
 */
export const pinLookupEnabled = (): boolean => !!getSecret()
