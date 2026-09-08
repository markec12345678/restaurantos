// ============================================
// SESSION TOKEN HASHING
// ============================================
// FIX SECURITY: Session tokeni se v bazi shranjujojo IZKLJUČNO kot
// SHA-256 hash — plain token ni nikjer persistiran.
//
// Grožnja (zakaj): če napadalec pridobi dump baze (SQL injection,
// ukraden backup, exfiltracija prek prisma studio/read-only repliko),
// bi z plain-text tokeni lahko impersoniral vsako aktivno sejo
// (Bearer avtentikacija). S hashem je dump neuporaben — token
// obstaja samo v Authorization headerju in klientovem pomnilniku.
//
// Zasnova:
//  - DB Session.token    = sha256(token)  (64 hex — isti format kot prej)
//  - sessions Map (mem)  = ključ sha256(token) — konsistentno z DB
//  - WS store            = ključ PLAINTEXT (samo runtime sinhronizacija
//    prek syncSessionToWs z živim tokenom; WS ne bere DB)
//  - klient dobi plain token (Bearer) — nespremenjeno
//
// Enosmerna kompatibilnost: seje, ustvarjene pred tem popravkom
// (plain-text v DB), po deployu prenehajo veljati — vsi uporabniki
// se enkrat ponovno prijavijo (standardna praksa pri rotaciji
// formata tokenov). Stare vrstice počisti retention cron.
// ============================================

import crypto from 'crypto'

/**
 * Izračunaj SHA-256 hash session tokena (hex, 64 znakov).
 * Uporablja se kot ključ v DB in pomnilniškem cache-u.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex')
}
