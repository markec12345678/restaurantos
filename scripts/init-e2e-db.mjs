// Inicializira PGlite bazo s Prisma shemo + seed testne podatke
// Uporaba: node scripts/init-e2e-db.mjs [--keep]
//
// P1-testiranje (točka 2): DETERMINISTIČNA baza za E2E — privzeto se baza
// POčisti in znova vzpostavi (DROP SCHEMA → svež DDL → seed), tako da E2E
// testi vedno tečejo na istem izhodiščnem stanju. Zastarana/tuja stanja iz
// prejšnjih zagonov ne morejo vplivati na rezultate.
//
// DDL vir: prisma migrate diff --from-empty (zagnan živo, če je CLI na voljo)
// s fallbackom na prisma/schema.sql. slednji se regenerira ob vsaki
// spremembi schema.prisma (sicer bi baze zaostale za shemo — to se je
// zgodilo z Employee.sessionVersion, glej P1-9).
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import { seedE2eData } from './e2e-seed-data.mjs'

const dataDir = process.env.PGLITE_DATA_DIR || '/tmp/pglite-data'
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'dev-secret-32-hex-chars-min-1234567890'
const keepExisting = process.argv.includes('--keep')

// 1a. Privzeto: POBRIŠI celotno data mapo (deterministični E2E začetek).
//     FS-delete namesto DROP SCHEMA: PGlite WASM zna ABORT-ati pri odpiranju
//     baze z nečisto zaključenim WAL stanjem (playwright SIGKILL webServer-ja
//     → unclean shutdown → crash recovery v wasm crasha). Sveža mapa = sveža
//     baza = ni crash-recovery poti. --keep ohrani obstoječe (razvojni način).
if (!keepExisting) {
  rmSync(dataDir, { recursive: true, force: true })
  console.log('[init] ✅ Data mapa zavržena (deterministični E2E začetek)')
}

console.log(`[init] PGlite data dir: ${dataDir}`)
const pg = new PGlite(dataDir)
// PGlite je ready po konstruktorju (ne potrebuje waitReady v tej verziji)

// 1b. DDL — živa generacija iz prisma CLI (najbolj sveža), fallback schema.sql
let sql = ''
try {
  sql = execSync(
    'DATABASE_URL="postgresql://user:pass@localhost:5432/db" npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
    { cwd: process.cwd(), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  )
  console.log('[init] ✅ DDL generiran živo iz prisma/schema.prisma')
} catch {
  console.log('[init] ⚠ Prisma CLI ni na voljo — uporabljam prisma/schema.sql (fallback)')
  sql = readFileSync(new URL('../prisma/schema.sql', import.meta.url), 'utf8')
}

console.log(`[init] Applying DDL (${sql.length} znakov)...`)
const statements = sql.split(';').filter(s => s.trim().length > 0)
let created = 0
let skipped = 0
for (const stmt of statements) {
  try {
    await pg.query(stmt + ';')
    created++
  } catch (err) {
    // Ignoriraj "already exists" napake (samo v --keep načinu so možne)
    skipped++
  }
}
console.log(`[init] ✅ Schema loaded: ${created} created, ${skipped} skipped (already exist)`)

// 2. Seed testne podatke
// R94-b: fixture SQL je bil do R94 podvojen (identičen blok kot v
// seed-e2e-pglite.mjs) — zdaj delegira na EDIRNI vir scripts/e2e-seed-data.mjs
// (R92 MODEL A set; isti fixture set teče tudi na realnem PG v CI prek
// scripts/e2e-seed.mjs). Wipe + DDL pot zgoraj je NESPREMENJENA.
console.log('[init] Seeding test data...')

// R94-b enoten executor kontrakt: seedE2eData kliče run(sql, params) z
// pozicijskimi $1..$n parametri — pg.query(SQL, params) zadošča (PGlite JE
// postgres; identično kot $executeRawUnsafe na realnem PG).
const executor = { run: (sql, params) => pg.query(sql, params) }
await seedE2eData(executor, { nextAuthSecret: NEXTAUTH_SECRET })

// Preveri stanje
const counts = await pg.query(`
  SELECT
    (SELECT count(*) FROM "Employee") AS employees,
    (SELECT count(*) FROM "Location") AS locations,
    (SELECT count(*) FROM "Menu") AS menus,
    (SELECT count(*) FROM "MenuItem") AS menuItems,
    (SELECT count(*) FROM "Table") AS tables,
    (SELECT count(*) FROM "RestaurantSettings") AS settings
`)
console.log('[init] 📊 Stanje baze:', counts.rows[0])

await pg.close()
console.log('[init] ✅ Končano. Baza pripravljena za E2E teste.')
