// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Konstante za digitalni račun
// ═══════════════════════════════════════════════════════════════

/** Oznake načinov plačila */
export const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Gotovina',
  card: 'Kartica',
  mobile: 'Mobilno',
  voucher: 'Bon',
  alternate: 'Drugo',
}

/** Oznake vrst naročila */
export const TYPE_LABELS: Record<string, string> = {
  'dine-in': 'Na mestu',
  takeout: 'Za seboj',
  delivery: 'Dostava',
}

/** Oblikovanje zneska v EUR */
export function fmtEur(n: number): string {
  return `${n.toFixed(2)} EUR`
}
