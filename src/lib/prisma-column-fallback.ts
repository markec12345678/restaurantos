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
// TRAJNA REŠITEV (R195 — package pripravljen + testiran na PGlite):
//   scripts/r195-neon-locationid-migration.sql  (EN vir resnice, idempotenten:
//     ADD COLUMN IF NOT EXISTS + dinamičen backfill + SET NOT NULL + FK
//     RESTRICT + CREATE INDEX = @@index pariteta na vseh 11 tabelah)
//   scripts/r195-apply-locationid-migration.mjs (fail-closed applier:
//     postgres URL guard, Location count === 1 varovalka, post-verify,
//     orphan check)
// IT dokaz celotnega cikla (drift simulacija → aplikacija → verify):
//   tests/integration/r195-neon-locationid-migration.test.ts
// Po aplikaciji P2022/P2010 ne nastopi več → most samodejno izgubi vlogo.
//
// Uporaba:
//   const item = await withLocationColumnFallback('config:noSaleReason', (withLoc) =>
//     db.noSaleReason.create({ data: withLoc ? dataWithLoc : dataWithoutLoc }))

import { logger } from './logger'

/**
 * R192: vzorec za create na 11 konfiguracijskih tabelah znotraj
 * withLocationColumnFallback — data literal nosi
 * `locationId: withLoc ? locationId : undefined` (undefined = polje ni
 * podano → Neon drift-most). Ker je locationId v shemi OBVEZEN (String NOT
 * NULL), literal castamo na UNCHECKED create-input:
 *
 *   db.voidReason.create({
 *     data: { name, isActive: true, locationId: withLoc ? locationId : undefined } as
 *       Prisma.VoidReasonUncheckedCreateInput,
 *   })
 *
 * Cast je comparable (Unchecked → literal je dodeljiv, ker string ⊂ string |
 * undefined); edina "izjava" je locationId opcijskost, ki jo dokumentira
 * zgornji vzorec. Run(false) veja NE sme podati locationId (P2022).
 */

// P1054/P2022/P2010 "column locationId does not exist" detektor.
//
// FIX QA runda 39 (hotfix 2): Prisma koda za "column does not exist" je P2022
// (ne P1054 kot sem prvotno zmotno predpostavil). Sprejmi oba za varnost.
// Poleg tega NE uporabljaj `instanceof Prisma.PrismaClientKnownRequestError` —
// v Next.js bundleju obstajata DVE kopiji @prisma/client (app koda vs. generated
// engine client) → instanceof vedno false → fallback se nikoli ne sproži.
// Duck-typing po `code` + `message` je odporen na dual-copy problem.
//
// FIX R195: driver-adapter pot (PGlite — pglite-prisma-adapter, dev/test/self-host)
// NE prevaja PG napak v Prisma P-code: raw/model pad pride kot P2010 ("Raw query
// failed. Code: `42703`. Message: ... column "locationId" of relation ... does not
// exist"). Realni engine (Neon produkcija) vrača P2022/P1054. Skupni imenovalec
// je SPOROČILO — P2010 sprejemamo pod ISTIM sporočilnim regexom (fail-closed:
// brez ustreznega sporočila se fallback NE sproži).
export function isMissingLocationColumnError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  const err = e as { code?: unknown; message?: unknown; name?: unknown }
  if (err.code !== 'P2022' && err.code !== 'P1054' && err.code !== 'P2010') return false
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
