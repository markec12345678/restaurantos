// ============================================
// R131 (epic #115 P1-13) — PACK-SIZE UI HELPERS (klient, ČISTE funkcije)
// --------------------------------------------
// Semantika po kanonu R131 (agent-ctx/R131-design.md §2):
//   packQty = št. OSNOVNIH enot na 1 paket. NULL/neveljaven packQty =
//   legacy semantika (vrstica je v osnovnih enotah) — UI se NE spreminja,
//   nikoli crash na UI poti (invalid pack config → fallback).
//
// Namerna LOKALNA kopija čiste matematike (namesto importa iz
// src/lib/procurement/pack-size, ki je strežniško ozemlje paralelnega
// agenta R131-server in morda še ne obstaja). Brez Prisme/importov —
// varno za client bundle. Če/ko strežniški modul pristane, ostane ta
// fallback konsistenten (isti kanon).
// ============================================

/**
 * Veljaven pack config: packQty je končno število > 0.
 * null / undefined / '' / NaN / Infinity / ≤ 0 → false (= legacy vrstica).
 */
export function isValidPack(packQty: unknown): boolean {
  if (packQty === null || packQty === undefined || packQty === '') return false
  const n = Number(packQty)
  return Number.isFinite(n) && n > 0
}

/** Kompaktni izpis količine (celo število brez decimalk, sicer max 2 decimalki) */
export function fmtPackQty(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

/** Zaokroži na 3 decimalke (kanon: zaloga Decimal(12,3)) — Prisma-free */
export function round3Safe(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 1000) / 1000
}

/**
 * Osnovna cena iz paketne: pricePerPack / packQty (4 decimalki, kanon
 * price history Decimal(12,4)) → null, če pack config ni veljaven
 * (pariteta z API-jem: baseUnitPrice pride izračunan; to je klientski fallback).
 */
export function baseUnitPriceFromPack(pricePerPack: unknown, packQty: unknown): number | null {
  if (!isValidPack(packQty)) return null
  const price = Number(pricePerPack)
  if (!Number.isFinite(price)) return null
  return Math.round((price / Number(packQty)) * 10000) / 10000
}
