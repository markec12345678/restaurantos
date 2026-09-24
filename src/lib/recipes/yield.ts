// ============================================
// YIELD / PREPARATION LOSS — P0-05 (epic #115, runda 123)
// ============================================
//
// Enoten kanon za vse potrošnike quantityPerServing (6 prodajnih poti,
// vračila, availability, food cost, menu-stock, z-report teoretični COGS):
//
//   raw quantity → preparation loss → usable quantity → recipe quantity → sale
//
// quantityPerServing je USABLE količina (tisto, kar gre v jed). yieldPercent
// (1–100) je deklarirana izguba priprave sestavine: trimming, kuhanje/pečenje,
// čiščenje, evaporacija (batch priprava ima svoj cost basis — R122).
//
//   RAW potrebno  = usable / (yield/100)
//   Strošek linije = RAW × nabavna cena = usable × cena / (yield/100)
//
// yieldPercent = 100 → RAW = usable (back-compat: vse vrstice brez yielda
// se obnašajo točno kot doslej). Stolpec ima DB default 100, ta helper je
// obramben tudi za null/undefined (stare trape/test fiksna).
import { toNum, divide } from '../decimal'

export const YIELD_DEFAULT_PERCENT = 100

/** Normaliziraj yield %: null/undefined/neštevilka → 100; sicer omeji na [1, 100]. */
export function normalizeYieldPercent(yieldPercent: number | null | undefined): number {
  const y = toNum(yieldPercent as unknown as string)
  if (!Number.isFinite(y) || y <= 0) return YIELD_DEFAULT_PERCENT
  return Math.min(Math.max(y, 1), YIELD_DEFAULT_PERCENT)
}

/**
 * RAW količina, ki jo je treba odvzeti iz zaloge za `usableQty` USABLE.
 * Prodaja fizično porabi surovo sestavino (kupiš 1.2 kg, da dobiš 1 kg
 * uporabnega) — deduction, availability, vračila in menu-stock morajo
 * uporabljati TO formulo (skladnost ledger ↔ preverjanja).
 */
export function rawFromUsable(usableQty: number, yieldPercent: number | null | undefined): number {
  const y = normalizeYieldPercent(yieldPercent)
  if (y >= YIELD_DEFAULT_PERCENT) return usableQty
  return toNum(divide(usableQty, y / 100))
}

/**
 * Efektivni strošek receptne vrstice na porcijo = RAW × nabavna cena.
 * (usable × cena / (yield/100)) — food cost NE sme računati iz nominalne
 * nabavne količine, če je dejanski usable yield drugačen (P0-05 kanon).
 */
export function yieldAdjustedLineCost(usableQty: number, costPerUnit: number, yieldPercent: number | null | undefined): number {
  const y = normalizeYieldPercent(yieldPercent)
  if (y >= YIELD_DEFAULT_PERCENT) return usableQty * costPerUnit
  return toNum(divide(usableQty * costPerUnit, y / 100))
}
