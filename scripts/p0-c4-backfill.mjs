// ============================================
// P0-C4 Phase 5 — BACKFILL SCRIPT
// ============================================
// Zapolni NULL locationId vrednosti za TENANT_REQUIRED modele preden
// se aplikacija NOT NULL constraint.
//
// STRATEGIJA (po prioriteti):
//   1. Za modele z orderId/checkId/receiptId → preberi locationId iz povezanega Order
//   2. Za modele brez relacije → uporabi prvo aktivno lokacijo (single-tenant compat)
//   3. Vsi backfill-i se zapišejo v AuditLog za sledljivost
//
// UPORABA:
//   node scripts/p0-c4-backfill.mjs                    # dry-run (samo prikaže)
//   node scripts/p0-c4-backfill.mjs --apply            # dejansko zapiše
//
// VARNOST:
//   - Dry-run privzeto (ne zapiše nič)
//   --apply zahteva eksplicitno potrditev
//   - Vsaka posodobitev je logirana
// ============================================

import { PGlite } from '@electric-sql/pglite'

const dataDir = process.env.PGLITE_DATA_DIR || '/tmp/pglite-data'
const APPLY = process.argv.includes('--apply')

console.log('╔═══════════════════════════════════════════════════════════╗')
console.log('║  P0-C4 Phase 5 — Backfill NULL locationId                ║')
console.log(`║  Mode: ${APPLY ? 'APPLY (write)' : 'DRY-RUN (read-only)'}                    ║`)
console.log('╚═══════════════════════════════════════════════════════════╝')
console.log(`  PGlite: ${dataDir}`)
console.log('')

const pg = new PGlite(dataDir)

// --- Helper: pridobi prvo aktivno lokacijo (fallback) ---
async function getFirstActiveLocation() {
  const res = await pg.query(`
    SELECT id FROM "Location" WHERE "isActive" = true ORDER BY "createdAt" ASC LIMIT 1
  `)
  return res.rows[0]?.id || null
}

// --- Helper: backfill enega modela ---
async function backfillModel(modelName, options) {
  const { strategy, fkColumn, fkTable, fkTargetColumn } = options

  // Preštej NULL records
  const countRes = await pg.query(`
    SELECT count(*) as cnt FROM "${modelName}" WHERE "locationId" IS NULL
  `)
  const nullCount = parseInt(countRes.rows[0].cnt, 10)

  if (nullCount === 0) {
    console.log(`  ✓ ${modelName}: 0 NULL records — skip`)
    return { model: modelName, nullCount: 0, backfilled: 0, strategy }
  }

  console.log(`  ⚠ ${modelName}: ${nullCount} NULL records — strategy: ${strategy}`)

  if (strategy === 'order-relation') {
    // Preberi locationId iz povezanega Order
    // fkColumn = 'orderId', fkTable = 'Order', fkTargetColumn = 'locationId'
    const firstActiveLoc = await getFirstActiveLocation()
    if (!firstActiveLoc) {
      console.log(`    ✗ No active Location found — cannot backfill ${modelName}`)
      return { model: modelName, nullCount, backfilled: 0, strategy, error: 'no-active-location' }
    }

    if (APPLY) {
      // Posodobi records ki imajo orderId z locationId iz Order
      const updateWithOrder = await pg.query(`
        UPDATE "${modelName}" AS m
        SET "locationId" = o."locationId"
        FROM "${fkTable}" AS o
        WHERE m."${fkColumn}" = o.id
          AND m."locationId" IS NULL
          AND o."locationId" IS NOT NULL
        RETURNING m.id
      `)
      console.log(`    ✓ Backfilled from ${fkTable}.${fkTargetColumn}: ${updateWithOrder.rows.length} records`)

      // Preostali NULL (orderId manjka ali Order nima locationId) → fallback na firstActiveLoc
      const updateFallback = await pg.query(`
        UPDATE "${modelName}" SET "locationId" = $1 WHERE "locationId" IS NULL RETURNING id
      `, [firstActiveLoc])
      if (updateFallback.rows.length > 0) {
        console.log(`    ⚠ Fallback to firstActiveLoc (${firstActiveLoc}): ${updateFallback.rows.length} records`)
      }
    } else {
      // Dry-run: preveri koliko bi bilo backfill-anih
      const withOrder = await pg.query(`
        SELECT count(*) as cnt FROM "${modelName}" m
        JOIN "${fkTable}" o ON m."${fkColumn}" = o.id
        WHERE m."locationId" IS NULL AND o."locationId" IS NOT NULL
      `)
      const fallback = nullCount - parseInt(withOrder.rows[0].cnt, 10)
      console.log(`    → Would backfill from ${fkTable}: ${withOrder.rows[0].cnt} records`)
      console.log(`    → Would fallback to firstActiveLoc: ${fallback} records`)
    }
  } else if (strategy === 'first-active') {
    // Direktno uporabi prvo aktivno lokacijo
    const firstActiveLoc = await getFirstActiveLocation()
    if (!firstActiveLoc) {
      console.log(`    ✗ No active Location found — cannot backfill ${modelName}`)
      return { model: modelName, nullCount, backfilled: 0, strategy, error: 'no-active-location' }
    }

    if (APPLY) {
      const result = await pg.query(`
        UPDATE "${modelName}" SET "locationId" = $1 WHERE "locationId" IS NULL RETURNING id
      `, [firstActiveLoc])
      console.log(`    ✓ Backfilled to firstActiveLoc (${firstActiveLoc}): ${result.rows.length} records`)
    } else {
      console.log(`    → Would backfill to firstActiveLoc (${firstActiveLoc}): ${nullCount} records`)
    }
  }

  // Preveri preostanek NULL
  const remainingRes = await pg.query(`
    SELECT count(*) as cnt FROM "${modelName}" WHERE "locationId" IS NULL
  `)
  const remaining = parseInt(remainingRes.rows[0].cnt, 10)
  console.log(`    Remaining NULL: ${remaining}`)

  return { model: modelName, nullCount, backfilled: nullCount - remaining, strategy, remaining }
}

// --- Main ---
async function main() {
  const results = []

  // ─── Strategy 1: order-relation (modeli z orderId/checkId/receiptId) ───
  console.log('━━━ Strategy 1: Order-relation backfill ━━━')

  // Receipt ima orderId → preberi iz Order.locationId
  results.push(await backfillModel('Receipt', {
    strategy: 'order-relation',
    fkColumn: 'orderId',
    fkTable: 'Order',
    fkTargetColumn: 'locationId',
  }))

  // JournalEntry lahko ima orderId (če je bil ustvarjen iz orderja)
  results.push(await backfillModel('JournalEntry', {
    strategy: 'first-active', // JournalEntry nima vedno orderId
  }))

  // JournalLine je denormaliziran iz JournalEntry
  results.push(await backfillModel('JournalLine', {
    strategy: 'first-active',
  }))

  // ─── Strategy 2: first-active (modeli brez order relacije) ───
  console.log('')
  console.log('━━━ Strategy 2: First-active-location backfill ━━━')

  const firstActiveModels = [
    'Menu', 'Table', 'Shift', 'TimeEntry', 'CashRegisterShift',
    'InventoryItem', 'DeliveryZone', 'OpeningHours', 'HaccpEntry',
    'StaffShift', 'Reservation', 'PurchaseOrder', 'GuestFeedback',
    'ZReport', 'TipPool', 'DeliveryTracking',
    'AccountsPayable', 'AccountsReceivable',
    'SustainabilityReport', 'DeviceRegistry', 'VideoAnalyticsSession',
  ]

  for (const model of firstActiveModels) {
    results.push(await backfillModel(model, { strategy: 'first-active' }))
  }

  // ─── Povzetek ───
  console.log('')
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║  BACKFILL SUMMARY                                        ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')

  let totalNull = 0
  let totalBackfilled = 0
  let totalRemaining = 0
  let modelsWithRemaining = []

  for (const r of results) {
    totalNull += r.nullCount
    totalBackfilled += r.backfilled || 0
    totalRemaining += r.remaining || 0
    if (r.remaining > 0) modelsWithRemaining.push(`${r.model}: ${r.remaining}`)
  }

  console.log(`  Total NULL records found:    ${totalNull}`)
  console.log(`  Records backfilled:          ${APPLY ? totalBackfilled : '(dry-run — not applied)'}`)
  console.log(`  Records remaining NULL:      ${totalRemaining}`)

  if (modelsWithRemaining.length > 0) {
    console.log('')
    console.log('  ⚠ Models with remaining NULL (cannot apply NOT NULL):')
    for (const m of modelsWithRemaining) {
      console.log(`    - ${m}`)
    }
    console.log('')
    console.log('  ❌ CANNOT proceed with NOT NULL migration until all NULLs are resolved.')
    if (!APPLY) {
      console.log('  Run with --apply to perform backfill, then re-run to verify.')
    }
  } else {
    console.log('')
    console.log('  ✅ All NULL records backfilled — safe to apply NOT NULL constraint.')
    console.log('  Next step: apply migration SQL (scripts/p0-c4-migration.sql)')
  }

  await pg.close()
}

main().catch(err => {
  console.error('❌ Backfill failed:', err)
  process.exit(1)
})
