#!/usr/bin/env node
// ============================================
// R195 — NEON locationId DRIFT-MOST: APPLY SCRIPT (trajna rešitev)
// ============================================
// Aplikira scripts/r195-neon-locationid-migration.sql na produkcijsko bazo
// (Neon). Fail-closed po P0-C4 vzorcu (p0-c4-apply-migration.mjs):
//
//   1. DATABASE_URL (env ali --url) MORA obstajati — sicer abort.
//   2. Tabela "Location" MORA imeti TOČNO ENO vrstico (single-tenant
//      produkcija) — sicer abort (multi-location backfill zahteva ročno
//      preslikavo per tabelo; ugibanje NI dovoljeno).
//   3. Pre-check: izpiše trenutno drift stanje (katerih 11 tabel že IMA
//      stolpec — paket je idempotenten, preveri vsako).
//   4. Aplikacija: stavek-po-stavek iz ENEGA vira resnice (migration.sql),
//      z izpisom napredka; napaka abortira preostanek (fail-closed).
//   5. Post-verify: information_schema — locationId TEXT NOT NULL + FK
//      constraint na VSEH 11 tabelah; sicer exit 1.
//
// UPORABA:
//   DATABASE_URL="postgresql://..." node scripts/r195-apply-locationid-migration.mjs
//   node scripts/r195-apply-locationid-migration.mjs --url "postgresql://..."
//
// PO APLIKACIJI: P2022 "column locationId does not exist" ne nastopi več —
// most (src/lib/prisma-column-fallback.ts) samodejno izgubi vlogo
// (run(true) vedno uspe). Redeploy ni obvezen (most je prožen ob napaki).
// ============================================

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── 11 prizadetih tabel (≡ prisma-column-fallback.ts, empirično potrjeno runda 39) ───
const TABLES = [
  'DiningOption', 'RevenueCenter', 'SalesCategory', 'PriceGroup', 'ServiceCharge',
  'PrepStation', 'VoidReason', 'NoSaleReason', 'AlternatePaymentType', 'Printer', 'Discount',
]

function fail(msg) {
  console.error(`[r195] ❌ ABORT: ${msg}`)
  process.exit(1)
}

// ─── 0. DATABASE_URL (fail-closed) ───
const urlArgIdx = process.argv.indexOf('--url')
const url = urlArgIdx > -1 ? process.argv[urlArgIdx + 1] : (process.env.DATABASE_URL || '')
if (!url || !/^postgres(ql)?:\/\//.test(url)) {
  fail('DATABASE_URL manjka ali ni postgres URL. UPORABA: DATABASE_URL="postgresql://..." node scripts/r195-apply-locationid-migration.mjs (ALI --url "..."). Sandbox .env (file:) NI produkcijski URL.')
}

// ─── Naloži stavke iz enega vira resnice ───
const sqlPath = path.join(__dirname, 'r195-neon-locationid-migration.sql')
const statements = readFileSync(sqlPath, 'utf-8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith('--'))
  .map((l) => (l.endsWith(';') ? l.slice(0, -1) : l))
if (statements.length === 0) fail('migration.sql ne vsebuje stavkov')

const db = new PrismaClient({ datasources: { db: { url } } })

async function tableHasColumn(table) {
  const rows = await db.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='locationId'`,
    table,
  )
  return rows.length > 0
}

async function main() {
  console.log('[r195] ─── NEON locationId drift-most: trajna rešitev ───')

  // ─── 1. Location count guard (fail-closed) ───
  const locRows = await db.$queryRawUnsafe(`SELECT "id", "name" FROM "Location" ORDER BY "createdAt" ASC`)
  if (!Array.isArray(locRows) || locRows.length !== 1) {
    fail(
      `Tabela "Location" ima ${Array.isArray(locRows) ? locRows.length : '?'} vrstic (pričakovano TOČNO 1 — single-tenant produkcija). ` +
      'Multi-location backfill zahteva ročno preslikavo per tabelo — ugibanje NI dovoljeno.',
    )
  }
  const loc = locRows[0]
  console.log(`[r195] Backfill lokacija: "${loc.name}" (${loc.id})`)

  // ─── 2. Pre-check: trenutno drift stanje ───
  const missing = []
  for (const t of TABLES) {
    if (!(await tableHasColumn(t))) missing.push(t)
  }
  console.log(`[r195] Pre-check: ${TABLES.length - missing.length}/${TABLES.length} tabel že ima locationId; manjka na: ${missing.length > 0 ? missing.join(', ') : '(nič — že migrirano?)'}`)
  if (missing.length === 0) {
    console.log('[r195] Vseh 11 tabel že ima stolpec — nadaljujem s post-verifikacijo (paket je idempotenten).')
  }

  // ─── 3. Aplikacija: stavek-po-stavek (fail-closed) ───
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const label = stmt.match(/ALTER TABLE "([^"]+)"/)?.[1] ?? '?'
    try {
      await db.$executeRawUnsafe(stmt)
      process.stdout.write(`[r195] (${i + 1}/${statements.length}) ${label}: OK\n`)
    } catch (err) {
      fail(`stavek ${i + 1}/${statements.length} na tabeli "${label}" ni uspel: ${err instanceof Error ? err.message : String(err)}\n       Stavek: ${stmt.slice(0, 120)}...`)
    }
  }

  // ─── 4. Post-verify: column NOT NULL + FK na vseh 11 ───
  const problems = []
  for (const t of TABLES) {
    const col = await db.$queryRawUnsafe(
      `SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='locationId'`,
      t,
    )
    if (!Array.isArray(col) || col.length !== 1 || col[0].data_type !== 'text' || col[0].is_nullable !== 'NO') {
      problems.push(`${t}: stolpec manjka/nullable (${JSON.stringify(col)})`)
      continue
    }
    const fk = await db.$queryRawUnsafe(
      `SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name=$1 AND constraint_name='${t}_locationId_fkey' AND constraint_type='FOREIGN KEY'`,
      t,
    )
    if (!Array.isArray(fk) || fk.length !== 1) problems.push(`${t}: FK ${t}_locationId_fkey manjka`)
    const idx = await db.$queryRawUnsafe(
      `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename=$1 AND indexname='${t}_locationId_idx'`,
      t,
    )
    if (!Array.isArray(idx) || idx.length !== 1) problems.push(`${t}: indeks ${t}_locationId_idx manjka (@@index([locationId]) pariteta s shemo)`)
  }
  if (problems.length > 0) {
    fail(`post-verifikacija ni uspela:\n  - ${problems.join('\n  - ')}`)
  }

  // ─── 5. Orphan check: vse vrstice kažejo na obstoječo lokacijo ───
  let orphans = 0
  for (const t of TABLES) {
    const rows = await db.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM "${t}" WHERE "locationId" <> $1`,
      loc.id,
    )
    orphans += rows[0]?.n ?? 0
  }
  if (orphans > 0) {
    fail(`backfill pustil ${orphans} vrstic z drugačno lokacijo — ročni pregled zahtevan`)
  }

  console.log('[r195] ✅ MIGRACIJA USPEŠNA — vseh 11 tabel: locationId TEXT NOT NULL + FK + backfill enotna lokacija.')
  console.log('[r195] P2022 ne nastopi več → most (prisma-column-fallback) samodejno izgubi vlogo.')
}

main()
  .catch((e) => fail(e instanceof Error ? e.message : String(e)))
  .finally(() => db.$disconnect())
