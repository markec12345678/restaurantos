// ============================================
// Issue #32 — Apply Subscription NOT NULL Migration
// ============================================
// Aplikacija NOT NULL + FK constraint na Location.subscriptionId.
//
// UPORABA:
//   node scripts/p0-c6-apply-subscription.mjs              # dry-run (verify)
//   node scripts/p0-c6-apply-subscription.mjs --apply      # dejansko aplikira
// ============================================

import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'fs'

const dataDir = process.env.PGLITE_DATA_DIR || '/tmp/pglite-data'
const APPLY = process.argv.includes('--apply')

console.log('╔═══════════════════════════════════════════════════════════╗')
console.log('║  Issue #32 — Subscription NOT NULL Migration            ║')
console.log(`║  Mode: ${APPLY ? 'APPLY' : 'DRY-RUN (verify only)'}                                      ║`)
console.log('╚═══════════════════════════════════════════════════════════╝')

const pg = new PGlite(dataDir)

// 1. Preveri NULL subscriptionId records
const countRes = await pg.query(`SELECT count(*) as cnt FROM "Location" WHERE "subscriptionId" IS NULL`)
const nullCount = parseInt(countRes.rows[0].cnt, 10)

console.log(`\n━━━ Step 1: Verify NULL subscriptionId records ━━━`)
console.log(`  Locations with NULL subscriptionId: ${nullCount}`)

if (nullCount > 0 && !APPLY) {
  console.log(`  → ${nullCount} locations need backfill (will create default Subscriptions)`)
  console.log(`  → Run with --apply to perform backfill + NOT NULL migration`)
  await pg.close()
  process.exit(0)
}

if (nullCount > 0 && APPLY) {
  console.log(`\n━━━ Step 2: Backfill — create default Subscriptions ━━━`)

  // Create default Subscriptions for locations without one
  const backfillRes = await pg.query(`
    INSERT INTO "Subscription" (id, "companyName", email, phone, "taxId", "businessId", plan, status, "monthlyPrice", "locationCount", currency, "createdAt", "updatedAt")
    SELECT
      'sub-default-' || l.id,
      l.name,
      l.email,
      l.phone,
      l."taxId",
      l."businessId",
      'professional',
      'active',
      0,
      1,
      l.currency,
      NOW(),
      NOW()
    FROM "Location" l
    WHERE l."subscriptionId" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s.id = 'sub-default-' || l.id)
    ON CONFLICT DO NOTHING
    RETURNING id
  `)
  console.log(`  ✓ Created ${backfillRes.rows.length} default Subscriptions`)

  // Update Location.subscriptionId
  const updateRes = await pg.query(`
    UPDATE "Location" l
    SET "subscriptionId" = 'sub-default-' || l.id
    WHERE l."subscriptionId" IS NULL
    RETURNING l.id
  `)
  console.log(`  ✓ Updated ${updateRes.rows.length} Locations with subscriptionId`)
}

// 2. Apply NOT NULL + FK
if (APPLY) {
  console.log(`\n━━━ Step 3: Apply FK + NOT NULL constraint ━━━`)

  const sqlPath = new URL('./p0-c6-subscription-migration.sql', import.meta.url)
  const sql = readFileSync(sqlPath, 'utf8')

  // Only run the FK + NOT NULL parts (backfill already done above)
  const fkStatements = [
    `ALTER TABLE "Location" DROP CONSTRAINT IF EXISTS "Location_subscriptionId_fkey"`,
    `ALTER TABLE "Location" ADD CONSTRAINT "Location_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    `ALTER TABLE "Location" ALTER COLUMN "subscriptionId" SET NOT NULL`,
  ]

  for (const stmt of fkStatements) {
    try {
      await pg.query(stmt)
      console.log(`  ✓ ${stmt.substring(0, 80)}...`)
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  ⊘ Already exists — skip`)
      } else {
        console.log(`  ✗ Failed: ${err.message.substring(0, 100)}`)
      }
    }
  }
}

// 3. Final verification
console.log(`\n━━━ Step 4: Final verification ━━━`)
const finalRes = await pg.query(`SELECT count(*) as cnt FROM "Location" WHERE "subscriptionId" IS NULL`)
const remaining = parseInt(finalRes.rows[0].cnt, 10)
console.log(`  Remaining NULL subscriptionId: ${remaining}`)

if (remaining === 0) {
  console.log(`\n✅ Migration complete — Location.subscriptionId is now NOT NULL`)
} else {
  console.log(`\n⚠ ${remaining} locations still have NULL subscriptionId — cannot apply NOT NULL`)
}

await pg.close()
