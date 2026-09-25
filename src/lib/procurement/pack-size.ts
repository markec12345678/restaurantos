// ============================================
// R131 (epic #115 P1-13): PACK-SIZE KONVERZIJSKI KANON
// ============================================
//
// Čiste funkcije (BREZ DB, BREZ I/O — hišni vzorec reorder canon R129).
// Kanon P1-13: dobavitelj prodaja v PAKETIH (vrečka 25 kg, sod 50 L, karton
// 12 kos), zaloga se vodi v OSNOVNIH enotah (kg, L, kos):
//
//   Katalog → PO v paketih → GRN (prevzem) → zaloga v osnovnih enotah →
//   Price History na osnovno enoto → Recipe Cost / Reorder konsistentni.
//
// Pravila (kanon, ne izmišljuj):
//   1. packQty = koliko OSNOVNIH enot je 1 paket. Denar je VEDNO na nivoju
//      naročilne vrstice (packs × unitPrice); osnovna enota je izvedena:
//      base = packs × packQty, basePrice = unitPrice / packQty.
//   2. NULL/invalid packQty = legacy semantika (vrstica v osnovnih enotah) —
//      klicatelj uporablja isValidPack() kot vrata; konverzijske funkcije se
//      NIKOLI ne sežejo z neveljavnim packQty.
//   3. VSI guardi: NaN/Infinity/0/negativno/null → varno vedenje (false/0/1),
//      NIKOLI throw na UI/API poti (defenzivno, fail-closed).
//
// Zaokroževanja (decimal-exact prek Prisma.Decimal — pariteta '@/lib/decimal'):
//   - količine → round3 (zaloga je Decimal(12,3)),
//   - cene     → round4 (price history je Decimal(12,4)).
// '@/lib/decimal' izvozi round2/round3; round4 živi tu lokalno (samo pack-size
// kanon ga potrebuje — ni razloga za širjenje skupnega modula).
// ============================================

import { Prisma } from '@prisma/client'
import { divide, multiply } from '@/lib/decimal'

/** round4 — osnovna cena na 4 decimalki (price history Decimal(12,4)). */
function round4(val: number): number {
  return new Prisma.Decimal(val).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP).toNumber()
}

/** round3 — osnovna količina na 3 decimalke (zaloga Decimal(12,3)). */
function round3(val: number): number {
  return new Prisma.Decimal(val).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP).toNumber()
}

/**
 * Ali je packQty veljavna velikost paketa? Jedro vseh ostalih guardov:
 * null/undefined/NaN/Infinity/0/negativno → false (legacy semantika).
 */
export function isValidPack(packQty: number | null | undefined): boolean {
  return packQty != null && Number.isFinite(packQty) && packQty > 0
}

/**
 * Pretvori ŠTEVILO PAKETOV v osnovne enote: round3(packs × packQty).
 * Guardi: ne-finite/negativne/ničelne vhode → 0 (nikoli throw).
 */
export function packsToBaseQty(packs: number, packQty: number): number {
  if (!Number.isFinite(packs) || packs <= 0) return 0
  if (!isValidPack(packQty)) return 0
  return round3(multiply(packs, packQty).toNumber())
}

/**
 * Osnovna cena na enoto: round4(pricePerPack / packQty).
 * Guardi: neveljaven packQty ali cena ≤ 0/ne-finite → 0 (nikoli throw,
 * nikoli negativna cena).
 */
export function baseUnitPrice(pricePerPack: number, packQty: number): number {
  if (!isValidPack(packQty)) return 0
  if (!Number.isFinite(pricePerPack) || pricePerPack <= 0) return 0
  return round4(divide(pricePerPack, packQty).toNumber())
}

/**
 * Koliko CELIH paketov pokrije podano osnovno količino? ceil(baseQty/packQty),
 * MINIMUM 1 (advisory naročanje — nikoli 0 paketov). Guardi: neveljaven
 * packQty ali ne-finite/negativna/ničelna baseQty → 1.
 */
export function packsForBaseQty(baseQty: number, packQty: number): number {
  if (!isValidPack(packQty)) return 1
  if (!Number.isFinite(baseQty) || baseQty <= 0) return 1
  return Math.max(1, Math.ceil(round3(divide(baseQty, packQty).toNumber())))
}

/**
 * Človeku razumljiv opis pakiranja: "vrečka po 25 kg" (za UI/faktorje/opombe).
 * Guardi: neveljaven packQty → '' (prazno = brez pakiranja); prazen packUnit
 * pade na shemski default 'paket'; manjkajoča osnovna enota se izpusti.
 */
export function describePack(packQty: number, packUnit: string, baseUnit: string): string {
  if (!isValidPack(packQty)) return ''
  const unit = (packUnit ?? '').trim() || 'paket'
  const base = (baseUnit ?? '').trim()
  const qty = new Prisma.Decimal(packQty).toString() // '25', ne '25.000'
  return base ? `${unit} po ${qty} ${base}` : `${unit} po ${qty}`
}
