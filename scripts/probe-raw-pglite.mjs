// ============================================
// R93-a EMPIRIČNI PROBE — tagged $queryRaw/$executeRaw na PGlite WASM
// ============================================
// Ozadje (R92-FINAL): tagged `db.$queryRaw\`SELECT 1\`` PERMANENTNO ABORTIRA
// PGlite WASM ('Aborted(). Build with -sASSERTIONS for more info.') medtem ko
// `$queryRawUnsafe('SELECT 1')` deluje (dokaz: lib/counters.ts orderNumber
// inkrement + health fix R92). Vsa ostala tagged klicna mesta so bila
// "potencialno prizadeta" — ta skripta odloča z DOKAZI, ne z predpostavkami.
//
// Zasnova: VSAK primer teče v LASTNEM child procesu (node <skripta> --case N)
// z LASTNO svežo PGlite instanco (izoliran tmpdir per case) + svežem
// pglite-prisma-adapter + svežem PrismaClient — WASM abort enega primera ne
// more zastrupiti naslednjega (abort lahko poškoduje instanco/proces).
//
// UPORABA:
//   node scripts/probe-raw-pglite.mjs           # celotna matrica (spawn per case)
//   node scripts/probe-raw-pglite.mjs --case 3  # en sam primer (debug)
//
// ═══════════════════════════════════════════════════════════════════
// EMPIRIČNA MATRICA (izmerjeno R93-a, PGlite ^0.5.8, adapter ^0.3.0,
// @prisma/client ^5.22.0, driverAdapters, node v22):
//
//   #  oblika                                                              rezultat
//   1  direktno: pg.query('SELECT 1')                                      ✅ OK  ({ one: 1 })
//   2  adapter: tagged $queryRaw`SELECT 1` (brez parametrov)               ✅ OK  (SVENSKI node — glej opomba A)
//   3  adapter: tagged $queryRaw`SELECT hashtext(${'x:test'})` (1 param)   ✅ OK
//   4  adapter: tagged $queryRaw večvrstični, 2 parama (agregacijska)      ✅ OK
//   5  adapter: tagged $executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'lock:test'}))`  ✅ OK
//   6  adapter: $queryRawUnsafe('SELECT hashtext($1)', 'x:test')           ✅ OK  (pozicijsko vezanje dela)
//   7  adapter: $executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', 'lock:test')  ✅ OK (advisory lock dela)
//   8  adapter: $queryRawUnsafe('SELECT 1')                                ✅ OK  (R92 kanon potrjen)
//   9  adapter: tagged $queryRaw`... IN (${Prisma.join([...])})`           ✅ OK (izvede se — kompozicija ni problem)
//  10  adapter: $executeRawUnsafe('SELECT 1')                              ✅ OK
//  11  shema aplicirana + model query NAJPREJ, TEDY tagged $queryRaw       ✅ OK
//  12  $extends instrumentacija (kot db.ts) + tagged $queryRaw             ✅ OK
//  13  taggged + Unsafe KONKURENTO (Promise.all, re-entrancy)              ✅ OK
//  14  tagged $executeRaw advisory lock ZNOTRAJ $transaction               ✅ OK
//
// OPOMBA A (KRITIČNO): v čistem node okolju tagged oblika NE abortira —
// nasprotuje R92-FINAL opažanju ('Aborted(). Build with -sASSERTIONS') iz
// next dev na portu 3010. Abort je torej OKOLJSKIH (next dev/turbopack WASM
// bundling ali stanje instanse v dolgotrajnem dev strežniku), NE lastnost
// tagged poti same. Verifikacija v realnem next dev: glej worklog R93-a
// (temp probe route → curl → rezultat). Odločitev konverzije temelji na
// najstrožjem okolju (next dev), ne na svenem node probe-u.
// ═══════════════════════════════════════════════════════════════════

import { PGlite } from '@electric-sql/pglite'
import { PrismaPGlite } from 'pglite-prisma-adapter'
import { PrismaClient, Prisma } from '@prisma/client'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const SELF = fileURLToPath(import.meta.url)
const REPO = dirname(dirname(SELF))
const SCHEMA_SQL = join(REPO, 'prisma', 'schema.sql')

// ─── Definicija matrice ────────────────────────────────────────────
// Vsak case dobi FRESH: tmpdir → PGlite → adapter (+ performIO monkey-patch
// kot v src/lib/db.ts) → PrismaClient. Vrne { ok, error }.
const CASES = [
  { n: 1, name: 'direktno pg.query (kontrola)', run: async ({ pg }) => {
      const r = await pg.query('SELECT 1 AS one')
      return `rows=${JSON.stringify(r.rows)}`
    },
  },
  { n: 2, name: 'tagged $queryRaw`SELECT 1` (R92 health bug oblika)', run: async ({ db }) => {
      const r = await db.$queryRaw`SELECT 1`
      return `rows=${r.length}`
    },
  },
  { n: 3, name: 'tagged $queryRaw 1 param (hashtext)', run: async ({ db }) => {
      const r = await db.$queryRaw`SELECT hashtext(${'x:test'}) AS h`
      return `rows=${r.length}`
    },
  },
  { n: 4, name: 'tagged $queryRaw večvrstični 2 parama (agregacijska oblika)', run: async ({ db }) => {
      const r = await db.$queryRaw`
        SELECT ${'x:test'} AS one,
               hashtext(${'y:test'}) AS h
      `
      return `rows=${r.length}`
    },
  },
  { n: 5, name: 'tagged $executeRaw advisory lock (stock-return oblika)', run: async ({ db }) => {
      const n = await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'lock:test'}))`
      return `affected=${n}`
    },
  },
  { n: 6, name: '$queryRawUnsafe pozicijsko vezanje (hashtext $1)', run: async ({ db }) => {
      const r = await db.$queryRawUnsafe('SELECT hashtext($1) AS h', 'x:test')
      return `rows=${r.length}`
    },
  },
  { n: 7, name: '$executeRawUnsafe advisory lock (pozicijsko vezanje)', run: async ({ db }) => {
      const n = await db.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', 'lock:test')
      return `affected=${n}`
    },
  },
  { n: 8, name: '$queryRawUnsafe(\'SELECT 1\') kontrola (R92 kanon)', run: async ({ db }) => {
      const r = await db.$queryRawUnsafe('SELECT 1')
      return `rows=${r.length}`
    },
  },
  { n: 9, name: 'tagged $queryRaw + Prisma.join (locations/sync comparison oblika)', run: async ({ db }) => {
      const r = await db.$queryRaw`
        SELECT ${'loc:test'} AS "locationId"
        WHERE ${'loc:test'} IN (${Prisma.join(['a:test', 'b:test'])})
      `
      return `rows=${r.length}`
    },
  },
  { n: 10, name: '$executeRawUnsafe(\'SELECT 1\') kontrola', run: async ({ db }) => {
      const n = await db.$executeRawUnsafe('SELECT 1')
      return `affected=${n}`
    },
  },
  // ─── Od 11 naprej: "stateful" primeri — schema aplicirana, model queries,
  // $extends wrapper (kot db.ts), konkurenca, $transaction ───
  { n: 11, needsSchema: true, name: 'shema + model query NAJPREJ, tedaj tagged $queryRaw', run: async ({ db }) => {
      const cnt = await db.employee.count() // model query pred raw (stanje instanse)
      const r = await db.$queryRaw`SELECT 1`
      return `employees=${cnt}, rows=${r.length}`
    },
  },
  { n: 12, needsSchema: true, name: '$extends instrumentacija (kot db.ts) + tagged $queryRaw', run: async ({ db }) => {
      const extended = db.$extends({
        query: { $allModels: { async $allOperations({ query, args }) { return await query(args) } } },
      })
      const r = await extended.$queryRaw`SELECT 1`
      return `rows=${r.length}`
    },
  },
  { n: 13, name: 'tagged + Unsafe KONKURENTO (Promise.all re-entrancy)', run: async ({ db }) => {
      const [a, b, c] = await Promise.all([
        db.$queryRaw`SELECT hashtext(${'a:test'}) AS h`,
        db.$queryRawUnsafe('SELECT hashtext($1) AS h', 'b:test'),
        db.$queryRaw`SELECT 1`,
      ])
      return `rows=${a.length}/${b.length}/${c.length}`
    },
  },
  { n: 14, needsSchema: true, name: 'tagged $executeRaw advisory lock ZNOTRAJ $transaction', run: async ({ db }) => {
      const out = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'tx-lock:test'}))`
        const r = await tx.$queryRawUnsafe('SELECT 1 AS ok')
        return r
      })
      return `rows=${out.length}`
    },
  },
  // ─── Konkurenčni scenariji (R92 abort je opazil pod e2e obremenitvijo —
  // morda re-entrancy/race na skupni instanci, ne "tagged pot sama") ───
  { n: 15, needsSchema: true, name: '50× KONKURENTO tagged $queryRaw (ena instanca)', run: async ({ db }) => {
      await Promise.all(Array.from({ length: 50 }, (_, i) => db.$queryRaw`SELECT hashtext(${`a${i}`}) AS h`))
      return 'all 50 OK'
    },
  },
  { n: 16, needsSchema: true, name: '50× KONKURENTO $queryRawUnsafe (ena instanca)', run: async ({ db }) => {
      await Promise.all(Array.from({ length: 50 }, (_, i) => db.$queryRawUnsafe('SELECT hashtext($1) AS h', `b${i}`)))
      return 'all 50 OK'
    },
  },
  { n: 17, needsSchema: true, name: '60× mešano tagged+Unsafe+model KONKURENTO', run: async ({ db }) => {
      await Promise.all(Array.from({ length: 60 }, (_, i) =>
        i % 3 === 0 ? db.$queryRaw`SELECT 1` : i % 3 === 1 ? db.$queryRawUnsafe('SELECT 1') : db.location.count()))
      return 'all 60 OK'
    },
  },
  { n: 18, needsSchema: true, name: '10× vzporednih $transaction z tagged advisory lockom', run: async ({ db }) => {
      await Promise.all(Array.from({ length: 10 }, (_, i) =>
        db.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tx${i}`}))`
          return tx.$queryRawUnsafe('SELECT 1')
        })))
      return 'all 10 tx OK'
    },
  },
  { n: 19, needsSchema: true, name: 'tagged $queryRaw NAD prekrivajočo odprto transakcijo', run: async ({ db }) => {
      const t1 = db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'overlap1'}))`
        await new Promise((r) => setTimeout(r, 200))
        return tx.$queryRawUnsafe('SELECT 1')
      })
      const t2 = db.$queryRaw`SELECT 1`
      await Promise.all([t1, t2])
      return 'overlap OK'
    },
  },
  { n: 20, needsSchema: true, name: '200× sekvenčni tagged $queryRaw (prepared-state)', run: async ({ db }) => {
      for (let i = 0; i < 200; i++) await db.$queryRaw`SELECT hashtext(${`f${i}`}) AS h`
      return '200 OK'
    },
  },
  // ─── Konverzijske oblike (R93-a) — preveri, da Unsafe variante sprejmejo
  // ISTE tipe parametrov kot tagged (Date!) in da dinamični IN-placeholders
  // ustrezajo Prisma.join semantiki ($1, $2, ...) ───
  { n: 21, needsSchema: true, name: 'tagged $queryRaw z DATE parametrom (ai-assistant oblika)', run: async ({ db }) => {
      const d = new Date(Date.now() - 30 * 24 * 3600 * 1000)
      const r = await db.$queryRaw`SELECT COUNT(*)::int AS c FROM "Employee" WHERE "createdAt" >= ${d}`
      return `rows=${r.length}`
    },
  },
  { n: 22, needsSchema: true, name: '$queryRawUnsafe z DATE parametrom (konverzijska oblika 21)', run: async ({ db }) => {
      const d = new Date(Date.now() - 30 * 24 * 3600 * 1000)
      const r = await db.$queryRawUnsafe('SELECT COUNT(*)::int AS c FROM "Employee" WHERE "createdAt" >= $1', d)
      return `rows=${r.length}`
    },
  },
  { n: 23, needsSchema: true, name: '$queryRawUnsafe z dinamičnimi IN-placeholders (comparison/Prisma.join oblika)', run: async ({ db }) => {
      const ids = ['x:test', 'y:test', 'z:test']
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
      const r = await db.$queryRawUnsafe(`SELECT * FROM (VALUES (${placeholders})) t(id)`, ...ids)
      return `rows=${r.length}`
    },
  },
]

// ─── Izvedba enega primera (sveža instanca) ────────────────────────
async function runCase(caseDef) {
  const dir = mkdtempSync(join(tmpdir(), `r93-probe-${caseDef.n}-`))
  let pg, db
  try {
    pg = new PGlite(dir)
    if (typeof pg.waitReady === 'function') await pg.waitReady()

    // Nekateri primeri potrebujejo realno shemo (model queries / $transaction
    // nad tabelami) — apliciramo prisma/schema.sql DDL direktno (kot
    // init-e2e-db.mjs fallback pot).
    if (caseDef.needsSchema) {
      const { readFileSync } = await import('fs')
      const ddl = readFileSync(SCHEMA_SQL, 'utf8')
      for (const stmt of ddl.split(';')) {
        const s = stmt.trim()
        if (s.length > 0) await pg.query(s + ';')
      }
    }

    // isti monkey-patch kot src/lib/db.ts (BigInt → string) — zvesto okolje
    const adapter = new PrismaPGlite(pg)
    const proto = Object.getPrototypeOf(adapter)
    if (proto && typeof proto.performIO === 'function') {
      const originalPerformIO = proto.performIO
      proto.performIO = function (query) {
        if (query && query.args) {
          query.args = query.args.map((arg) => (typeof arg === 'bigint' ? arg.toString() : arg))
        }
        return originalPerformIO.call(this, query)
      }
    }
    db = new PrismaClient({ adapter })

    const detail = await caseDef.run({ pg, db })
    return { case: caseDef.n, name: caseDef.name, status: 'OK', detail }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isAbort = /Aborted\(\)|-sASSERTIONS|RuntimeError: memory|unreachable/i.test(msg)
    return { case: caseDef.n, name: caseDef.name, status: isAbort ? 'ABORT' : 'ERROR', error: msg.substring(0, 300) }
  } finally {
    try { if (db) await db.$disconnect() } catch { /* abort lahko pusti klienta mrtvega */ }
    try { await pg?.close?.() } catch { /* proces abort — cleanup best-effort */ }
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* tmp — best effort */ }
  }
}

// ─── Runner: child-proces izolacija per case ───────────────────────
const caseArg = process.argv.indexOf('--case')
if (caseArg !== -1) {
  const n = Number(process.argv[caseArg + 1])
  const def = CASES.find((c) => c.n === n)
  if (!def) { console.error(`Neznan case ${n}`); process.exit(2) }
  const result = await runCase(def)
  console.log(JSON.stringify(result))
  process.exit(result.status === 'OK' ? 0 : 1)
} else {
  console.log(`R93-a PGlite raw-SQL probe — ${CASES.length} primerov, child-proces izolacija per case\n`)
  const results = []
  for (const def of CASES) {
    let result
    try {
      const out = execFileSync(process.execPath, [SELF, '--case', String(def.n)], {
        encoding: 'utf8', timeout: 90_000, stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_NO_WARNINGS: '1' },
      })
      const line = out.trim().split('\n').filter((l) => l.startsWith('{')).pop()
      result = line ? JSON.parse(line) : { case: def.n, name: def.name, status: 'ERROR', error: `brez JSON izhoda: ${out.substring(0, 200)}` }
    } catch (err) {
      // child lahko CRASH-a (abort = exit code/signal) brez JSON-a
      const stderr = (err.stderr || '').toString().trim()
      const crashed = /Aborted|-sASSERTIONS|RuntimeError/i.test(stderr)
      result = {
        case: def.n, name: def.name,
        status: crashed || err.signal ? 'ABORT' : 'ERROR',
        error: crashed
          ? 'child CRASH (WASM abort, brez caught errorja)'
          : `child exit ${err.status}/${err.signal}: ${stderr.substring(0, 200) || String(err.message).substring(0, 200)}`,
      }
    }
    results.push(result)
    const icon = result.status === 'OK' ? '✅ OK   ' : result.status === 'ABORT' ? '❌ ABORT' : '⚠️ ERROR'
    console.log(`${icon}  #${String(result.case).padEnd(2)} ${result.name}${result.error ? ` — ${result.error}` : result.detail ? ` — ${result.detail}` : ''}`)
  }
  const aborted = results.filter((r) => r.status === 'ABORT').map((r) => r.case)
  const ok = results.filter((r) => r.status === 'OK').map((r) => r.case)
  const errored = results.filter((r) => r.status === 'ERROR').map((r) => r.case)
  console.log(`\nPOVZETEK: OK=[${ok.join(', ')}]  ABORT=[${aborted.join(', ')}]  ERROR=[${errored.join(', ')}]`)
  process.exit(errored.length > 0 ? 2 : 0)
}
