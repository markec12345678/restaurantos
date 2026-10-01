// ============================================
// R195 DRIFT-GATE — Neon locationId drift-most: trajna rešitev (package pini)
//
// Bremza regresijo na R195 artefaktih:
//   1. scripts/r195-neon-locationid-migration.sql — EN vir resnice za
//      migracijo 11 konfiguracijskih tabel (idempotentna, fail-closed,
//      dinamičen backfill — brez hardcoded locationId).
//   2. scripts/r195-apply-locationid-migration.mjs — applier z varovalkami
//      (postgres URL guard, Location count === 1, post-verify, orphan check).
//   3. tests/integration/r195-neon-locationid-migration.test.ts — IT dokaz
//      celotnega cikla (drift → migracija → verify), bere ISTO SQL datoteko.
//   4. src/lib/prisma-column-fallback.ts — most ostaja (self-disabling po
//      aplikaciji) + detektor P2022/P1054/P2010 duck-typing.
//   5. docs/KNOWN_ISSUES.md — #48 z package statusom.
//
// NEGATIVNI PINI: brez DROP COLUMN/DROP TABLE stavkov (irverzibilne operacije
// samo v komentar-rollbacku), brez hardcoded 'loc-1' (multi-location varovalka
// je abort, ne ugibanje), most NI izbrisan pred aplikacijo.
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (...p: string[]): string => readFileSync(path.join(root, ...p), 'utf-8')

const TABLES = [
  'DiningOption', 'RevenueCenter', 'SalesCategory', 'PriceGroup', 'ServiceCharge',
  'PrepStation', 'VoidReason', 'NoSaleReason', 'AlternatePaymentType', 'Printer', 'Discount',
] as const

const migrationRaw = read('scripts', 'r195-neon-locationid-migration.sql')
const applyScript = read('scripts', 'r195-apply-locationid-migration.mjs')
const itTest = read('tests', 'integration', 'r195-neon-locationid-migration.test.ts')
const fallback = read('src', 'lib', 'prisma-column-fallback.ts')
const knownIssues = read('docs', 'KNOWN_ISSUES.md')

/** Stavki (komentarji in prazne vrstice filtrirani) — isti format kot IT/apply. */
const statements = migrationRaw
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith('--'))
  .map((l) => (l.endsWith(';') ? l.slice(0, -1) : l))

describe('R195 drift-gate: migration SQL (en vir resnice)', () => {
  it('datoteka obstaja in ima točno 66 stavkov (11 tabel × 6)', () => {
    expect(statements.length).toBe(66)
  })

  it('vseh 11 tabel je pokritih (empirični runda-39 seznam ≡ prisma-column-fallback.ts)', () => {
    for (const t of TABLES) {
      expect(migrationRaw, `manjka tabela ${t}`).toContain(`ALTER TABLE "${t}"`)
    }
  })

  it('per-tabela vzorec: ADD COLUMN IF NOT EXISTS + backfill + SET NOT NULL + FK RESTRICT + CREATE INDEX', () => {
    for (const t of TABLES) {
      expect(statements, `${t}: ADD COLUMN`).toContain(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "locationId" TEXT`)
      expect(
        statements.some((s) => s.startsWith(`UPDATE "${t}" SET "locationId" = (SELECT "id" FROM "Location"`) && s.endsWith(`WHERE "locationId" IS NULL`)),
        `${t}: dinamičen backfill iz Location`,
      ).toBe(true)
      expect(statements, `${t}: SET NOT NULL`).toContain(`ALTER TABLE "${t}" ALTER COLUMN "locationId" SET NOT NULL`)
      expect(statements, `${t}: DROP FK IF EXISTS`).toContain(`ALTER TABLE "${t}" DROP CONSTRAINT IF EXISTS "${t}_locationId_fkey"`)
      expect(
        statements.find((s) => s.startsWith(`ALTER TABLE "${t}" ADD CONSTRAINT "${t}_locationId_fkey" FOREIGN KEY`) && s.includes('REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE')),
        `${t}: FK RESTRICT CASCADE`,
      ).toBeTruthy()
      expect(statements, `${t}: CREATE INDEX (@@index pariteta)`).toContain(`CREATE INDEX IF NOT EXISTS "${t}_locationId_idx" ON "${t}"("locationId")`)
    }
  })

  it('idempotentnost: IF NOT EXISTS / IF EXISTS vzorci so prisotni 11× (samo stavki, brez komentarjev)', () => {
    const stmts = statements.join('\n')
    expect(stmts.match(/ADD COLUMN IF NOT EXISTS/g)?.length).toBe(11)
    expect(stmts.match(/DROP CONSTRAINT IF EXISTS/g)?.length).toBe(11)
    expect(stmts.match(/CREATE INDEX IF NOT EXISTS/g)?.length).toBe(11)
  })

  it('NEGATIVNI PIN: brez DROP COLUMN / DROP TABLE stavkov (irverzibilno samo v komentar-rollbacku)', () => {
    for (const s of statements) {
      expect(s, `nepričakovan DROP stavek: ${s.slice(0, 80)}`).not.toMatch(/DROP COLUMN|DROP TABLE/)
    }
  })

  it('NEGATIVNI PIN: brez hardcoded locationId (backfill je dinamičen — multi-location = abort, ne ugibanje)', () => {
    expect(migrationRaw).not.toContain('loc-1')
    expect(migrationRaw).not.toContain("'locKioskA'")
    // vsak backfill mora brati iz Location tabele, ne literal
    expect(migrationRaw.match(/FROM "Location"/g)?.length).toBe(11)
  })

  it('format: en stavek na vrstico (brez ; znotraj stavka) — pogoj delitve za IT test in apply skripto', () => {
    for (const s of statements) {
      expect(s.includes(';'), `stavek vsebuje notranji ;: ${s.slice(0, 60)}`).toBe(false)
    }
  })
})

describe('R195 drift-gate: apply skripta (fail-closed varovalke)', () => {
  it('datoteka obstaja in referencira EN vir resnice (migration.sql)', () => {
    expect(existsSync(path.join(root, 'scripts', 'r195-apply-locationid-migration.mjs'))).toBe(true)
    expect(applyScript).toContain('r195-neon-locationid-migration.sql')
  })

  it('fail-closed: postgres URL guard (sandbox file: URL ni produkcijski)', () => {
    expect(applyScript).toContain('postgres(ql)?:\\/\\/')
    expect(applyScript).toContain('fail(')
  })

  it('fail-closed: Location count === 1 varovalka (multi-location backfill = ročna preslikava)', () => {
    expect(applyScript).toContain('locRows.length !== 1')
    expect(applyScript).toContain('TOČNO 1')
  })

  it('post-verify: information_schema NOT NULL + FK + pg_indexes (@@index pariteta)', () => {
    expect(applyScript).toContain('information_schema.columns')
    expect(applyScript).toContain('is_nullable')
    expect(applyScript).toContain('information_schema.table_constraints')
    expect(applyScript).toContain('pg_indexes')
    expect(applyScript).toContain('_locationId_idx')
  })

  it('orphan check: backfill pusti 0 vrstic z drugačno lokacijo', () => {
    expect(applyScript).toContain('"locationId" <> $1')
    expect(applyScript).toContain('ročni pregled')
  })
})

describe('R195 drift-gate: IT test (celoten cikel) + fallback most', () => {
  it('IT test bere ISTO SQL datoteko (en vir resnice) in unmocka db', () => {
    expect(itTest).toContain("vi.unmock('@/lib/db')")
    expect(itTest).toContain("'r195-neon-locationid-migration.sql'")
    expect(itTest).toContain('r195-apply-locationid-migration.mjs')
  })

  it('IT test pokriva drift → migracija → verify cikel', () => {
    expect(itTest).toContain('DROP COLUMN IF EXISTS "locationId"')
    expect(itTest).toContain('withLocationColumnFallback')
    expect(itTest).toContain('isMissingLocationColumnError')
    expect(itTest).toContain('23503')
  })

  it('fallback most ŠE VEDNO obstaja (self-disabling po aplikaciji — ne izbrisati predčasno)', () => {
    expect(existsSync(path.join(root, 'src', 'lib', 'prisma-column-fallback.ts'))).toBe(true)
    expect(fallback).toContain('withLocationColumnFallback')
    expect(fallback).toContain('r195-neon-locationid-migration.sql')
  })

  it('detektor: P2022/P1054/P2010 duck-typing pod istim sporočilnim regexom (R195 fix)', () => {
    expect(fallback).toContain("err.code !== 'P2022'")
    expect(fallback).toContain("err.code !== 'P1054'")
    expect(fallback).toContain("err.code !== 'P2010'")
    expect(fallback).toMatch(/locationId\.\*does not exist\|does not exist\.\*locationId/i)
  })
})

describe('R195 drift-gate: KNOWN_ISSUES #48', () => {
  it('#48 sekcija obstaja s package statusom (aplikacija = uporabniški korak)', () => {
    expect(knownIssues).toContain('#48 — Neon drift: 11 konfiguracijskih tabel brez locationId stolpca')
    expect(knownIssues).toContain('r195-neon-locationid-migration.sql')
    expect(knownIssues).toContain('r195-apply-locationid-migration.mjs')
  })

  it('#48 je v statusni tabeli (FIXED package, MEDIUM)', () => {
    expect(knownIssues).toMatch(/\| #48 Neon locationId drift[^\n]*MEDIUM[^\n]*✅ FIXED/)
  })
})
