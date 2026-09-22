// ============================================
// DELJENO PLAČILO — MATEMATIKA RAZDELITVE
// Runda 49 — izvlečeno iz usePaymentHandlers/split-payment.ts, da UI preview
// in executor delita IZHODIŠČE (prej je UI računal splitAmount s tipom,
// executor pa delil orderTotal brez tipa — dve različni virteni mantissi).
//
// Kontrakt (identičen prejšnjemu obnašanju executorja — NIKOLI ne spremeni
// razdelitve brez sinhronizacije z idempotencyKey vzorcem `split-{check}-s{i}-{amount}`):
//   • osnovni del = floor((total / count) × 100) / 100  (centna natančnost, navzdol)
//   • zadnji del absorbira razliko zaokroževanja (round × 100 / 100)
//   • vsota delov = TOČNO total (centno natančno)
// ============================================

/**
 * Razdeli znesek na `count` delov po istem algoritmu kot executor deljenega
 * plačila. Zadnji del absorbira zaokroževalno razliko.
 *
 * @param total skupni znesek za razdelitev (EUR, brez tipa — tip gre posebej)
 * @param count število oseb (>= 1)
 * @returns seznam `count` zneskov; vsota === total (do float centne natančnosti)
 */
export function splitAmountBreakdown(total: number, count: number): number[] {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0
  // necel count (pokvarjen klic) → floor (2.9 → 2); count < 1 → 1
  const safeCount = count >= 1 ? Math.floor(count) : 1
  if (safeCount === 1 || safeTotal === 0) return [Math.round(safeTotal * 100) / 100]
  const base = Math.floor((safeTotal / safeCount) * 100) / 100
  const parts: number[] = []
  for (let i = 0; i < safeCount; i++) {
    parts.push(
      i === safeCount - 1
        ? Math.round((safeTotal - base * (safeCount - 1)) * 100) / 100
        : base,
    )
  }
  return parts
}
