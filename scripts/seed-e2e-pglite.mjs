// Skripta za seed testnih podatkov v PGlite (LOCAL DEV pot)
//
// R94-b: fixture set (R92 MODEL A) je izvlečen v EDIRNI vir
// scripts/e2e-seed-data.mjs — isti fixture SQL teče tudi na realnem
// PostgreSQL v CI prek scripts/e2e-seed.mjs ($executeRawUnsafe executor).
// Ta wrapper je tanek: zgradi PGlite instanco + executor { run } in
// delegira na seedE2eData (eden izvajalec = pg.query, PGlite JE postgres).
//
// Uporaba: node scripts/seed-e2e-pglite.mjs
import { PGlite } from '@electric-sql/pglite'
import { seedE2eData } from './e2e-seed-data.mjs'

const dataDir = process.env.PGLITE_DATA_DIR || '/home/z/my-project/pglite-dev-data'
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'dev-secret-32-hex-chars-min'

console.log(`[seed] Povezujem se na PGlite: ${dataDir}`)
const pg = new PGlite(dataDir)

// R94-b enoten executor kontrakt: seedE2eData kliče run(sql, params) —
// params so pozicijski ($1..$n), kar PGlite in realni PG enako podpirata.
const executor = { run: (sql, params) => pg.query(sql, params) }
await seedE2eData(executor, { nextAuthSecret: NEXTAUTH_SECRET })

// Preveri stanje (wrapper-lastna vsota — seedE2eData vsebuje IZKLJUČNO
// INSERT stavke; read gre čez pg.query, ker $executeRawUnsafe-paralel
// vrača samo affected-count)
const counts = await pg.query(`
  SELECT
    (SELECT count(*) FROM "Employee") AS employees,
    (SELECT count(*) FROM "MenuItem") AS menuItems,
    (SELECT count(*) FROM "Table") AS tables,
    (SELECT count(*) FROM "TaxRate") AS taxRates,
    (SELECT count(*) FROM "Location") AS locations
`)
console.log('[seed] 📊 Stanje:', counts.rows[0])

await pg.close()
console.log('[seed] 🎉 Seed končan')
