// Skripta za inicializacijo PGlite baze z Prisma shemo
import { PGlite } from '@electric-sql/pglite'
import { existsSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'

const dataDir = process.env.PGLITE_DATA_DIR || '/home/z/my-project/pglite-data'

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
  console.log(`[init] Ustvaril mapo: ${dataDir}`)
}

console.log(`[init] Inicializiram PGlite na ${dataDir}`)
const pg = new PGlite(dataDir)

console.log('[init] Generiram SQL migracijo iz sheme...')
const sql = execSync(
  'DATABASE_URL="postgresql://user:pass@localhost:5432/db" npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
  { cwd: process.cwd(), encoding: 'utf8' }
)
console.log(`[init] SQL migracija dolga ${sql.length} znakov`)

try {
  await pg.exec(sql)
  console.log('[init] ✅ SQL migracija uspešno izvedena')
} catch (err) {
  console.error('[init] Napaka pri izvedbi SQL migracije:', err instanceof Error ? err.message : err)
}

const tables = await pg.query(`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
`)
console.log(`[init] Tabele v bazi (${tables.rows.length}):`)
tables.rows.slice(0, 10).forEach(r => console.log('  -', r.tablename))
if (tables.rows.length > 10) console.log(`  ... in ${tables.rows.length - 10} več`)

await pg.close()
console.log('[init] PGlite zaprt. Baza pripravljena.')
