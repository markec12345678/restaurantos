// ============================================
// DARILNE KARTICE — SKUPNE KONSTANTE + ČISTI POMOČNIKI
// R144-b (epic #115 #31 Gift cards / credits)
// ============================================
// ENOTEN VIR RESNICE za pragove darilnih kartic — rabi strežnik
// (GET /api/gift-cards/liability) IN UI (R144-c, brez dupliciranja
// pragov po BUG-04 kanonu literarnih map; precedens:
// src/lib/loyalty/lifecycle-constants.ts R143-b).
//
// ZERO-MIGRATION: nič shematskih sprememb — samo konstante + čisti helperji.

/**
 * Okno "poteče kmalu" (dnevi) za liability poročilo: status active IN
 * expiresAt ≤ now + 30 dni. UI (R144-c) uvaža ISTO konstanto.
 */
export const GIFT_CARD_EXPIRING_SOON_DAYS = 30

/**
 * PII/denar kanon (R144-a): polna cardNumber je SPENDABLE SECRET — v audit
 * detailsih in logih NIKOLI ne sme zapustiti strežnika; samo zadnji 4 znaki
 * (last4) za forenziko. (V API odgovorih staff UI cardNumber VIDI v celoti —
 * funkcionalni identifier za checkout lookup ?cardNumber=, po designu.)
 */
export function giftCardLast4(cardNumber: string | null | undefined): string {
  return (cardNumber ?? '').slice(-4)
}
