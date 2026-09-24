// Skripta za apliciranje ENE Prisma migracije na PGlite bazo (incremental).
// Uporaba: node scripts/apply-migration-pglite.mjs prisma/migrations/0008_stocktake/migration.sql
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'fs'

const dataDir = process.env.PGLITE_DATA_DIR || '/tmp/pglite-data'
const migrationPath = process.argv[2]

if (!migrationPath) {
  console.error('Uporaba: node scripts/apply-migration-pglite.mjs <path-do-migration.sql>')
  process.exit(1)
}

const sql = readFileSync(migrationPath, 'utf8')
console.log(`[migrate] Apliciram ${migrationPath} na PGlite (${dataDir})...`)

const pg = new PGlite(dataDir)
try {
  await pg.exec(sql)
  console.log('[migrate] ✅ Migracija uspešno aplicirana')
  const tables = await pg.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('Stocktake','StocktakeItem')`)
  console.log('[migrate] Nove tabele:', tables.rows.map(r => r.tablename).join(', '))
} catch (err) {
  console.error('[migrate] Napaka:', err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await pg.close()
}
