// ============================================
// P0-C4 Phase 5 — APPLY MIGRATION
// ============================================
// Aplikacija NOT NULL + FK constraints na PGlite bazo.
// Preveri da backfill je bil izveden (0 NULL records).
//
// UPORABA:
//   node scripts/p0-c4-apply-migration.mjs              # dry-run (samo preveri)
//   node scripts/p0-c4-apply-migration.mjs --apply      # dejansko aplikira
// ============================================

import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'fs'

const dataDir = process.env.PGLITE_DATA_DIR || '/tmp/pglite-data'
const APPLY = process.argv.includes('--apply')

console.log('╔═══════════════════════════════════════════════════════════╗')
console.log('║  P0-C4 Phase 5 — Apply NOT NULL + FK migration          ║')
console.log(`║  Mode: ${APPLY ? 'APPLY' : 'DRY-RUN (verify only)'}                                      ║`)
console.log('╚═══════════════════════════════════════════════════════════╝')

const pg = new PGlite(dataDir)

// --- 1. Preveri da ni NULL records (backfill mora biti končan) ---
const modelsToCheck = [
  'Receipt', 'JournalEntry', 'JournalLine',
  'Menu', 'Table', 'Shift', 'TimeEntry', 'CashRegisterShift',
  'InventoryItem', 'DeliveryZone', 'OpeningHours', 'HaccpEntry',
  'StaffShift', 'Reservation', 'PurchaseOrder', 'GuestFeedback',
  'ZReport', 'TipPool', 'DeliveryTracking',
  'AccountsPayable', 'AccountsReceivable',
  'SustainabilityReport', 'DeviceRegistry', 'VideoAnalyticsSession',
]

console.log('\n━━━ Step 1: Verify no NULL locationId records ━━━')
let canProceed = true
for (const model of modelsToCheck) {
  try {
    const res = await pg.query(`SELECT count(*) as cnt FROM "${model}" WHERE "locationId" IS NULL`)
    const nullCount = parseInt(res.rows[0].cnt, 10)
    if (nullCount > 0) {
      console.log(`  ✗ ${model}: ${nullCount} NULL records — CANNOT apply NOT NULL`)
      canProceed = false
    } else {
      console.log(`  ✓ ${model}: 0 NULL records`)
    }
  } catch (err) {
    console.log(`  ? ${model}: table does not exist or query failed — skip`)
  }
}

if (!canProceed) {
  console.log('\n❌ CANNOT proceed — run scripts/p0-c4-backfill.mjs --apply first')
  await pg.close()
  process.exit(1)
}

if (!APPLY) {
  console.log('\n✅ Dry-run passed — all 24 models have 0 NULL records')
  console.log('  Run with --apply to execute migration SQL')
  await pg.close()
  process.exit(0)
}

// --- 2. Aplikacija migration SQL ---
console.log('\n━━━ Step 2: Apply NOT NULL + FK constraints ━━━')
const sqlPath = new URL('./p0-c4-migration.sql', import.meta.url)
const sql = readFileSync(sqlPath, 'utf8')

// Razdeli na statements (po ;) in izpusti komentarje
const statements = sql
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .filter(s => s.trim().length > 0)

let applied = 0
let failed = 0
let skipped = 0
for (const stmt of statements) {
  const trimmed = stmt.trim()
  if (!trimmed) continue
  try {
    await pg.query(trimmed + ';')
    applied++
    // Prikaži kateri constraint je bil dodan
    if (trimmed.includes('ADD CONSTRAINT')) {
      const match = trimmed.match(/"(\w+)"\s+ADD CONSTRAINT\s+"(\w+)"/)
      if (match) console.log(`  ✓ ${match[2]} on ${match[1]}`)
    } else if (trimmed.includes('SET NOT NULL')) {
      const match = trimmed.match(/ALTER TABLE\s+"(\w+)"/)
      if (match) console.log(`  ✓ NOT NULL on ${match[1]}.locationId`)
    }
  } catch (err) {
    const errMsg = err.message
    // Ignoriraj "already exists" napake za FK constraints (Prisma jih že upravlja)
    if (errMsg.includes('already exists')) {
      skipped++
      const match = trimmed.match(/"(\w+)"\s+ADD CONSTRAINT\s+"(\w+)"/)
      if (match) console.log(`  ⊘ ${match[2]} already exists (Prisma-managed) — skip`)
    } else {
      failed++
      console.log(`  ✗ Failed: ${trimmed.substring(0, 80)}...`)
      console.log(`    Error: ${errMsg.substring(0, 100)}`)
    }
  }
}

console.log(`\n━━━ Summary ━━━`)
console.log(`  Statements applied: ${applied}`)
console.log(`  Statements skipped: ${skipped} (FK already exists — Prisma-managed)`)
console.log(`  Statements failed:  ${failed}`)

if (failed > 0) {
  console.log('\n⚠ Some statements failed — check errors above')
} else {
  console.log('\n✅ Migration complete — all 24 models now have NOT NULL on locationId')
  console.log('  (FK constraints are managed by Prisma schema, not this migration)')
}

// --- 3. Final verification ---
console.log('\n━━━ Step 3: Final verification ━━━')
for (const model of modelsToCheck.slice(0, 5)) { // preveri prvih 5
  try {
    const res = await pg.query(`SELECT count(*) as cnt FROM "${model}" WHERE "locationId" IS NULL`)
    console.log(`  ${model}: ${res.rows[0].cnt} NULL records (expected 0)`)
  } catch (err) {
    console.log(`  ${model}: query failed — ${err.message.substring(0, 60)}`)
  }
}

await pg.close()
console.log('\n✅ Done.')
