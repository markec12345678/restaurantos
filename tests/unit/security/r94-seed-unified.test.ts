// ============================================
// R94-b — ENOTEN E2E SEED: ena vir resnice, dva izvajalca
// ============================================
// Zgodovina: R92 je MODEL A fixture set (test-admin PIN 1111, filiala-admin
// PIN 2222 @ loc-2, job-admin, tr-loc-*/vr-loc-*/mg-loc-*/sc-loc-*/do-loc-*,
// unikatni tipi e2e-dinein-1/2, menu/menu-2, table-1/2, ...) podvajal v
// seed-e2e-pglite.mjs (PGlite) IN init-e2e-db.mjs (identičen blok), medtem ko
// je e2e-seed.mjs (realni PG, CI) zastarel — pred R92 prenovou, brez
// filiala-admin in brez večine MODEL A fixture-ov, ki jih pričakuje
// tests/e2e/multi-tenant-security.spec.ts. R93 e2e CI run je poleg tega
// dokazal, da PGlite pod e2e obremenitvijo ustvari več WASM instanc na isti
// dataDir (single-instance-per-dataDir krši → Aborted() v callMain) — e2e CI
// prehaja na REALNI PostgreSQL (hišni precedens: ci.yml = postgres:16-alpine
// + prisma db push); PGlite ostane lokalna razvojna pot.
//
// R94-b arhitektura: scripts/e2e-seed-data.mjs izvaža seedE2eData(executor,
// ctx) — EDIRNI vir fixture SQL-a (raw Postgres, prenosljiv, ker PGlite JE
// postgres). Dva tanka wrapperja:
//   - seed-e2e-pglite.mjs  → PGlite lokalno:  run = (sql, p) => pg.query(sql, p)
//   - e2e-seed.mjs         → realni PG (CI):  run = (sql, p) => db.$executeRawUnsafe(sql, ...p)
// init-e2e-db.mjs ohrani svojo wipe+DDL pot in delegira seed na isti modul.
//
// Zakaj fs-guard (readFileSync + source asserti) in ne runtime testi z DB:
//   - nobena baza ni na voljo v unit okolju; namera je PIN-arhitektura fajlov
//     (single-source pin, executor oblike, fail-closed guarda, flow pini).
//   - fs-guard lovi regresije, ki jih runtime ne: kdor koli doda NAZAJ
//     podvojen fixture SQL, odstrani fail-closed guard ali prekine delegacijo
//     na skupni modul — takoj rdeče.
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const SHARED = 'scripts/e2e-seed-data.mjs'
const PGLITE_WRAPPER = 'scripts/seed-e2e-pglite.mjs'
const PG_WRAPPER = 'scripts/e2e-seed.mjs'
const INIT = 'scripts/init-e2e-db.mjs'

const SHARED_IMPORT = `import { seedE2eData } from './e2e-seed-data.mjs'`

// Fixture-id pini (brief R94-b): vsi MODEL A id-ji, ki jih e2e spec
// (multi-tenant-security.spec.ts) in login pot pričakujeta v seedu.
const FIXTURE_ID_PINS: ReadonlyArray<string> = [
  'tr-loc-1', 'tr-loc-2',          // per-lokacijski TaxRate (S/R/Z)
  'vr-loc-1', 'vr-loc-2',          // per-lokacijski VoidReason
  'mg-loc-1', 'mg-loc-2',          // per-lokacijski ModifierGroup
  'sc-loc-1', 'sc-loc-2',          // per-lokacijski ServiceCharge
  'do-loc-1', 'do-loc-2',          // per-lokacijski DiningOption
  'e2e-dinein-1', 'e2e-dinein-2',  // unikatna DiningOption tipa (MODEL A R92)
  'filiala-admin',                 // PIN 2222 @ loc-2 (MODELA beforeAll login)
  'test-admin',                    // PIN 1111 (brez lokacije)
  'loc-2', 'menu-2', 'table-2',    // "dve lokaciji" E2E varianta
]

function readRepoFile(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split('/')), 'utf-8')
}

describe('R94-b — enoten e2e seed: ena vir resnice (fs-guard)', () => {
  it('skupni modul izvaža seedE2eData(executor, ctx) kontrakt (HMAC pin lookup + fail-closed ctx)', () => {
    const src = readRepoFile(SHARED)
    expect(src).toContain('export async function seedE2eData(executor, ctx)')
    // ctx.nextAuthSecret = PIN lookup kanon (HMAC-SHA256(secret, pin)) — enako
    // kot v obeh starih skriptah; fail-closed če manjka.
    expect(src).toContain('createHmac(')
    expect(src).toMatch(/if\s*\(!ctx\s*\|\|\s*!ctx\.nextAuthSecret\)/)
    // bcrypt rounds 10 (isti kanon kot stari skripti)
    expect(src).toContain('await bcrypt.hash(pin, 10)')
    expect(src).toContain("await bcrypt.hash(fpin, 10)")
  })

  it('seed-e2e-pglite.mjs je tanek wrapper: importira skupni modul + PGlite executor { run }', () => {
    const src = readRepoFile(PGLITE_WRAPPER)
    expect(src).toContain(SHARED_IMPORT)
    expect(src).toContain('await seedE2eData(executor, { nextAuthSecret: NEXTAUTH_SECRET })')
    // Executor oblika: pg.query (pozicijski parametri) — NI podvojenega fixture SQL-a
    expect(src).toContain('run: (sql, params) => pg.query(sql, params)')
    expect(src).not.toContain('INSERT INTO')
    // Wrapper-lastna vsota (read gre čez pg.query — INSERT-i so v skupnem modulu)
    expect(src).toContain('SELECT count(*) FROM "Employee"')
    expect(src).toContain('await pg.close()')
  })

  it('e2e-seed.mjs je tanek wrapper za REALNI PG: importira skupni modul + $executeRawUnsafe executor', () => {
    const src = readRepoFile(PG_WRAPPER)
    expect(src).toContain(SHARED_IMPORT)
    expect(src).toContain('await seedE2eData(executor, { nextAuthSecret: NEXTAUTH_SECRET })')
    // Executor oblika: $executeRawUnsafe (affected-count zadostuje — modul
    // vsebuje izključno INSERT ... ON CONFLICT, brez RETURNING/SELECT)
    expect(src).toContain('db.$executeRawUnsafe(sql, ...(params ?? []))')
    expect(src).toContain('db.$queryRawUnsafe(')
    expect(src).toContain('db.$disconnect()')
    // Prisma client z eksplicitnim DATABASE_URL datasource override-om
    expect(src).toContain('new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })')
    expect(src).not.toContain('INSERT INTO')
  })

  it('e2e-seed.mjs fail-closed guarda PREŽIVETA: DATABASE_URL + NEXTAUTH_SECRET manjkata → process.exit(1)', () => {
    const src = readRepoFile(PG_WRAPPER)
    expect(src).toMatch(/if\s*\(!DATABASE_URL\)\s*\{[^}]*process\.exit\(1\)/)
    expect(src).toMatch(/if\s*\(!NEXTAUTH_SECRET\)\s*\{[^}]*process\.exit\(1\)/)
    expect(src.match(/process\.exit\(1\)/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('init-e2e-db.mjs ohrani wipe+DDL pot (PGlite, rmSync, prisma migrate diff, schema.sql fallback) in delegira seed', () => {
    const src = readRepoFile(INIT)
    // Nespremenjen lokalni flow pin (PGlite + deterministični wipe + DDL vir)
    expect(src).toContain("import { PGlite } from '@electric-sql/pglite'")
    expect(src).toContain('new PGlite(dataDir)')
    expect(src).toContain('rmSync(dataDir, { recursive: true, force: true })')
    expect(src).toContain('prisma migrate diff --from-empty')
    expect(src).toContain("readFileSync(new URL('../prisma/schema.sql', import.meta.url), 'utf8')")
    // Delegacija na skupni modul (isti executor kontrakt kot PGlite wrapper)
    expect(src).toContain(SHARED_IMPORT)
    expect(src).toContain('await seedE2eData(executor, { nextAuthSecret: NEXTAUTH_SECRET })')
    expect(src).toContain('run: (sql, params) => pg.query(sql, params)')
    // Podvojeni fixture SQL je IZKORENINJEN (ena vir resnice)
    expect(src).not.toContain('INSERT INTO')
  })

  it.each(FIXTURE_ID_PINS)('skupni modul vsebuje MODEL A fixture pin "%s"', (id) => {
    const src = readRepoFile(SHARED)
    expect(src).toContain(id)
  })

  it('skupni modul: PORTANI fixture-i iz starega e2e-seed.mjs (tr-Z stopnji + Ekstra sir modifierja) prisotni', () => {
    const src = readRepoFile(SHARED)
    // e2e-seed.mjs je imel S/R/Z (Z = Oproščeno 0 %); PGlite set je imel samo S/R.
    expect(src).toContain("'tr-loc-1-Z'")
    expect(src).toContain("'tr-loc-2-Z'")
    expect(src).toContain("'Oproščeno 0%'")
    // Prisma nested create (auto-cuid) → eksplicitna stabilna id-ja
    expect(src).toContain("'mod-loc-1-2'")
    expect(src).toContain("'mod-loc-2-2'")
    expect(src).toContain("'Ekstra sir'")
  })

  it('skupni modul: NE-portabilni do-loc-*-takeout fixture-i NISO vrnjeni (unique(type, locationId) trk z do-2)', () => {
    const src = readRepoFile(SHARED)
    // @@unique([type, locationId]): ('takeout', loc-1) slot si delita do-2 in
    // do-loc-1-takeout — oba id-ja ne moreta obstajati; do-2 je MODEL A canon.
    // Dokaz o nič referencah: rg 'do-loc-\d-takeout' tests/ = prazno.
    expect(src).not.toMatch(/do-loc-\d-takeout/)
    expect(src).toContain('@@unique([type, locationId])') // dokumentirana reason v komentarju
    // MODEL A unikatna tipa ostanejo kanon za cross-scope teste
    expect(src).toContain("'e2e-dinein-1'")
    expect(src).toContain("'e2e-dinein-2'")
  })

  it('skupni modul: samo prenosljiv raw Postgres SQL (brez PGlite-specifičnih pragma / ekskluzivnih funkcij)', () => {
    const src = readRepoFile(SHARED)
    // NOW(), INSERT ... ON CONFLICT, pozicijski $n — standardni postgres, ki
    // teče identično na PGlite in realnem PG. Ni PGlite-specific ukazov.
    expect(src).not.toMatch(/\bpragma\b/i)
    expect(src).not.toMatch(/gen_random_uuid\(/) // id-ji JS-side (crypto.randomUUID) — brez pgcrypto odvisnosti
    expect(src).not.toMatch(/\bRETURNING\b/)
    expect(src).not.toMatch(/\bSELECT\b[\s\S]*\bFOR UPDATE\b/)
    expect(src).toContain('ON CONFLICT')
  })
})
