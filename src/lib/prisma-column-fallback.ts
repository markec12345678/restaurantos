// ============================================
// PRISMA COLUMN FALLBACK — Neon schema-drift most (QA runda 39)
// ============================================
// PROBLEM: Neon DB ima na 11 konfiguracijskih tabelah ŠE danes NI stolpca
// `locationId` (db push/migrate ni bil pognan ob MODEL A multi-location
// spremembi), Prisma schema pa ga zahteva (String NOT NULL). Vsak create /
// update / findFirst s `locationId` vrne P1054:
//   "The column `locationId` does not exist in the current database."
//
// Prizadete tabele (empirično potrjeno na prod, runda 39):
//   DiningOption, RevenueCenter, SalesCategory, PriceGroup, ServiceCharge,
//   PrepStation, VoidReason, NoSaleReason, AlternatePaymentType, Printer,
//   Discount.  (TaxRate IMA stolpec — 201.)
//
// MOST: operacijo izvedemo z locationId; pri P1054 ponovimo BREZ njega
// (vrstica postane "globalna"). To je varno za trenutno produkcijsko
// realnost (ENA lokacija / EN najemnik), a NE za pravi multi-tenant —
// zato je TRAJNA REŠITEV `prisma db push` na Neonu, po katerem fallback
// samodejno izgubi vlogo (P1054 se ne zgodi več).
//
// Uporaba:
//   const item = await withLocationColumnFallback('config:noSaleReason', (withLoc) =>
//     db.noSaleReason.create({ data: withLoc ? dataWithLoc : dataWithoutLoc }))

import { logger } from './logger'

// P1054/P2022 "column locationId does not exist" detektor.
//
// FIX QA runda 39 (hotfix 2): Prisma koda za "column does not exist" je P2022
// (ne P1054 kot sem prvotno zmotno predpostavil). Sprejmi oba za varnost.
// Poleg tega NE uporabljaj `instanceof Prisma.PrismaClientKnownRequestError` —
// v Next.js bundleju obstajata DVE kopiji @prisma/client (app koda vs. generated
// engine client) → instanceof vedno false → fallback se nikoli ne sproži.
// Duck-typing po `code` + `message` je odporen na dual-copy problem.
export function isMissingLocationColumnError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  const err = e as { code?: unknown; message?: unknown; name?: unknown }
  if (err.code !== 'P2022' && err.code !== 'P1054') return false
  const msg = String(err.message ?? '')
  return /locationId.*does not exist|does not exist.*locationId/i.test(msg)
}

/** warnOnce per (process, op) — ne spamaj logov pri vsakem klicu. */
const warnedOps = new Set<string>()
function warnOnce(op: string): void {
  if (warnedOps.has(op)) return
  warnedOps.add(op)
  // FIX lint (no-console): strukturirani logger namesto console.warn
  logger.warn(
    'column-fallback',
    `${op}: DB nima stolpca locationId — operacija izvedena BREZ lokacijskega filtra. ` +
    `TRAJNA REŠITEV: prisma db push (dodaj locationId stolpec). Gl. src/lib/prisma-column-fallback.ts`,
  )
}

/**
 * Izvedi `run(true)` (z lokacijo); pri P1054 locationId-manjkajo-stolpec
 * ponovi `run(false)` (brez). Ostale napake propadejo nespremenjene.
 */
export async function withLocationColumnFallback<T>(
  op: string,
  run: (withLocation: boolean) => Promise<T>,
): Promise<T> {
  try {
    return await run(true)
  } catch (e) {
    if (!isMissingLocationColumnError(e)) throw e
    warnOnce(op)
    return await run(false)
  }
}
