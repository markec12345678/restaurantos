// E2E seed za CI (REALNI PostgreSQL) — R94-b: tanek wrapper okoli skupnega
// fixture modula scripts/e2e-seed-data.mjs (R92 MODEL A set, ENEGA vira
// resnice za obe bazi — lokalna PGlite pot = seed-e2e-pglite.mjs).
//
// Zakaj datoteka: inline `node -e "..."` v YAML run bloku je padel, ker so
// komentarji vsebovali DVOJNE narekovaje ("dve lokaciji", "verify inventory")
// — bash je zaključil niz pri prvem " in skripta se obrezala
// (SyntaxError: Unexpected end of input, run 539).
//
// Zakaj realni PG: R93 e2e CI run je pokazal, da PGlite pod e2e obremenitvijo
// ustvari več WASM instanc na isti dataDir (single-instance-per-dataDir krši
// → Aborted() v callMain) — CI se seli na realni PostgreSQL (hišni precedens:
// ci.yml integration job = postgres:16-alpine + prisma db push). PGlite
// ostane za LOKALNI razvoj.
//
// Uporaba: DATABASE_URL=... NEXTAUTH_SECRET=... node scripts/e2e-seed.mjs
import { PrismaClient } from '@prisma/client'
import { seedE2eData } from './e2e-seed-data.mjs'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('[e2e-seed] DATABASE_URL ni nastavljen — realni PostgreSQL je zahtevan (fail-closed; PGlite ni več CI pot)')
  process.exit(1)
}

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET
if (!NEXTAUTH_SECRET) {
  console.error('[e2e-seed] NEXTAUTH_SECRET ni nastavljen — PIN lookup bi bil napačen')
  process.exit(1)
}

const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })

async function main() {
  // R94-b enoten executor kontrakt: seedE2eData kliče run(sql, params) z
  // pozicijskimi $1..$n parametri. $executeRawUnsafe vrača affected-count —
  // to je dovolj, ker skupni modul vsebuje IZKLJUČNO INSERT ... ON CONFLICT
  // stavke (brez RETURNING / SELECT); edini read (vsota vrstic) je
  // wrapper-lasten in gre čez $queryRawUnsafe spodaj.
  const executor = { run: (sql, params) => db.$executeRawUnsafe(sql, ...(params ?? [])) }
  await seedE2eData(executor, { nextAuthSecret: NEXTAUTH_SECRET })

  const rows = await db.$queryRawUnsafe(`
  SELECT
    (SELECT count(*) FROM "Employee") AS employees,
    (SELECT count(*) FROM "MenuItem") AS menuItems,
    (SELECT count(*) FROM "Table") AS tables,
    (SELECT count(*) FROM "TaxRate") AS taxRates,
    (SELECT count(*) FROM "Location") AS locations
`)
  console.log('[e2e-seed] 📊 Stanje:', rows[0])

  console.log('[e2e-seed] Seed complete')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
