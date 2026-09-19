// ============================================
// PLAČILNE METODE — SLOVENSKA OZNAKA (ENOTEN VIR)
// ============================================
// Runda 62: pred tem so imele 4 površine vsak SVOJ inline map
// (escpos totals, EodPaymentMethods, EodSections, eod-summary-sections),
// digest tiskana stran pa sploh ni mapala → tiskani povzetek je pokazal
// surov enum "cash". Isti lekcija kot tierLabelSi (R61b): čisti,
// strežniško-varen vir brez odvisnosti.
//
// Vrednosti iz prisma schema (Payment.string paymentMethod):
//   cash | card | mobile | voucher | loyalty | giftcard | alternate
// (neznane vrednosti → kapitalizacija prve črke; prazno → "neznano")
// ============================================

const PAYMENT_METHODS_SI: Record<string, string> = {
  cash: 'Gotovina',
  card: 'Kartica',
  mobile: 'Mobilno',
  voucher: 'Bon',
  loyalty: 'Zvestoba',
  giftcard: 'Darilna kartica',
  alternate: 'Drugo',
}

/** "card" → "Card" (fallback za neznane enum vrednosti). */
function capitalizeFirst(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1)
}

/**
 * Slovenska oznaka plačilne metode.
 * Strežniško-varena čista funkcija (escpos, email digest, UI) — brez React/uvozov.
 */
export function paymentMethodLabelSl(method: string | null | undefined): string {
  if (!method) return 'neznano'
  return PAYMENT_METHODS_SI[method] ?? capitalizeFirst(method)
}
